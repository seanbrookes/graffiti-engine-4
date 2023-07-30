import express from 'express';
import fs from 'fs';
import http from 'http';
import cors from 'cors';
import TurndownService from 'turndown';
import _ from 'lodash';
import showdown from 'showdown';
import querystring from 'querystring';
import fetch from 'node-fetch';
import { parse } from 'parse5';




import config from './config.js';
/**
 * This is the main backend file for GE
 * I handles fetching, saving, editing, publishing, painting, etc for the local post data
 */


function toJSON(node) {
  let propFix = { for: 'htmlFor', class: 'className' };
  let specialGetters = {
    style: (node) => node.style.cssText,
  };
  let attrDefaultValues = { style: '' };
  let obj = {
    nodeType: node.nodeType,
  };
  if (node.tagName) {
    obj.tagName = node.tagName.toLowerCase();
  } else if (node.nodeName) {
    obj.nodeName = node.nodeName;
  }
  if (node.nodeValue) {
    obj.nodeValue = node.nodeValue;
  }
  let attrs = node.attributes;
  if (attrs) {
    let defaultValues = new Map();
    for (let i = 0; i < attrs.length; i++) {
      let name = attrs[i].nodeName;
      defaultValues.set(name, attrDefaultValues[name]);
    }
    // Add some special cases that might not be included by enumerating
    // attributes above. Note: this list is probably not exhaustive.
    switch (obj.tagName) {
      case 'input': {
        if (node.type === 'checkbox' || node.type === 'radio') {
          defaultValues.set('checked', false);
        } else if (node.type !== 'file') {
          // Don't store the value for a file input.
          defaultValues.set('value', '');
        }
        break;
      }
      case 'option': {
        defaultValues.set('selected', false);
        break;
      }
      case 'textarea': {
        defaultValues.set('value', '');
        break;
      }
    }
    let arr = [];
    for (let [name, defaultValue] of defaultValues) {
      let propName = propFix[name] || name;
      let specialGetter = specialGetters[propName];
      let value = specialGetter ? specialGetter(node) : node[propName];
      if (value !== defaultValue) {
        arr.push([name, value]);
      }
    }
    if (arr.length) {
      obj.attributes = arr;
    }
  }
  let childNodes = node.childNodes;
  // Don't process children for a textarea since we used `value` above.
  if (obj.tagName !== 'textarea' && childNodes && childNodes.length) {
    let arr = (obj.childNodes = []);
    for (let i = 0; i < childNodes.length; i++) {
      arr[i] = toJSON(childNodes[i]);
    }
  }
  return obj;
}

function toDOM(input) {
  let obj = typeof input === 'string' ? JSON.parse(input) : input;
  let propFix = { for: 'htmlFor', class: 'className' };
  let node;
  let nodeType = obj.nodeType;
  switch (nodeType) {
    // ELEMENT_NODE
    case 1: {
      node = document.createElement(obj.tagName);
      if (obj.attributes) {
        for (let [attrName, value] of obj.attributes) {
          let propName = propFix[attrName] || attrName;
          // Note: this will throw if setting the value of an input[type=file]
          node[propName] = value;
        }
      }
      break;
    }
    // TEXT_NODE
    case 3: {
      return document.createTextNode(obj.nodeValue);
    }
    // COMMENT_NODE
    case 8: {
      return document.createComment(obj.nodeValue);
    }
    // DOCUMENT_FRAGMENT_NODE
    case 11: {
      node = document.createDocumentFragment();
      break;
    }
    default: {
      // Default to an empty fragment node.
      return document.createDocumentFragment();
    }
  }
  if (obj.childNodes && obj.childNodes.length) {
    for (let childNode of obj.childNodes) {
      node.appendChild(toDOM(childNode));
    }
  }
  return node;
}









// TODO - this will need to be more dynamic
const PORT = 4444;

const server = express();
server.use(express.json());
// server.use(express.urlencoded({ extended: true }));
/*

So, bodyParser.json() and bodyParser.urlencoded() are built into Express as express.json() and express.urlencoded() so you don't have to import body-parser at all.
*/
// server.use(bodyParser.urlencoded({ extended: true }));
// server.use(bodyParser.json());
// server.use(bodyParser.raw());
server.use(cors());
const converter = new showdown.Converter();

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



/* 

  GET THE POSTS

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
    try {
      // files object contains all files names
      files.forEach(file => {
        // console.log('reading file', file);
        try {
          const data = fs.readFileSync('./server/posts/' + file);
          postCollection.push(JSON.parse(data));
        } catch (err) {
          console.error('| build list of posts', err);
          returnError = err;
        }
      });
    }
    catch(error) {
      console.log('| Error iterating over the files', error);
      returnError = error;
    }
  }

  if (returnError) {
    res.status(500)
    res.send({error: returnError.message});
  }
  else {
    res.send(JSON.stringify(postCollection));
  }
});

/* 

  GET SINGLE POST

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



/* 

  SAVE POST

*/
server.post('/api/posts', (req, res) => {
  const targetPost = req.body;
  console.log('| SAVE POST req ', req.body);
  const saveTimestamp = new Date().getTime();
  if (!targetPost || !targetPost.body) {
    res.status = 500
    res.send({message: 'not saved missing post body'});
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
    res.send({status: 200, message: 'saved'});
  });

});

