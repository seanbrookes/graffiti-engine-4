module.exports = function(Posts) {
  var fs = require('fs');
  var _ = require('underscore');
  var http = require('http');
  var moment = require('moment');
  var querystring = require('querystring');

  var CONST = {
    ACTIVITY_LOGIN:'login',
    ACTIVITY_PUBLISH_POST:'publish post',
    ACTIVITY_REPAINT_POST: 'repaint post',
    ACTIVITY_CREATE_POST: 'create post',
    ACTIVITY_UPDATE_POST:'update post',
    ACTIVITY_ARCHIVE_POST:'archive post',
    ACTIVITY_DELETE_POST:'delete post',
    ACTIVITY_DELETE_ACTIVITY: 'delete activity',
    ACTIVITY_LOGOUT:'logout',
    ACTIVITY_GENERATE_HOME_PAGE: 'generate home page',
    ACTIVITY_CREATE_TARGET: 'create target',
    ACTIVITY_UPDATE_TARGET: 'update target',
    ACTIVITY_DELETE_TARGET: 'delete target',
    ACTIVITY_DESTROY_POST: 'destroy post',
    EVENT_CLIENT_WRITE_ACK: 'client write ack',
    EVENT_CLIENT_WRITE_FAIL: 'client write fail',
    POST_STATUS_ARCHIVED: 'archived',
    POST_STATUS_DELETED: 'deleted',
    POST_STATUS_PUBLISHED: 'published',
    POST_STATUS_REMOVED: 'removed',
    POST_STATUS_DRAFT: 'draft',
    POST_STATUS_SUPERSEDED: 'superseded',
    TEMPLATE_TYPE_POST:'post',
    TEMPLATE_TYPE_INDEX:'index',
    TEMPLATE_TYPE_HOME:'home',
    TEMPLATE_TYPE_ABOUT:'about',
    TEMPLATE_TYPE_SUPPORT:'support',
    TEMPLATE_TYPE_PRODUCTS:'products',
    TEMPLATE_TYPE_JSON: 'json',
    TEMPLATE_TYPE_NOT_FOUND: '404',
    TEMPLATE_TYPE_JS:'js',
    TEMPLATE_TYPE_CSS:'css'
  };


  // to templates must have been saved in the mongodb with each target
  // Graffiti Engine Introduction original notes
  function getIndexedTemplate(target, mode) {
    for (var i = 0;i < target.templates.length;i++) {
      if (target.templates[i].type === mode) {
        return target.templates[i].body;
      }
    }
  }

  /**
   *
   * Publish Post
   *
   *
   *
   * */
const publishPost = function(pubConfig, cb) {
    var postId = pubConfig.postId;
    var targetId = pubConfig.targetId;
    var Activity = Posts.app.models.Activity;

    // function logActivity(eventObj) {
    //   if (!eventObj.timestamp) {
    //     eventObj.timestamp = new Date().getTime();
    //   }
    //   Activity.create(eventObj, {},
    //     function(response) {
    //       return response;
    //     },
    //     function(error) {
    //       $log.warn('bad create Activity log', error);
    //       return;
    //     }
    //   );
    // }

    // make sure we have the arguements
    if (!postId || !targetId) {
      cb({message: 'insuficient number of args (postId or targetId missing)'});
      return;
    }



    // figure out which target(s) we are publishing to
    var Targets = Posts.app.models.Targets;
    Targets.find({ where: {id:targetId} }, function(err, tar) {

      // inside the Target find callback
      if (err) {
        cb({message: err});
        return;
      }

      var target = tar[0];
      /**
       *
       * We have a valid target to post to
       * now load the post
       *
       * */
      // get the post by id
      Posts.find({ where: {id:postId} }, function(err, posts) {
        if (err) {
          cb({message: err});
          return;
        }

        var post = posts[0];
        // generate the slug
        if (!post.slug) {
          post.slug = getSlug(post.title);
        }
        /**
         *
         * We have the post now load the template file
         *
         * */

        var tpl = getIndexedTemplate(target, CONST.TEMPLATE_TYPE_POST);

        if (!tpl) {
          throw new Error('No template found for target', target.title);
          return;
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

        // generate the compiled document
        var compiled = _.template(tpl);
        var publishDoc = compiled(post);

        /**
         *
         * Post the document to the target
         *
         * */
        var targetConfig = {
          host: target.host,
          port: target.port,
          path: target.inboxPath,
          apiKey: target.apikey
        };

        var pagePath = post.publishYear + '/' + post.publishMonth + '/' + post.publishDay;
        var fileName = post.slug + '.html';

        var post_data = querystring.stringify({
          'ApiKey': targetConfig.apiKey,
          'PageType': 'html',
          'FileName': fileName,
          'FileBody': publishDoc,
          'PagePath': pagePath,
          'PostBody': publishDoc
        });

        var post_options = {
          host: targetConfig.host,
          port: targetConfig.port,
          path: targetConfig.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': post_data.length
          }
        };

        /**
         *
         * Post it
         *
         * */
        var isPostSuccess = true;
        var post_req = http.request(post_options, function (res) {
          res.setEncoding('utf8');
          res.on('data', function (chunk) {
            var error = null;
            if (chunk.indexOf('success') < 0) {
              error = {
                message:chunk
              };
              isPostSuccess = false;
              cb(error, publishDoc);
              logActivity({
                activity:CONST.EVENT_CLIENT_WRITE_FAIL,
                data: {
                  postId: post.id,
                  title: post.title,
                  target: target.name,
                  error: error.message
                }
              });
            }

          });
          res.on('end', function() {
            if (isPostSuccess) {
              /**
               *
               * Successful post/write to client
               *
               * - update target last post date
               * - save the updated post
               *  - respond to client
               * - log the activity
               * - insert into published table
               *
               * */
              post.lastUpdate = new Date();
              post.publishDate = new Date();
              post.status = 'published';

              // update target last update
              target.lastPostPublish = new Date();
              Targets.upsert(target, {},
                function(response) {},
                function(error) {}
              );
              // final update do the publish state
              Posts.upsert(post, {},
                function(response) {
                  cb(null, response);
                },
                function(error) {
                  cb(error, 'warning: it looks like the post was written to the client but the db may not have been updated');
                }
              );
              logActivity({
                activity:CONST.EVENT_CLIENT_WRITE_ACK,
                data: {
                  postId: post.id,
                  title: post.title,
                  target: target.name
                }
              });
              var publishedObj = {
                postId:post.id,
                postTitle:post.title,
                publishDate:post.publishDate,
                pagePath:pagePath,
                targetId:target.id,
                targetHost:targetConfig.host,
                fileName:fileName,
                targetName:target.name
              };
              var Published = Posts.app.models.Published;
              Published.create(publishedObj, {},
                function(response) {},
                function(error) {
                  console.log(error, 'warning: the published record may not have been written');
                }
              );
            }


          });
        });
        post_req.write(post_data);
        post_req.end();

      });
    });
  };

  /**
   *
   * Remove (404) Post
   *
   *
   *
   * */
  // Posts.removePublished = function(removeConfig, cb) {
  //   var postId = removeConfig.postId;
  //   var targetId = removeConfig.targetId;
  //   var Activity = Posts.app.models.Activity;

  //   function logActivity(eventObj) {
  //     if (!eventObj.timestamp) {
  //       eventObj.timestamp = new Date().getTime();
  //     }
  //     Activity.create(eventObj, {},
  //       function(response) {
  //         return response;
  //       },
  //       function(error) {
  //         $log.warn('bad create Activity log', error);
  //         return;
  //       }
  //     );
  //   }

  //   // make sure we have the arguements
  //   if (!postId || !targetId) {
  //     cb({message: 'insuficient number of args (postId or targetId missing)'});
  //     return;
  //   }
  //   // load the target

  //   var Targets = Posts.app.models.Targets;
  //   Targets.find({ where: {id:targetId} }, function(err, tar) {
  //     if (err) {
  //       cb({message: err});
  //       return;
  //     }

  //     var target = tar[0];


  //     /**
  //      *
  //      * We have a valid target to post to
  //      * now load the post
  //      *
  //      * */
  //     Posts.find({ where: {id:postId} }, function(err, posts) {
  //       if (err) {
  //         cb({message: err});
  //         return;
  //       }

  //       var post = posts[0];

  //       /**
  //        *
  //        * We have the post now load the template file
  //        *
  //        * */

  //       //var tpl = target.pageNotFoundTemplate.html;
  //       var tpl = getIndexedTemplate(target, CONST.TEMPLATE_TYPE_NOT_FOUND);
  //       /**
  //        *
  //        * Establish the publish date
  //        * note this may not be valid in case
  //        * there is a failure in the flow
  //        *
  //        * */
  //       post.publishDate = new Date(post.publishDate);
  //       post.publishYear = post.publishDate.getFullYear();
  //       post.publishMonth = (post.publishDate.getMonth() + 1);
  //       post.publishDay = (post.publishDate.getDate());

  //       // generate the compiled document
  //       var compiled = _.template(tpl);
  //       var pageNotFoundDoc = compiled(post);

  //       /**
  //        *
  //        * Post the document to the target
  //        *
  //        * */
  //       var targetConfig = {
  //         host: target.host,
  //         port: target.port,
  //         path: target.inboxPath,
  //         apiKey: target.apikey
  //       };

  //       var post_data = querystring.stringify({
  //         'ApiKey': targetConfig.apiKey,
  //         'PostPublishYear': post.publishYear,
  //         'PostPublishMonth': post.publishMonth,
  //         'PostPublishDay': post.publishDay,
  //         'PostSlug': post.slug,
  //         'PageType': 'html',
  //         'FileName': post.slug + '.html',
  //         'FileBody': pageNotFoundDoc,
  //         'PagePath': post.publishYear + '/' + post.publishMonth + '/' + post.publishDay,
  //         'PostBody': pageNotFoundDoc
  //       });

  //       var post_options = {
  //         host: targetConfig.host,
  //         port: targetConfig.port,
  //         path: targetConfig.path,
  //         method: 'POST',
  //         headers: {
  //           'Content-Type': 'application/x-www-form-urlencoded',
  //           'Content-Length': post_data.length
  //         }
  //       };

  //       /**
  //        *
  //        * Post it
  //        *
  //        * */
  //       var isPostSuccess = true;
  //       var post_req = http.request(post_options, function (res) {
  //         res.setEncoding('utf8');
  //         res.on('data', function (chunk) {
  //           var error = null;
  //           if (chunk.indexOf('success') < 0) {
  //             error = {
  //               message:chunk
  //             };
  //             isPostSuccess = false;
  //             cb(error, publishDoc);
  //             logActivity({
  //               activity:CONST.EVENT_CLIENT_WRITE_FAIL,
  //               data: {
  //                 postId: post.id,
  //                 title: post.title,
  //                 target: target.name,
  //                 error: error.message
  //               }
  //             });
  //           }


  //         });
  //         res.on('end', function() {
  //           if (isPostSuccess) {

  //             /**
  //              *
  //              * Successful post/write to client
  //              *
  //              * - update target last post date
  //              * - save the updated post
  //              *  - respond to client
  //              * - log the activity
  //              * - insert into published table
  //              *
  //              * */
  //             post.lastUpdate = new Date();
  //             post.status = CONST.POST_STATUS_ARCHIVED;

  //             // final update do the publish state
  //             Posts.upsert(post, {},
  //               function(response) {
  //                 logActivity({
  //                   activity:CONST.POST_STATUS_ARCHIVED,
  //                   data: {
  //                     postId: post.id,
  //                     title: post.title
  //                   }
  //                 });
  //                 cb(null, response);
  //               },
  //               function(error) {
  //                 cb(error, 'warning: it looks like the post was written to the client but the db may not have been updated');
  //               }
  //             );
  //             logActivity({
  //               activity:CONST.EVENT_CLIENT_WRITE_ACK,
  //               data: {
  //                 postId: post.id,
  //                 title: post.title,
  //                 target: target.name
  //               }
  //             });
  //             var Published = Posts.app.models.Published;
  //             Published.destroyAll({postId:post.id,targetId:target.id}, {},
  //               function(response) {},
  //               function(error) {
  //                 console.log(error, 'warning: the published record may not have been removed');
  //               }
  //             );
  //           }


  //         });
  //       });
  //       post_req.write(post_data);
  //       post_req.end();

  //     });

  //   });
  // };

  /**
   *
   *
   * GENERATE INDEX PAGE
   *
   * - most recent post is full render
   * - next 5 are listed with summary if there is one
   * - remaining posts are listed as links with timestamps
   *
   * */
  Posts.generateHomePage = function(targetId, cb) {
    var Activity = Posts.app.models.Activity;
    function logActivity(eventObj) {
      if (!eventObj.timestamp) {
        eventObj.timestamp = new Date().getTime();
      }
      Activity.create(eventObj, {},
        function(response) {
          return response;
        },
        function(error) {
          $log.warn('bad create Activity log', error);
          return;
        }
      );
    }

    if (targetId) { // eg fourfivesix.ca
      /**
       *
       * Get the Target in question
       *
       * */
      var Targets = Posts.app.models.Targets;
      Targets.find({ where: {id:targetId} }, function(err, tar) {
        if (err) {
          cb(err);
          return;
        }

        var target = tar[0];
        // where we are posting the new home page
        var targetConfig = {
          host: target.host,
          port: target.port,
          path: target.inboxPath,
          apiKey: target.apikey
        };


        // get all the published posts for that target
        var Published = Posts.app.models.Published;
        Published.find({where: {'targetId':targetId}},function(err, published) {
          // gives us a collection of pub post ids
          var listOfPublishedIds = [];

          published.map(function(pubEntry) {
            listOfPublishedIds.push(pubEntry.postId);


          });

          Posts.find({where:{and: [{status: 'published'}, { id: { inq: listOfPublishedIds } }]}, order: 'publishDate DESC'}, function (err, dox) {
            if (err) {
              cb(err, null);
              return;
            }
            if (dox) {
              if (dox) {
                var listMarkup = '<ul class="Blog__HomePostList">';

                for (var i = 0; i < dox.length; i++) {
                  var post = dox[i];

                  var postLink = getPostLink(post);
                  var pDate = new Date(post.publishDate);
                  var publishDate = moment(pDate).format('MMM. D, YYYY') ;

                  listMarkup += '<li class="Layout Spread Flow">';


                  if (i > 2) {
                    listMarkup += '<a href="' + postLink + '"  class="Blog__HomePostTitle">';
                    listMarkup += post.title;
                    listMarkup += '</a><span>published: ' + publishDate  + '</span>';

                  }
                  else {
                    listMarkup += '<a href="' + postLink + '"><h3 class="Blog__HomePostTitle">';
                    listMarkup += post.title;
                    listMarkup += '</h3></a><span>published: ' + publishDate  + '</span>';
                    listMarkup += '<div>';
                    listMarkup += post.body;
                    listMarkup += '</div>';


                  }





                  listMarkup += '</li>';
                }
                listMarkup += '</ul>';

                var markup = {markup: listMarkup};
                var tpl = getIndexedTemplate(target, CONST.TEMPLATE_TYPE_INDEX);

                var compiled = _.template(tpl);

                var publishDoc = compiled(markup);

                var post_data = querystring.stringify({
                  'ApiKey': targetConfig.apiKey,
                  'PageType': 'html',
                  'FileName': 'index.html',
                  'FileBody': publishDoc,
                  'PagePath': ''
                });

                // An object of options to indicate where to post to
                var post_options = {
                  host: targetConfig.host,
                  port: targetConfig.port,
                  path: targetConfig.path,
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': post_data.length
                  }
                };

                var isPostSuccess = true;
                var post_req = http.request(post_options, function (res) {
                  res.setEncoding('utf8');
                  res.on('data', function (chunk) {
                    if (chunk.indexOf('success') < 0) {
                      isPostSuccess = false;

                      logActivity({
                        activity:CONST.EVENT_CLIENT_WRITE_FAIL,
                        data: {
                          target: target.name,
                          error: chunk
                        }
                      });
                      cb(chunk, []);
                      return;
                    }
                  });
                  res.on('end', function() {
                    if (isPostSuccess) {

                      target.lastIndexUpdate = new Date();
                      Targets.upsert(target, {},
                        function(response) {
                          cb(null, response);

                        },
                        function(error) {}
                      );
                      logActivity({
                        activity:CONST.EVENT_CLIENT_WRITE_ACK,
                        data: {
                          pageType: 'index',
                          target: target.name
                        }
                      });
                    }




                  });

                });
                post_req.write(post_data);
                post_req.end();


              }









            }
          });





         });

        function getPostLink(post) {
          var pDate = new Date(post.publishDate);
          var pubYear = pDate.getFullYear();
          var pubMonth = (pDate.getMonth() + 1);
          var pubDay = (pDate.getDate());
          return pubYear + '/' + pubMonth + '/' + pubDay + '/' + post.slug + '.html';
        }

      });
    }
    else {
      cb({message: 'generate index rquest with no target specified'}, []);
    }

  };



  /**
   *
   * Repaint Post
   *
   * */
  Posts.repaint = function(pubConfig, cb) {
    var postId = pubConfig.postId;
    var targetId = pubConfig.targetId;
    var Activity = Posts.app.models.Activity;
    function logActivity(eventObj) {
      if (!eventObj.timestamp) {
        eventObj.timestamp = new Date().getTime();
      }
      Activity.create(eventObj, {},
        function(response) {
          return response;
        },
        function(error) {
          $log.warn('bad create Activity log', error);
          return;
        }
      );
    }

    // make sure we have the arguements
    if (!postId || !targetId) {
      cb({message: 'insuficient number of args (postId or targetId missing)'});
      return;
    }
    // load the target

    var Targets = Posts.app.models.Targets;
    Targets.find({ where: {id:targetId} }, function(err, tar) {
      if (err) {
        cb({message: err});
        return;
      }

      var target = tar[0];
      /**
       *
       * We have a valid target to post to
       * now load the post
       *
       * */
      Posts.find({ where: {id:postId} }, function(err, posts) {
        if (err) {
          cb({message: err});
          return;
        }

        var post = posts[0];

        // generate the slug
        if (!post.slug) {
          post.slug = getSlug(post.title);
        }
        /**
         *
         * We have the post now load the template file
         *
         * */

        //var tpl = target.postTemplate.html;
        var tpl = getIndexedTemplate(target, CONST.TEMPLATE_TYPE_POST);

        /**
         *
         * Establish the publish date
         * note this may not be valid in case
         * there is a failure in the flow
         *
         * */
        //post.publishDate = new Date(post.publishDate);
        var dateObj = new Date(post.publishDate);
        post.publishYear = dateObj.getFullYear();
        post.publishMonth = (dateObj.getMonth() + 1);
        post.publishDay = (dateObj.getDate());

        // generate the compiled document
        var compiled = _.template(tpl);
        var publishDoc = compiled(post);

        /**
         *
         * Post the document to the target
         *
         * */
        var targetConfig = {
          host: target.host,
          port: target.port,
          path: target.postPath,
          apiKey: target.apikey
        };

        var pagePath = post.publishYear + '/' + post.publishMonth + '/' + post.publishDay;
        var fileName = post.slug + '.html';

        var post_data = querystring.stringify({
          'ApiKey': targetConfig.apiKey,
          'PageType': 'html',
          'FileName': fileName,
          'FileBody': publishDoc,
          'PagePath': pagePath

        });

        var post_options = {
          host: targetConfig.host,
          port: targetConfig.port,
          path: targetConfig.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': post_data.length
          }
        };

        /**
         *
         * Post it
         *
         * */
        var isPostSuccess = true;
         var post_req = http.request(post_options, function (res) {
          res.setEncoding('utf8');
          res.on('data', function (chunk) {
            var error = null;
            if (chunk.indexOf('success') < 0) {
              error = {
                message: chunk
              };
              isPostSuccess = false;

              cb(error, publishDoc);
              logActivity({
                activity: CONST.EVENT_CLIENT_WRITE_FAIL,
                data: {
                  postId: post.id,
                  title: post.title,
                  target: target.name
                }
              });
              return;
            }
          });
          res.on('end', function() {
            if (isPostSuccess) {
              logActivity({
                activity: CONST.EVENT_CLIENT_WRITE_ACK,
                data: {
                  postId: post.id,
                  title: post.title,
                  target: target.name
                }
              });
              var Published = Posts.app.models.Published;
              Published.find({},
                function(err, response) {
                  if (err) {
                    console.log('bad get published entries', err);
                  }
                  var isPostPublished = false;
                  for (var i = 0; i < response.length;i++) {
                    var pubItem = response[i];
                    if (String(pubItem.postId) === String(post.id)) {
                      if (String(pubItem.targetId) === String(target.id)){
                        isPostPublished = true;
                        break;
                      }
                    }
                  }
                  // recreate record if missing
                  if (!isPostPublished) {
                    var publishedObj = {
                      postId:post.id,
                      postTitle:post.title,
                      publishDate:post.publishDate,
                      targetId:target.id,
                      pagePath:pagePath,
                      fileName:fileName,
                      targetHost:targetConfig.host,
                      targetName:target.name
                    };
                    Published.create(publishedObj, {},
                      function(response) {},
                      function(error) {
                        console.log(error, 'warning: the published record may not have been written');
                      }
                    );
                  }
                });
              cb(null, 'post repainted');
            }


          });
        });
        post_req.write(post_data);
        post_req.end();


      });
    });
  };




  Posts.remoteMethod(
    'generateHomePage',
    {
      http: {path: '/genhomepage', verb: 'post'},
      accepts: {arg: 'targetId', type: 'string'},
      returns: {arg: 'status', type: 'string'}
    }
  );

  Posts.remoteMethod(
    'supersede',
    {
      http: {path: '/supersede', verb: 'post'},
      accepts: {arg: 'postId', type: 'string'},
      returns: {arg: 'status', type: 'string'}
    }
  );
  Posts.remoteMethod(
    'publish',
    {
      http: {path: '/publish', verb: 'post'},
      accepts: {arg: 'pubConfig', type: 'object'},
      returns: {arg: 'status', type: 'string'}
    }
  );
  Posts.remoteMethod(
    'removePublished',
    {
      http: {path: '/removepublished', verb: 'post'},
      accepts: {arg: 'removeConfig', type: 'object'},
      returns: {arg: 'status', type: 'string'}
    }
  );
  Posts.remoteMethod(
    'repaint',
    {
      http: {path: '/repaint', verb: 'post'},
      accepts: {arg: 'pubConfig', type: 'object'},
      returns: {arg: 'status', type: 'string'}
    }
  );


};


