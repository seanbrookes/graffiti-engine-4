import express from 'express';
import fs from 'fs';
import http from 'http';
import cors from 'cors';
import TurndownService from 'turndown';
import _ from 'lodash';
import { marked } from 'marked';
import { mangle } from 'marked-mangle';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import querystring from 'querystring';
import fetch from 'node-fetch';
import { parse } from 'parse5';



const PORT = 4444;
const LIVE_URL    = process.env.LIVE_URL;
const LIVE_KEY    = process.env.LIVE_KEY;
const SITE_URL         = process.env.SITE_URL || '';
const SITE_DESCRIPTION = process.env.SITE_DESCRIPTION || '';
const STAGING_KEY = '__DEV_KEY__';

const getExcerpt = (body, maxLength = 160) => {
  if (!body) return '';
  const text = body
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '...';
};

const escapeAttr = (str) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const escapeXml = (str) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
};
const server = express();
server.use(express.json({ limit: '10mb' }));
/*

So, bodyParser.json() and bodyParser.urlencoded() are built into Express as express.json() and express.urlencoded() so you don't have to import body-parser at all.
*/
server.use(cors());

const window = new JSDOM('').window;
const purify = DOMPurify(window);

marked.use(mangle());
marked.use(gfmHeadingId({ prefix: 'gfe-' }));

// Render a post body to HTML according to its declared format.
// bodyMode: 'text' (escaped, whitespace preserved) | 'html' (verbatim) | 'markdown' (default)
const renderBody = (post) => {
  const body = post.body || '';
  switch (post.bodyMode) {
    case 'html':
      return purify.sanitize(body);
    case 'text':
      return `<pre>${escapeXml(body)}</pre>`;
    case 'markdown':
    default:
      return purify.sanitize(marked.parse(body));
  }
};


const getSlug = (title) => {
  // replace spaces with dashes
  // remove question marks
  return title.toLowerCase().replace(/([^a-z0-9]+)/gi, '-');
};
const guid = () => {
  let s4 = () => {
      return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
  }
  //return id of format 'aaaaaaaa'-'aaaa'-'aaaa'-'aaaa'-'aaaaaaaaaaaa'
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};

const copyStaticAssets = () => {
  const src = './server/static';
  const dest = './local-web-cloud';
  try {
    fs.cpSync(src, dest, { recursive: true });
    console.log('| copyStaticAssets: copied server/static → local-web-cloud');
  } catch (err) {
    console.error('| copyStaticAssets failed:', err.message);
  }
};

const getPublishedPosts = () => {
  const dir = './server/posts/';
  let files;
  let returnError;
  console.log('| 1');

  try {
    files = fs.readdirSync(dir);
  }
  catch(error) {
    returnError = error;
  }

  const postCollection = [];

  if (files) {
    try {
      files.forEach(file => {
        try {
          const data = fs.readFileSync('./server/posts/' + file);
          const parsedPostData = JSON.parse(data);
          if (parsedPostData && parsedPostData?.status && parsedPostData.status === 'published') {
            postCollection.push(JSON.parse(data));
          }
        } catch (err) {
          returnError = err;
        }
      });

    }
    catch(error) {
      console.log('| Error iterating over the files', error);
      returnError = error;
    }
  }
  return postCollection;
};

const getStagedPost = () => {
  const dir = './server/posts/';
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (error) {
    return null;
  }
  for (const file of files) {
    try {
      const data = fs.readFileSync('./server/posts/' + file);
      const post = JSON.parse(data);
      if (post?.status === 'staged') return post;
    } catch (err) {
      // skip unreadable files
    }
  }
  return null;
};

// New helper to calculate the link path
const getPostLink = (post) => {
  const pDate = new Date(post.publishDate);
  const pubYear = pDate.getFullYear();
  const pubMonth = pDate.getMonth() + 1;
  return `blog/${pubYear}/${pubMonth}/${post.slug}.html`;
};