/* 

  PAINT POST


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
        'ApiKey': 'luhlkj',
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
      // save this post
      /*
      write the file
      */
      // fs.writeFile(`./server/posts/${post.id}.json`, JSON.stringify(post), err => { 
            
      //   // Checking for errors 
      //   if (err) throw err;  
  
      //   //  console.log("Done writing"); // Success 
      //   res.send({status: 200, message: 'published'});
      // });
    });
      // Set up the request
      /*
       *
       *
       *  POST PUBLISH DOCUMENT TO INBOX
       *
       * Request
       *
       *
       * */
  
      // console.log('| here |  the doc to post: ' + publishDoc);
      // var post_req = http.request(post_options, function (res) {
      //   res.setEncoding('utf8');
      //   res.on('data', function (chunk) {
      //     //console.log('| ');
      //     console.log('PAINT Response: It worked!!!');
      //     //console.log('| ');
      //   });
      // });
      // post_req.write(post_data);
      // post_req.end();























      /*
      write the file
      */
      // fs.writeFile(`./server/posts/${freshPost.id}.json`, JSON.stringify(freshPost), err => {          
      //   // Checking for errors 
      //   if (err) throw err;  
      //   res.send({status: 200, message: 'saved'});
      // });

    });
  }
  else {
    res.sendStatus(404);
    //res.send({status: 404, message: 'resource not found'});
  }

  

});


/**
 * 
 * COMPILE POST FROM TEMPLATE
 * 
 * Takes the post as json object and converts into a valid html document
 * It loads the post template file
 * establishes publish year and publish month 
 * converts the markdown to html
 * compiles the markup fragment into the html doc
 * returns the doc
 * 
 * Note this is async so needs to run as a promise.
 * This isn't ideal as it forces us to contort the calling logic and embed within this 
 * function execution scope.  not ideal but not the end of th world for now
 * 
 * @param {object} post - raw json version of post including metadata
 * @returns {string} - fully compiled/valie html document
 */
const getCompiledPost = async (post) => {
  const templateData = fs.readFileSync('./server/templates/postTemplate.html', 'utf8');
  var pubDate = new Date(post.publishDate);
  console.log(`| getCompiledPost pubDate ${pubDate}`);

  post.publishYear = post.publishDate.getFullYear();
  console.log(`| getCompiledPost post.publishYear ${post.publishYear}`);
  post.publishMonth = (post.publishDate.getMonth() + 1);
  console.log(`| getCompiledPost post.publishMonth ${post.publishMonth}`);

  post.markup = converter.makeHtml(post.body);
  console.log(`| getCompiledPost post.markup ${post.markup}`);

  var compiled = _.template(templateData);

  const publishDoc = compiled(post);
 //  console.log(`| getCompiledPost publishDoc ${publishDoc}`);

  return publishDoc;
/*  return fs.readFile('./server/templates/postTemplate.html', 'utf8', function (err, tpl) {
    if (err) {
      return console.log(` getCompiledPost Error loading post template source file: ${err}`);
    }
    var pubDate = new Date(post.publishDate);
    console.log(`| getCompiledPost pubDate ${pubDate}`);

    post.publishYear = post.publishDate.getFullYear();
    console.log(`| getCompiledPost post.publishYear ${post.publishYear}`);
    post.publishMonth = (post.publishDate.getMonth() + 1);
    console.log(`| getCompiledPost post.publishMonth ${post.publishMonth}`);

    post.markup = converter.makeHtml(post.body);
    console.log(`| getCompiledPost post.markup ${post.markup}`);

    var compiled = _.template(tpl);

    const publishDoc = compiled(post);
   //  console.log(`| getCompiledPost publishDoc ${publishDoc}`);

    return publishDoc;
  });
  */
};