var getSlug = function (title) {

  // replace spaces with dashes

  // remove question marks

  var retVal = title;
  if (title.indexOf(' ') > -1) {
    retVal = replaceAll(' ', '-', title).toLowerCase();
  }
  return retVal;
};
function replaceAll(find, replace, str) {
  return str.replace(new RegExp(find, 'g'), replace);
}
function renderDate(dateInput, format) {
  var d_names = new Array("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday");

  var m_names = new Array("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December");

  var d = new Date(dateInput);
  var curr_day = d.getDay();
  var curr_date = d.getDate();
  var sup = "";
  if (curr_date == 1 || curr_date == 21 || curr_date == 31) {
    sup = "st";
  }
  else if (curr_date == 2 || curr_date == 22) {
    sup = "nd";
  }
  else if (curr_date == 3 || curr_date == 23) {
    sup = "rd";
  }
  else {
    sup = "th";
  }
  var curr_month = d.getMonth();
  var curr_year = d.getFullYear();

  retVal = m_names[curr_month] + " " + curr_date + "<SUP>" + sup + "</SUP> " + curr_year;
//            document.write(d_names[curr_day] + " " + curr_date + "<SUP>"
//                + sup + "</SUP> " + m_names[curr_month] + " " + curr_year);
  return retVal;
}





















  /**
   *
   *
   * SUPERSEDE
   *
   *
   *
   * 
  Posts.supersede = function(postId, cb) {
    function logActivity(eventObj) {
      if (!eventObj.timestamp) {
        eventObj.timestamp = new Date().getTime();
      }
      Activity.create(eventObj, {},
        function(response) {
          return response;
        },
        function(error) {
          $log.warn('bad create Activity log', error);
          return;
        }
      );
    }


    //   var postId = req.param('id', null);
    console.log('|');
    console.log('|');
    console.log('|  SUPERSEDE POST: ' + postId);
    console.log('|');
    console.log('|');

    if (postId) {
      // find the original post
      Posts.find({ where: {id:postId} }, function(err, posts) {
        if (err) {
          console.log('error requesting post for edit: ' + err);
          return res.send(500, err);
        }
        var post = posts[0];
        var originalVerion = 1;
        if (post.version) {
          originalVersion = post.version;
        }

        //var supersededTitle = post.title + ' version ' + originalVersion;
        // post.title = supersededTitle;
        // create new slug on original document
        //post.slug = getSlug(supersededTitle);


        if (!post.version) {
          post.version = 1;
        }
        // get the slug from the original - this will be the slug on new document
        var originalSlug = post.slug;
        var originalTitle = post.title;
        // get the version number from the original
        var originalVersion = post.version;
        // clone the original document to make a new document

        // create new title on original document based on 'version ' plus version number
        var supersededTitle = post.title + ' version ' + originalVersion;
        var supersededSlug = getSlug(supersededTitle);
        //post.title = supersededTitle;
        // create new slug on original document
        //post.slug = getSlug(supersededTitle);
        // change status on original to 'superseded'
        //post.status = 'superseded';
        // generate prepend message for original document
        var publishYear = new Date(post.publishDate).getFullYear();
        var publishMonth = (new Date(post.publishDate).getMonth() + 1);

        // get link to original document
        var postUrl = '/posts/' + publishYear + '/' + publishMonth + '/' + originalSlug + '.html';
        var supersededMessage = '<p class="supersession-message">This document has been superseded by an updated version the latest version can be found here:<a href="' + postUrl + '" target="_new">' + originalTitle + '</a></p>';
        // prepend update message fragment to post body on original document
        var supersededBody = supersededMessage + post.body;

        var supersededUrl = '/posts/' + publishYear + '/' + publishMonth + '/' + supersededSlug + '.html';

        // generate update fragment for new doc
        var orderVersionMessage = '<ul class="supersession-message"><li>Previous version: <a href="' + supersededUrl + '" target="_new">' + post.title + '</a></li></ul>';


        var supersedeModel = {
          userId: post.userId,
          title: supersededTitle,
          slug: supersededSlug,
          summary: post.summary,
          version: originalVersion,
          body: supersededBody,
          publishDate: new Date(post.publishDate),
          status: 'superseded'

        };


        // append update fragment to new doc
        post.body = post.body + orderVersionMessage;

        // update version on new document
        post.version += 1;
        // update the status to 'pendingedits'
        post.status = 'pendingedits';
        // save original document
        //console.log('Prepare to save post: ' + JSON.stringify(supersedeModel));
        delete supersedeModel._id;
        Posts.updateOrCreate(supersedeModel, {}, function(err, doc) {
          if (err) {
            return res.send(500, 'Error saving superseded post: ' + err);
          }
          // post it to the site
          //postPost(req, res, doc);
          postPost(doc, function (doc) {});
          // save new document
//        console.log('|');
//        console.log('|');
//        console.log('|');
//        console.log('|');
//        console.log('Prepare to save new post: ' + JSON.stringify(post));
//        console.log('|');
//        console.log('|');
//        console.log('|');
//        console.log('|');
//        console.log('|');
//        console.log('|');
          delete post._id;
          Posts.updateOrCreate(post, {}, function(err, doc) {
            if (err) {
              return res.send(500, 'Error saving new version of document: ' + err);
            }
            // return it in the response
            return res.send(doc);
          });

        });
      });
    }
    else {
      return res.send(400, 'no id supplied');
    }
  };

*/