/**
 * COMPILE INDEX FROM TEMPLATE
 * Takes a list of published posts, generates the index markup, and compiles it 
 * into a full HTML document using the index template.
 * * @param {Array<Object>} posts - sorted list of published posts.
 * @returns {string} - fully compiled/valid index.html document.
 */
const getCompiledIndex = async (posts) => {
  // NOTE: indexTemplate.html is required in the ./server/templates folder.
  // Changed to use the user-provided homeTemplate.html
  let templateData;
  try {
    templateData = fs.readFileSync('./server/templates/homeTemplate.html', 'utf8');
  } catch (e) {
    throw new Error('homeTemplate.html not found in ./server/templates/');
  }
  const FULL_COUNT    = 2; // render full post body
  const EXCERPT_COUNT = 4; // render excerpt after the full posts; rest are title links

  let listMarkup = '<ul class="post-list">';

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const postLink = getPostLink(post);
    const pDate = new Date(post.publishDate);
    const publishDate = pDate.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    const author = post.author || 'Sean Brookes';

    if (!post.body || !post.title) continue;

    const metaBlock =
      `<div class="post-list-meta">` +
      `<time datetime="${post.publishDate}">${publishDate}</time>` +
      `<span class="post-list-author">${author}</span>` +
      `</div>`;

    if (i < FULL_COUNT) {
      // Tier 1: full rendered body
      const markup = renderBody(post);
      listMarkup += `<li class="post-list-item post-list-item--full post--${post.slug}">`;
      listMarkup += `<a href="${postLink}"><h2>${post.title}</h2></a>`;
      listMarkup += metaBlock;
      listMarkup += `<div class="post-body">${markup}</div>`;
      listMarkup += `</li>`;
    } else if (i < FULL_COUNT + EXCERPT_COUNT) {
      // Tier 2: excerpt card
      const excerpt = post.summary || getExcerpt(post.body, 200);
      listMarkup += `<li class="post-list-item post-list-item--excerpt post--${post.slug}">`;
      listMarkup += `<a href="${postLink}"><h2>${post.title}</h2></a>`;
      listMarkup += metaBlock;
      if (excerpt) listMarkup += `<p class="post-excerpt">${excerpt}</p>`;
      listMarkup += `</li>`;
    } else {
      // Tier 3: title link with date
      listMarkup += `<li class="post-list-item post-list-item--link post--${post.slug}">`;
      listMarkup += `<a href="${postLink}">${post.title}</a>`;
      listMarkup += `<time class="post-list-date" datetime="${post.publishDate}">${publishDate}</time>`;
      listMarkup += `</li>`;
    }
  }
  listMarkup += '</ul>';

  const homeUrl = SITE_URL ? `${SITE_URL}/` : '';
  const indexData = {
    markup: listMarkup,
    canonicalUrl: homeUrl,
    description: escapeAttr(SITE_DESCRIPTION),
    jsonLd: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'fourfivesix.ca',
      url: SITE_URL || 'https://fourfivesix.ca'
    }, null, 2)
  };

  const compiled = _.template(templateData);
  const publishDoc = compiled(indexData);
  
  return publishDoc;
};

/**
 * Orchestrates the full process of generating the index.html and sending it to the inbox.
 * @param {Object} targetConfig - The configuration object for the target host/port/key/logging.
 */