const postTheDamnDocument = async (post_data, arg2, arg3) => {
  console.log(`| postTheDamnDocument A`);
//  const urlPath = 'http://localhost:8888/api/inbox';
  const urlPath = 'http://localhost/fourfivesix/inbox/inbox.php';
  console.log(`| postTheDamnDocument B`);
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
      // console.log('|  promise after compile publishDoc', publishDoc);




      // var post_data = querystring.stringify({
      //   'ApiKey': targetConfig.apiKey,
      //   'PostPublishYear': post.publishYear,
      //   'PostPublishMonth': post.publishMonth,
      //   'PostSlug': post.slug,
      //   'PostBody': publishDoc
      // });
    
      // var post_data = {
      //   ApiKey: targetConfig.apiKey,
      //   PostPublishYear: post.publishYear,
      //   PostPublishMonth: post.publishMonth,
      //   PostSlug: post.slug,
      //   PostBody: publishDoc
      // };    
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
server.post('/api/publish', (req, res) => {
  const post = req.body;
  const author = 'Sean Brookes';
  if (!post || !post.body) {
    res.sendStatus(500);
    res.send({message: 'not saved missing post body'});
  }

  if (!post.id) {
    res.sendStatus(500);
    res.send({message: 'not published missing post id'});
  }
  if (!post.slug) {
    post.slug = getSlug(post.title);
  }

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
  post.author = author;
  post.status = 'published';
  post.isLogging = 'true';
  post.apiKey = 'eDj4Ax0KZyk8fHe6MpJHKgBkw8JDXKtO';

  var targetConfig = {
    host: 'localhost',
    port: '8888',
    path: '/api/inbox',
    isLoggingOn: 'true',
    apiKey: 'eDj4Ax0KZyk8fHe6MpJHKgBkw8JDXKtO'
  };
  postPost(targetConfig, post, (err, doc) => {
    console.log('|  publish callback ', post.title);
    // save this post
    /*
    write the file
    */
    fs.writeFile(`./server/posts/${post.id}.json`, JSON.stringify(post), err => { 
          
      // Checking for errors 
      if (err) throw err;  

      //  console.log("Done writing"); // Success 
      res.send({status: 200, message: 'published'});
    });
  });



});





























/*

  Older custom methods

  not in main use


*/

server.get('/api/doit', (req, res) => {
  console.log('made it this far');
  const dir = './server/posts/';

  let alreadyExistingFiles = [];
  console.log('A');
  // list all files in the directory
  try {
      const files = fs.readdirSync(dir);
      console.log('B');
      // files object contains all files names
      files.forEach(file => {
        // console.log('reading file', file);
        try {
          const data = fs.readFileSync('./server/posts/' + file);
        //  console.log('original ', data);
          const subjectPost = JSON.parse(data);
        //  console.log('original ', subjectPost.lastUpdate);

          const testData = new Date(subjectPost.lastUpdate);
        //  console.log('testData', testData.getTime());
          subjectPost.lastUpdate = testData.getTime();

          //data.lastUpdate = new Date(subjectPost.lastUpdate).getTime();
     //     console.log('file last update', subjectPost.lastUpdate);
          alreadyExistingFiles.push(subjectPost);
        } catch (err) {
            console.error(err);
        }

      });

  } catch (err) {
      console.log(err);
  }
  console.log('C');
  alreadyExistingFiles.map((freshPost) => {
    // fs.writeFile(`./posts/${freshPost.id}.json`, JSON.stringify(freshPost), err => { 
      
    //   // Checking for errors 
    //   if (err) throw err;  
    
    //   console.log("Done writing"); // Success 
    //   // res.send({status: 200, message: 'saved'});
    // });
  
  });
      
   // console.log('posts', posts);
  res.send({message:'we are done'});
});

server.get('/api/convert-once', (req, res) => {

  console.log('| This was used once to convert old markup fragments to markdown it is only here for reference');
  
  
  // get list of all the posts
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
    try {
      const turndownService = new TurndownService();


      // files object contains all files names
      files.forEach(file => {
        // console.log('reading file', file);
        // loop over them

        // for each post

        // check if it has html body

        // if it has html it must be converted

        // call markdow service on the body

        // if all is good then resave the file

        try {
          const fileData = fs.readFileSync('./server/posts/' + file);
          if (fileData) {
            const parsedFileData = JSON.parse(fileData);
            const postBody = parsedFileData.body;
            const postTitle = parsedFileData.title;
            if (postBody) {
              if (postBody.startsWith('<')) {
                console.log('|');
               // console.log('|  NEW POST');
                console.log('|');
              //  console.log('|  before:  ', postBody);
                console.log('|');
    
                // convert HTML to Markdown
                const convertedBody = turndownService.turndown(postBody);
    
                console.log('|');
                console.log('|  after:  ', convertedBody);
                console.log('|');
                parsedFileData.body = convertedBody;

                // now resave the file
                // fs.writeFile(`./server/posts/${parsedFileData.id}.json`, JSON.stringify(parsedFileData), err => { 
      
                //   // Checking for errors 
                //   if (err) throw err;  
                
                // //  console.log("Done writing"); // Success 
                //   console.log('|');
                //   console.log('|  SAVED:  ');
                //   console.log('|');
                // });      
              }
              else {
                console.log('|');
                console.log('|  NOT THIS ONE');
                console.log('|');
                console.log('|    ', postTitle);
                console.log('|');
      
              }
    
            }
            else {
              console.log('|');
              console.log('|  ', postTitle);
              console.log('|  Something no body on this file');
              console.log('|');            
            }
          }
          else {
            console.log('|');
            console.log('| no file data', file);
            console.log('|');
          }

        } catch (err) {
          console.error('|  list of posts', err);
          returnError = err;
        }
      });
    }
    catch(error) {
      console.log('| Error iterating over the files', error);
      returnError = error;
    }
  }

  if (returnError) {
    res.status(500)
    res.send({error: returnError.message});
  }
  else {
    res.send('all good');
  }





});
server.get('*', (req, res) => {
  res.send('nothing here');
});






server.listen(PORT, () => {
  console.log('Graffiti Engine 4 server is running on port', 4444);
});
