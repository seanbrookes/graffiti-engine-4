<script setup>
import { ref, inject, reactive, watch, computed, onMounted } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';

import { marked } from 'marked';
import { mangle } from "marked-mangle";
import { gfmHeadingId } from "marked-gfm-heading-id";

const markedOptions = {
  prefix: 'gfe-',
};

const store = inject('store');

let editor = {};
let currentHTML = '';
setTimeout(() => {
  console.log('| Timeout firing -- now --');
  marked.use(mangle());
  marked.use(gfmHeadingId(markedOptions));
  const currentHTML = marked.parse(store?.state?.currentPost?.body);
  document.getElementById('editor').innerHTML = currentHTML;

  const code_mirror_el = document.getElementById('code_mirror_editor_el');
  // let view = new EditorView({
  //   doc: store?.state?.currentPost?.body,
  //   extensions: [basicSetup, javascript()],
  //   parent: el
  // });
  let view = new EditorView({
    doc: store?.state?.currentPost?.body,
    extensions: [basicSetup, markdown()],
    parent: code_mirror_el
  });  

}, 2000);

// onMounted(() => {
//   console.log('| onMounted firing -- now -- ',  store?.state?.currentPost?.body);
//   if (store?.state?.currentPost?.body) {
//     document.getElementById('editor').innerHTML = currentPostDom;
//   }
// });

const currentPostDom = computed(() => {
  console.log("computed currentPostDom");
  let currentHTML = null;
  if (store?.state?.currentPost?.body) {
    marked.use(mangle());
    marked.use(gfmHeadingId(markedOptions));
    currentHTML = marked.parse(store?.state?.currentPost?.body);
  }
  return currentHTML;
});

const currentPost = computed(() => {
  console.log('| computed currentPost');
  return store?.state?.currentPost?.body;
});

</script>
<template>
  <div>Post Editor</div>
  <div id="code_mirror_editor_el"></div>

  <!-- Create the editor container -->
  <div id="editor"></div>
  <hr />
  <div>{{ currentPostDom }}</div>
  <hr />
  <div>{{ currentPost }}</div>
</template>