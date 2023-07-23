# Post Editor

Some decisions to make

- Markdown support
- Also html support in order to do some coding 
- Theoretically we can create rich javascript / html pages and deploy them as static pages
- Need to have a predictable dom element/attribute structure in order to anchor the js code Is this correct? Or can we use some other relative reference like ‘current parent’ element append 
- or possibly a predefined template pattern based on the id of the post to create a unique but derivable id  -- reference available to each deployed page?  
-- Preview toggle/realtime  
-- Autosave option  


Implementations notes
- takes a string as input - default is empty string
- string can be serialized markdown or html/dom fragment
- detect which one
- render an editable version of the content
- can user switch between content types (md vs. html)
-- seems you could go one way but not the other
-- once you convert html to markdown there isn't a way to preserve any specific attributes on the generated markup
- on 'create new doc' moment, user should indicate what type of editing / conent they are working in
- default should be markdown with an option to go into 'javascript' mode - aka html mode
-- the implication here is we will need to expand upon the implementation separately


html edit mode could be as simple as inline code editing ala code pen with an inline interpreter
- at publish time all the js and dom structure is frozen - aka no evaluation expressions
