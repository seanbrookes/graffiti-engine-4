<script setup>
import { ref, inject, reactive, watch, computed, onMounted } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import {EditorState} from "@codemirror/state"
import { marked } from 'marked';
import { mangle } from "marked-mangle";
import { gfmHeadingId } from "marked-gfm-heading-id";

const markedOptions = {
  prefix: 'gfe-',
};

const store = inject('store');

let editor = {};
let currentHTML = '';
let currentView = 'editor';
const isAutoSaveRef = ref();

const setTabView = (event) => {
  const value = event.target.value;
  currentView = value;
  renderCodeMirror();

};

let isAutoSave = ref(true);

setTimeout(() => {
  console.log('| Timeout firing -- now --');
  // renderCodeMirror();

}, 2000);
const previewEl = ref(null);
const editorEl = ref(null);

const renderCodeMirror = () => {
  console.log('| renderCodeMirror currentView ', currentView);
  /**
   * 
   *  MARKED EDITOR
   * 
   * 
   */

  if (currentView === 'preview') {
    const editorEl = document.getElementById('editor');
    marked.use(mangle());
    marked.use(gfmHeadingId(markedOptions));
    const currentHTML = marked.parse(store?.state?.currentPost?.body);    
    previewEl.value.innerHTML = currentHTML;

  }
  else {
  /**
   * 
   *  CODE MIRROR EDITOR
   * 
   * 
   */
   const code_mirror_el = document.getElementById('code_mirror_editor_el');
   previewEl.value.innerHTML = null;
    // let view = new EditorView({
    //   doc: store?.state?.currentPost?.body,
    //   extensions: [basicSetup, javascript()],
    //   parent: el
    // });
    // editor.refresh();
    const editorValue = editor.state.doc.toString();
    editor.dispatch({
          changes: {
            from: 0,
            to: editorValue.length,
            insert: store?.state?.currentPost?.body || "",
          },
        })
    // else {
    //   console.warn('|  code mirror render called but no code mirror element');
    // }

  }

};
let sync_val = null;
const editorState = EditorState.create({
            doc: store?.state?.currentPost?.body,
            extensions: [
                EditorView.updateListener.of(function(e) {
                    sync_val = e.state.doc.toString();
                }),
                basicSetup, markdown(),
            ]
        });

onMounted(() => {
  console.log('| onMounted firing -- now -- title? ',  store?.state?.currentPost?.title);
  console.log('| onMounted firing -- currentView ',  currentView );
  editor = new EditorView({
        state: editorState,  
        // doc: store?.state?.currentPost?.body,
        // extensions: [basicSetup, markdown()],
        parent: editorEl.value
      });  
});
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
watch(isAutoSave, (value) => {
  console.log('|');
  console.log('|  it is working isAutoSave ', isAutoSave.value);
  console.log('|');
});
watch(currentPost, (value) => {
  console.log('|');
  // console.log('|  WE HAVE A BODY ', value);
  renderCodeMirror();
  console.log('|');
});

const toggleAutoSave = (event) => {
  console.log('|');
  console.log('| toggle auto save isAutoSaveRef.checked ', isAutoSaveRef.checked);
  console.log('|');
}



const clearNew = () => {
  if (confirm('clear this post?')) {
    document.location.href = '/';
  }
};


</script>
<template>
  <div>Post Editor</div>
  <button @click="clearNew">clear</button>
  <button value="editor" @click="setTabView">editor</button>
  <button value="preview" @click="setTabView">preview</button>

  <h1 v-if="currentView === 'editor'">CodeMirror</h1>
  <h1 v-else>preview</h1>
  <!-- marked preview -->
  <div id="editor" ref="previewEl"></div>  
  <div data-id="editor_view_container">
    <!-- codemirror edting -->
    <div id="code_mirror_editor_el" ref="editorEl"></div>

  </div>
  <div>
    <button>save</button>
    <label>autosave<input type="checkbox" ref="isAutoSaveRef" v-model="isAutoSave" /></label>
  </div>
</template>
<style scoped>
[data-id="editor_view_container"] {
  border: 1px solid #eeeeee;
  max-height: 500px;
  overflow-y: scroll;
}
</style>