const generateHomePage = async (targetConfig, stagedPost = null, postFn = postToStaging) => {
  try {
    const publishedPosts = getPublishedPosts();
    console.log(`| generateHomePage: Found ${publishedPosts.length} published posts.`);

    const allPosts = stagedPost ? [...publishedPosts, stagedPost] : publishedPosts;

    if (allPosts.length === 0) {
        console.log('| generateHomePage: No posts to generate index from. Skipping.');
        return;
    }

    // 1. Sort posts by publishDate descending (newest first)
    allPosts.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

    // 2. Compile the Index Document
    const indexDoc = await getCompiledIndex(allPosts);
    
    // 3. Prepare POST data for inbox.js
    const rawPostData = {
      ApiKey: targetConfig.apiKey || '__DEV_KEY__', 
      IsLogging: targetConfig.isLoggingOn || 'true',
      IsIndex: 'true', // Flag to tell inbox.js this is the index file
      // These fields are required by inbox.js but unused for index
      PostPublishYear: 'N/a', 
      PostPublishMonth: 'N/a',
      PostSlug: 'index', 
      PostBody: indexDoc
    };
    
    // 4. Send the POST request
    const post_data = querystring.stringify(rawPostData);
    await postFn(post_data);
    
    console.log('| generateHomePage: Successfully posted index.html to staging.');
    
  } catch (error) {
    console.error('| generateHomePage failed:', error);
  }
};




const generateFeed = async (targetConfig, postFn = postToStaging) => {
  try {
    const publishedPosts = getPublishedPosts();
    if (publishedPosts.length === 0) return;

    publishedPosts.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

    const siteUrl  = SITE_URL || 'https://fourfivesix.ca';
    const feedUrl  = `${siteUrl}/feed.xml`;
    const buildDate = new Date().toUTCString();

    let items = '';
    for (const post of publishedPosts.slice(0, 20)) {
      const link        = `${siteUrl}/${getPostLink(post)}`;
      const pubDate     = new Date(post.publishDate).toUTCString();
      const description = escapeXml(post.summary || getExcerpt(post.body, 300));
      const title       = escapeXml(post.title);
      items +=
        `<item>` +
        `<title>${title}</title>` +
        `<link>${link}</link>` +
        `<guid isPermaLink="true">${link}</guid>` +
        `<pubDate>${pubDate}</pubDate>` +
        `<description>${description}</description>` +
        `</item>`;
    }

    const feedXml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">` +
      `<channel>` +
      `<title>${escapeXml('fourfivesix.ca')}</title>` +
      `<link>${siteUrl}</link>` +
      `<description>${escapeXml(SITE_DESCRIPTION || 'fourfivesix.ca')}</description>` +
      `<language>en-ca</language>` +
      `<lastBuildDate>${buildDate}</lastBuildDate>` +
      `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>` +
      items +
      `</channel></rss>`;

    const post_data = querystring.stringify({
      ApiKey:    targetConfig.apiKey || '__DEV_KEY__',
      IsLogging: targetConfig.isLoggingOn || 'true',
      IsRss:     'true',
      PostBody:  feedXml
    });
    await postFn(post_data);
    console.log('| generateFeed: feed.xml posted successfully.');
  } catch (error) {
    console.error('| generateFeed failed:', error);
  }
};

/* GET THE POSTS

*/
server.get('/api/posts', (req, res) => {
  const dir = './server/posts/';
  let files;
  let returnError;
  res.contentType('application/json');

  try {
    files = fs.readdirSync(dir);
  
  }
  catch(error) {
    returnError = error;
  }

  const postCollection = [];

  if (files) {
    files.forEach(file => {
      try {
        const data = fs.readFileSync('./server/posts/' + file);
        postCollection.push(JSON.parse(data));
      } catch (err) {
        console.error('| build list of posts: skipping bad file', file, err.message);
      }
    });
  }

  if (returnError) {
    res.status(500);
    res.send({error: returnError.message});
  } else {
    res.send(JSON.stringify(postCollection));
  }
});

/* GET SINGLE POST

*/
server.get('/api/post/:id', (req, res) => {
  const postId = req.params.id;
  const path = `./server/posts/${postId}.json`;
  if (postId && fs.existsSync(path)) {
    fs.readFile(path, function(err, data) { 
      
      // Check for errors 
      if (err) throw err; 
     
      // Converting to JSON 
      const post = JSON.parse(data); 
        
     // console.log('posts', posts);
      res.send(JSON.stringify(post));
    });
  }
  else {
    res.sendStatus(404);
    //res.send({status: 404, message: 'resource not found'});
  }
});



