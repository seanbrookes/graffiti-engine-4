# Graffiti Engine 4

## stack
- [vite - build (Vue/js)](https://vitejs.dev/)
- vue 3
- [codemirror - code/markdown editor](https://codemirror.net/docs/guide/)
- [marked - convert markdown to html](https://marked.js.org/)
- [d3](https://d3js.org/)
- [showdown - markdown to html converter](https://github.com/showdownjs/showdown)
- [turndown - html to markdown](https://github.com/mixmark-io/turndown)
- [underscore - html template compilation](https://underscorejs.org/#template)

node v18

frontend default port 5173
```
$npm run dev 
```
post server:  port 4444
```
$node server/server.js
```

## painting posts 
This is resurected from previous versions of the engine so could use some revisting and updating
- for now it is functional again to get a post compiled and posted to the target  
   
On the server side it uses showdown to generate markup from the post.body (markdown string)
then underscore _.template to merge with base page template

```
  const converter = new showdown.Converter();
  const templateData = fs.readFileSync('./server/templates/postTemplate.html', 'utf8');
  var compiled = _.template(templateData);  
  post.markup = converter.makeHtml(post.body);  // referenced in the template
  const publishDoc = compiled(post);
```

## Staging 
Added another web server 'local-web-cloud' to allow for  staging and simulation of publish and render to confirm the post output site works and the new home page and post pages have been rendered
```
$npm run server/staging  // will start a web server on port 8888 pointing to <project-root>/local-web-cloud folder
```


Not part of the publish flow but needed as a utility sometimes
HTML to markdown converter
```
const convertedBody = turndownService.turndown(postBody);
```

localhost test input location
http://localhost/fourfivesix/inbox/inbox.php

[marked](https://github.com/markedjs/marked)
[Code mirror](https://codemirror.net/docs/)

interesting reads:  
[unicode and astral planes](https://www.opoudjis.net/unicode/unicode_astral.html)

[intro to codemirror](https://www.raresportan.com/how-to-make-a-code-editor-with-codemirror6/)

[attribution - loading svg spnner code pen](https://codepen.io/ronnidc/pen/qmyzwv)
[attribution - grey x svg (openclipart.org)](https://openclipart.org/download/324409/greyx.svg)

[Excalidraw](https://github.com/excalidraw/excalidraw)

VectorEditor is an external project called called inline-draw that must be opened and running on: localhost:3742
- it is based on a WebComponent wrapper around Excalidraw.  