/* SAVE POST

*/
server.post('/api/posts', (req, res) => {
  const targetPost = req.body;
  console.log('| SAVE POST req ', req.body);
  const saveTimestamp = new Date().getTime();
  if (!targetPost || !targetPost.body) {
    return res.status(500).send({message: 'not saved missing post body'});
  }
  console.log('| SAVE POST ', targetPost.body);
  let freshPost = targetPost;
  if (!freshPost.date) {
    freshPost.date = saveTimestamp;
  }
  if (!freshPost.id) {
    /*
      new post needs
      - title?
      - lastUpdate
      - id
      - status
    */
    freshPost.status = 'draft';
    freshPost.id = guid();
    freshPost.title = targetPost.title ? targetPost.title : '__no_title__';
  }
  if (!freshPost.status) {
    freshPost.status = 'draft';
  }
  freshPost.lastUpdate = saveTimestamp;
  console.log('Save freshPost.lastUpdate', freshPost.lastUpdate);
  console.log('Save this thing', JSON.stringify(freshPost, null, 2));
  /*
  write the file
  */
  fs.writeFile(`./server/posts/${freshPost.id}.json`, JSON.stringify(freshPost), err => { 
      
    // Checking for errors 
    if (err) throw err;  
  
  //  console.log("Done writing"); // Success 
    res.send({status: 200, message: 'saved', post: freshPost});
  });

});

/* PAINT POST
  Straight up repaint, no updates to meta data or edits to post.  
  Generally for use cases where we want to simply replace a previously published post
  Possbily the site has moved and needs to be 'repainted' or a post was written to the wrong folder
  and needs to be corrected
*/
server.get('/api/paintpost/:id', (req, res) => {
  const postId = req.params.id;
  const isLogging = req.query.logit;
  // const isLogging = false;

  const path = `./server/posts/${postId}.json`;
  if (postId && fs.existsSync(path)) {
    fs.readFile(path, function(err, data) { 
      
      // Check for errors 
      if (err) throw err; 
     
      // Converting to JSON 
      const targetPost = JSON.parse(data); 
        
     console.log('posts  AAAA');
      //res.send(JSON.stringify(post));

      const saveTimestamp = new Date().getTime();
      if (!targetPost || !targetPost.body) {
        res.sendStatus(500);
        res.send({message: 'not saved missing post body'});
      }
      let freshPost = Object.assign({}, targetPost);
      if (!freshPost.date) {
        freshPost.date = saveTimestamp;
      }

      freshPost.lastUpdate = saveTimestamp;
      console.log('REPAINT freshPost.lastUpdate', freshPost.lastUpdate);
      console.log('REPAINT this thing', JSON.stringify(freshPost, null, 2));
      const post = freshPost;





      var post_data = querystring.stringify({
        'ApiKey': '__DEV_KEY__',
        'IsLogging': 'true',
        'PostSlug': post.slug,
        'PostBody': post.body
      });
  
      // An object of options to indicate where to post to
      var post_options = {
        host: 'localhost',
        port: '8888',
        path: '/api/inbox',
  //            path: '/inbox.php',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': post_data.length
        }
      };
  
      const author = 'Sean Brookes';
    /**
   *
   * Establish the publish date
   * note this may not be valid in case
   * there is a failure in the flow
   *
   * */
    post.publishDate = new Date();
    post.publishYear = post.publishDate.getFullYear();
    post.publishMonth = (post.publishDate.getMonth() + 1);
    post.publishDay = (post.publishDate.getDate());
    post.lastUpdate = new Date();
    post.id = postId;
    post.author = author;
    post.status = 'published';
    post.apiKey = 'eDj4Ax0KZyk8fHe6MpJHKgBkw8JDXKtO';
  
    var targetConfig = {
      host: 'localhost',
      port: '8888',
      path: '/api/inbox',
      isLoggingOn: isLogging,
      apiKey: 'eDj4Ax0KZyk8fHe6MpJHKgBkw8JDXKtO'
    };
    postPost(targetConfig, post, (err, doc) => {
      console.log('|  publish callback ', post.title);
    });

    });
  }
  else {
    res.sendStatus(404);
    //res.send({status: 404, message: 'resource not found'});
  }

  

});


/**
 * * COMPILE POST FROM TEMPLATE
 * * Takes the post as json object and converts into a valid html document
 * It loads the post template file
 * establishes publish year and publish month 
 * converts the markdown to html
 * compiles the markup fragment into the html doc
 * returns the doc
 * * Note this is async so needs to run as a promise.
 * This isn't ideal as it forces us to contort the calling logic and embed within this 
 * function execution scope.  not ideal but not the end of th world for now
 * * @param {object} post - raw json version of post including metadata
 * @returns {string} - fully compiled/valie html document
 */
const getCompiledPost = async (post) => {
  let templateData;
  try {
    templateData = fs.readFileSync('./server/templates/postTemplate.html', 'utf8');
  } catch (e) {
    throw new Error('postTemplate.html not found in ./server/templates/');
  }

  const publishDate = new Date(post.publishDate);
  post.publishYear = publishDate.getFullYear();
  post.publishMonth = publishDate.getMonth() + 1;
  post.publishDateFormatted = publishDate.toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  if (!post.author) post.author = 'Sean Brookes';
  if (!post.updatedDate) post.updatedDate = '';
  if (!post.summary) post.summary = '';
  if (post.updatedDate) {
    post.updatedDateFormatted = new Date(post.updatedDate).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  const postPath = `blog/${post.publishYear}/${post.publishMonth}/${post.slug}.html`;
  post.canonicalUrl = SITE_URL ? `${SITE_URL}/${postPath}` : '';
  const rawDescription = post.summary || getExcerpt(post.body);
  post.descriptionAttr = escapeAttr(rawDescription);
  post.titleAttr = escapeAttr(post.title || '');
  post.jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: rawDescription,
    author: { '@type': 'Person', name: post.author },
    datePublished: post.publishDate,
    ...(post.updatedDate ? { dateModified: post.updatedDate } : {}),
    ...(post.canonicalUrl ? { url: post.canonicalUrl } : {}),
    publisher: { '@type': 'Person', name: 'fourfivesix.ca' }
  }, null, 2);

  post.markup = renderBody(post);

  const compiled = _.template(templateData);
  return compiled(post);
};

const postTheDamnDocument = async (post_data, arg2, arg3) => {
  const urlPath = 'http://localhost/fourfivesix/inbox/inbox.php';
  const response = await fetch(urlPath, {
    method: 'POST', 
    body: JSON.stringify(post_data),
    // headers: {'Content-Type': 'application/json'}
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': post_data.length
    }
  });
  const data = await response.text();
  // console.log(`| postTheDamnDocument C `, response);
  // const data = await response.json();
  console.log(`| postTheDamnDocument D`);

  // TODO surface status of repaint effort to signal the frontend of success / failure
  if (response.ok) {
    console.log('Response: It worked!!!');
    console.log('| RESPONSE FROM PHP text() ', data);
      
  } else {
    console.log('Response: It DID NOT WORK ', response.status);
    console.log('Response: It DID NOT WORK data ', data);
  }
};


const postToLive = async (post_data) => {
  const urlPath = LIVE_URL;
  console.log('| postToLive sending to', urlPath);
  const response = await fetch(urlPath, {
    method: 'POST',
    body: post_data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  });
  const data = await response.text();
  if (response.ok) {
    console.log('| postToLive success:', data);
  } else {
    console.error('| postToLive failed:', response.status, data);
    throw new Error(`postToLive failed with status ${response.status}: ${data}`);
  }
};

const postToStaging = async (post_data, arg2, arg3) => {
  console.log('| postToStaging 1');
  const urlPath = 'http://localhost:9999/api/inbox';
  console.log('| postToStaging 2');
  const response = await fetch(urlPath, {
    method: 'POST', 
    body: post_data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': post_data.length
    }
  });
  const data = await response.text();
  console.log('| postToStaging 3 D');

  // TODO surface status of repaint effort to signal the frontend of success / failure
  if (response.ok) {
  console.log('| postToStaging 4');
    console.log(' postToStagingResponse: It worked!!!');
    console.log('| postToStaging RESPONSE FROM PHP text() ', data);
      
  } else {
  console.log('| postToStaging 5');
    console.log('postToStaging Response: It DID NOT WORK ', response.status);
    console.log('postToStaging Response: It DID NOT WORK data ', data);
  }
};
/**

  POST POST

  Send the post to the target host.
  This is the last step before it leaves the source app
  
  @param {object} targetConfig - host info for the target environment (host. port, path, etc
  @param {object} post - post to be sent to host env
  @param {function} cb - optional callback method to exectute after posting
*/
const postPost = async (targetConfig, post, cb) => {
  
  console.log('|  POST THE POST ');
  // COMPILE THE POST
  const publishDoc = await getCompiledPost(post)
    .then((publishDoc) => {
  
      var post_data = querystring.stringify({
        ApiKey: targetConfig.apiKey,
        PostPublishYear: post.publishYear,
        PostPublishMonth: post.publishMonth,
        IsLogging: targetConfig.isLoggingOn,
        PostSlug: post.slug,
        PostBody: publishDoc
      });    
      return postTheDamnDocument(post_data);

    });
}

/**
 * * GENERATE STAGING SITE
 * * */
server.get('/api/generatestaging', async (req, res) => {
  const publishedPosts = getPublishedPosts();
  const stagedPost = getStagedPost();
  const author = 'Sean Brookes';
  const targetConfig = {
    host: 'localhost',
    port: '9999',
    path: '/api/inbox',
    isLoggingOn: 'true',
    apiKey: '__DEV_KEY__'
  };

  const postsToStage = stagedPost ? [...publishedPosts, stagedPost] : publishedPosts;
  const postPromises = [];

  for (const postItem of postsToStage) {
    if (!postItem.author) postItem.author = author;
    const processedPostPromise = getCompiledPost(postItem)
      .then((postBody) => {
        const rawPostData = {
          ApiKey: targetConfig.apiKey,
          PostPublishYear: postItem.publishYear,
          PostPublishMonth: postItem.publishMonth,
          IsLogging: targetConfig.isLoggingOn,
          PostSlug: postItem.slug,
          PostBody: postBody
        };
        return postToStaging(querystring.stringify(rawPostData));
      })
      .catch((error) => {
        console.log('| processing staging post error ', error);
      });
    postPromises.push(processedPostPromise);
  }

  await Promise.all(postPromises);
  await generateHomePage(targetConfig, stagedPost);
  await generateFeed(targetConfig);
  copyStaticAssets();

  res.status(200).send({message: 'Staging generation complete.'});
});


server.get('/api/deploylive', async (req, res) => {
  const publishedPosts = getPublishedPosts();
  if (publishedPosts.length === 0) {
    return res.status(200).send({ message: 'No published posts to deploy.' });
  }

  const errors = [];
  const postPromises = publishedPosts.map(postItem => {
    if (!postItem.author) postItem.author = 'Sean Brookes';
    return getCompiledPost(postItem)
      .then(postBody => postToLive(querystring.stringify({
        ApiKey: LIVE_KEY,
        PostPublishYear: postItem.publishYear,
        PostPublishMonth: postItem.publishMonth,
        IsLogging: 'true',
        PostSlug: postItem.slug,
        PostBody: postBody
      })))
      .catch(err => {
        console.error(`| deploylive error for "${postItem.title}":`, err.message);
        errors.push({ title: postItem.title, error: err.message });
      });
  });

  await Promise.all(postPromises);
  await generateHomePage({ apiKey: LIVE_KEY, isLoggingOn: 'true' }, null, postToLive);
  await generateFeed({ apiKey: LIVE_KEY, isLoggingOn: 'true' }, postToLive);

  if (errors.length > 0) {
    res.status(207).send({ message: 'Deployed with some errors.', errors });
  } else {
    res.status(200).send({ message: `Deployed ${publishedPosts.length} posts to live.` });
  }
});


server.get('/api/stage/:id', async (req, res) => {
  const postId = req.params.id;
  let post;
  try {
    const data = fs.readFileSync(`./server/posts/${postId}.json`);
    post = JSON.parse(data);
  } catch (e) {
    return res.status(404).send({ message: 'Post not found' });
  }

  const existingStaged = getStagedPost();
  if (existingStaged && existingStaged.id !== postId) {
    return res.status(409).send({ message: 'A post is already staged', stagedPost: existingStaged });
  }

  const saveTimestamp = new Date().getTime();
  if (!post.publishDate) post.publishDate = new Date().toISOString();
  if (!post.publishYear) post.publishYear = new Date(post.publishDate).getFullYear();
  if (!post.publishMonth) post.publishMonth = new Date(post.publishDate).getMonth() + 1;
  if (!post.slug) post.slug = getSlug(post.title);

  post.status = 'staged';
  post.lastUpdate = saveTimestamp;
  if (!post.author) post.author = 'Sean Brookes';

  fs.writeFileSync(`./server/posts/${postId}.json`, JSON.stringify(post));

  try {
    const postBody = await getCompiledPost(post);
    const post_data = querystring.stringify({
      ApiKey: '__DEV_KEY__',
      PostPublishYear: post.publishYear,
      PostPublishMonth: post.publishMonth,
      IsLogging: 'true',
      PostSlug: post.slug,
      PostBody: postBody
    });
    await postToStaging(post_data);
    copyStaticAssets();
  } catch (e) {
    console.error('| /api/stage compile/send error', e);
  }

  res.status(200).send({ message: 'Post staged', post });
});


server.post('/api/publish', async (req, res) => {
  const post = req.body;
  const author = 'Sean Brookes';

  if (!post || !post.body) {
    return res.status(500).send({ message: 'not saved missing post body' });
  }
  if (!post.id) {
    return res.status(500).send({ message: 'not published missing post id' });
  }
  if (!post.slug) {
    post.slug = getSlug(post.title);
  }

  const publishDate = new Date();
  post.publishDate = publishDate;
  post.publishYear = publishDate.getFullYear();
  post.publishMonth = publishDate.getMonth() + 1;
  post.publishDay = publishDate.getDate();
  post.lastUpdate = publishDate;
  post.author = author;
  post.status = 'published';

  try {
    // 1. Compile post HTML
    const postBody = await getCompiledPost(post);

    // 2. Send to live server — if this fails we abort; nothing else should run
    await postToLive(querystring.stringify({
      ApiKey: LIVE_KEY,
      PostPublishYear: post.publishYear,
      PostPublishMonth: post.publishMonth,
      IsLogging: 'true',
      PostSlug: post.slug,
      PostBody: postBody
    }));

    // 3. Persist published status immediately after live succeeds
    // Strip compiled-only fields — they belong in the HTML output, not the source JSON
    const compiledFields = new Set(['markup', 'descriptionAttr', 'titleAttr', 'jsonLd', 'canonicalUrl', 'publishDateFormatted', 'updatedDateFormatted']);
    const postToSave = Object.fromEntries(Object.entries(post).filter(([k]) => !compiledFields.has(k)));
    fs.writeFileSync(`./server/posts/${post.id}.json`, JSON.stringify(postToSave));

    // 4. Mirror to staging and regenerate home pages — non-fatal, don't block response
    const postData = querystring.stringify({
      ApiKey: STAGING_KEY,
      PostPublishYear: post.publishYear,
      PostPublishMonth: post.publishMonth,
      IsLogging: 'true',
      PostSlug: post.slug,
      PostBody: postBody
    });
    postToStaging(postData).catch(err =>
      console.warn('| publish: staging mirror failed (non-fatal):', err.message)
    );
    generateHomePage({ apiKey: LIVE_KEY, isLoggingOn: 'true' }, null, postToLive).catch(console.error);
    generateHomePage({ apiKey: STAGING_KEY, isLoggingOn: 'true' }).catch(console.error);
    generateFeed({ apiKey: LIVE_KEY, isLoggingOn: 'true' }, postToLive).catch(console.error);
    generateFeed({ apiKey: STAGING_KEY, isLoggingOn: 'true' }).catch(console.error);

    res.status(200).send({ status: 200, message: 'published' });
  } catch (error) {
    console.error('| Publish flow failed:', error);
    res.status(500).send({ message: 'Publish flow failed.', details: error.message });
  }
});

server.post('/api/unpublish/:id', (req, res) => {
  const postId = req.params.id;
  const filePath = `./server/posts/${postId}.json`;
  if (!postId || !fs.existsSync(filePath)) {
    return res.status(404).send({ message: 'Post not found' });
  }
  try {
    const post = JSON.parse(fs.readFileSync(filePath));
    post.status = 'draft';
    post.lastUpdate = new Date().getTime();
    fs.writeFileSync(filePath, JSON.stringify(post));
    res.status(200).send({ message: 'Post unpublished', post });
  } catch (e) {
    res.status(500).send({ message: 'Failed to unpublish post', error: e.message });
  }
});

server.get('/api/repaintlive/:id', async (req, res) => {
  const postId = req.params.id;
  const filePath = `./server/posts/${postId}.json`;

  if (!postId || !fs.existsSync(filePath)) {
    return res.status(404).send({ message: 'Post not found' });
  }

  let post;
  try {
    post = JSON.parse(fs.readFileSync(filePath));
  } catch (e) {
    return res.status(500).send({ message: 'Failed to read post' });
  }

  if (post.status !== 'published') {
    return res.status(400).send({ message: 'Post must be published to repaint' });
  }

  // Record update timestamp without touching publishDate/publishYear/publishMonth/slug
  post.updatedDate = new Date().toISOString();
  post.lastUpdate = new Date().getTime();

  try {
    const compiledFields = new Set(['markup', 'descriptionAttr', 'titleAttr', 'jsonLd', 'canonicalUrl', 'publishDateFormatted', 'updatedDateFormatted']);
    fs.writeFileSync(filePath, JSON.stringify(
      Object.fromEntries(Object.entries(post).filter(([k]) => !compiledFields.has(k)))
    ));

    const postBody = await getCompiledPost(post);

    await postToLive(querystring.stringify({
      ApiKey: LIVE_KEY,
      PostPublishYear: post.publishYear,
      PostPublishMonth: post.publishMonth,
      IsLogging: 'true',
      PostSlug: post.slug,
      PostBody: postBody
    }));

    await postToStaging(querystring.stringify({
      ApiKey: STAGING_KEY,
      PostPublishYear: post.publishYear,
      PostPublishMonth: post.publishMonth,
      IsLogging: 'true',
      PostSlug: post.slug,
      PostBody: postBody
    }));

    copyStaticAssets();

    await generateHomePage({ apiKey: LIVE_KEY, isLoggingOn: 'true' }, null, postToLive);
    await generateHomePage({ apiKey: STAGING_KEY, isLoggingOn: 'true' });
    await generateFeed({ apiKey: LIVE_KEY, isLoggingOn: 'true' }, postToLive);
    await generateFeed({ apiKey: STAGING_KEY, isLoggingOn: 'true' });

    res.status(200).send({ message: `Repainted: ${post.title}`, updatedDate: post.updatedDate });
  } catch (error) {
    console.error('| repaintlive error:', error);
    res.status(500).send({ message: 'Repaint failed', details: error.message });
  }
});

server.get('*', (req, res) => {
  res.send('nothing here');
});

server.listen(PORT, () => {
  console.log('Graffiti Engine 4 server is running on port', PORT);
});