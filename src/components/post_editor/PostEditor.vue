<script setup>
import { ref, inject, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import {EditorState} from "@codemirror/state"
import { marked } from 'marked';
import { mangle } from "marked-mangle";
import { gfmHeadingId } from "marked-gfm-heading-id";
import { clearNew } from '../../ge4-helpers';

const markedOptions = {
  prefix: 'gfe-',
};

const componentState = reactive({
  isSaving: false,
  isShowPreview: false,
  previewToggleText: 'preview',
  currentPostTitle: '',
  isActivelyEditing: false,
});

const DEFAULT_AUTOSAVE_MS = 60000;
let autosaveTimerRef = ref(null);
let autoSaveTimerDelay = ref(null);
let autosaveIndicator = ref(null);
let postTitleInputEl = ref(null);


const store = inject('store');

let editor = {};
let currentHTML = '';
let currentView = 'editor';
const isAutoSaveRef = ref();

// TODO this is sloppy
const toggleTabView = () => {
  componentState.isShowPreview = !componentState.isShowPreview;
  renderCodeMirror();
};

let isAutoSave = ref(true);



const previewEl = ref(null);
const editorEl = ref(null);

const renderCodeMirror = () => {
  console.log('| renderCodeMirror componentState.isShowPreview ', componentState.isShowPreview);
  /**
   * 
   *  MARKED EDITOR
   * 
   * 
   */
  if (componentState.isShowPreview) {
    componentState.previewToggleText = 'edit';
    const editorEl = document.getElementById('editor');
    marked.use(mangle());
    marked.use(gfmHeadingId(markedOptions));
    const currentHTML = store?.state?.currentPost?.body ? marked.parse(store?.state?.currentPost?.body) : '';    
    previewEl.value.innerHTML = currentHTML;

  }
  else {
    previewEl.value.innerHTML = null;
  }
  /**
   * 
   *  CODE MIRROR EDITOR
   * 
   * 
   */
  const code_mirror_el = document.getElementById('code_mirror_editor_el');  
  componentState.currentPostTitle = store?.state?.currentPost?.title;
  const editorValue = editor.state.doc.toString();
  editor.dispatch({
    changes: {
      from: 0,
      to: editorValue.length,
      insert: store?.state?.currentPost?.body || "",
    },
  });
};
let sync_val = null;
const initialEditorState = {
  doc: store?.state?.currentPost?.body,
  extensions: [
    EditorView.updateListener.of(function(e) {
      sync_val = e.state.doc.toString();
    }),
    basicSetup, markdown(),
  ]
};
const editorState = EditorState.create(initialEditorState);

onMounted(() => {
  autoSaveTimerDelay = DEFAULT_AUTOSAVE_MS;

  // initialize codemirror editor
  editor = new EditorView({
    state: editorState,  
    parent: editorEl.value
  });
  // start autosave
  if (isAutoSave && (typeof autosaveTimerRef !== 'number')) {
    autosaveTimerRef = setInterval(savePost, autoSaveTimerDelay);
  }

  document.addEventListener('visibilitychange', function(event) {
    if (document.hidden) {
      console.log('| GE4 tab is hidden - pausing autosave');
      clearTimeout(autosaveTimerRef);
    } else {
      if (isAutoSave) {      
        console.log('| GE4 tab is visible - restarting autosave');
        autosaveTimerRef = setInterval(savePost, autoSaveTimerDelay);
      }
    }
  });
  document.addEventListener('keypress', typingStatus);

  document.querySelector('[data-id="editor_input_container"]').style.resize = 'vertical';
});

const typingStatus = () => {
  // set type status to active
  componentState.isActivelyEditing = true;
  // reset timer to turn typing status active to false
  setTimeout(() => {
    componentState.isActivelyEditing = false;
  }, 6000);
};

onUnmounted(() => {
  document.removeEventListener('keypress', typingStatus);   
});

const currentPost = computed(() => {
  return store?.state?.currentPost?.body;
});
watch(isAutoSave, (value) => {

  if (!isAutoSave.value) {
    clearTimeout(autosaveTimerRef);
  }
  else {
    autosaveTimerRef = setInterval(savePost, autoSaveTimerDelay);
  }
});
watch(currentPost, (value) => {
  renderCodeMirror();
  doTheSvg();
});


const setSaveIndicator = (value) => {
  componentState.isSaving = value;
};

const savePost = () => {
  if (componentState.isActivelyEditing) {
    return;
  }
  if (sync_val) {
    setSaveIndicator(true);
    store.methods.updateCurrentPostTitle(componentState.currentPostTitle);
    store.methods.updateCurrentPostBody(sync_val);
    store.methods.saveCurrentPost();

    setTimeout(() => {
      setSaveIndicator(false);
    }, 3000)
  }
};

const openVectorEditor = () => {
  store.methods.openVectorEditor();
};




let arc = ref(null);


function degToRad (degrees) {
  return degrees * Math.PI / 180;
}

// Returns a tween for a transition’s "d" attribute, transitioning any selected
// arcs from their current angle to the specified new angle.
function arcTween(newAngle, angle) {
  return function(d) {
    var interpolate = d3.interpolate(d[angle], newAngle);
    return function(t) {
      d[angle] = interpolate(t);
      return arc(d);
    };
  };
}

const animationTime = 1200;
const loaderRadius = 6;
const loaderColor = '#ccc';

const doTheSvg = () => {
  arc = d3.arc()
    .innerRadius(0)
    .outerRadius(loaderRadius);

var svg = d3.select("#thesvg"),
    width = +svg.attr("width"),
    height = +svg.attr("height"),
    g = svg.append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

var loader = g.append("path")
    .datum({endAngle: 0, startAngle: 0})
    .style("fill", loaderColor)
    .attr("d", arc);

d3.interval(function() {
  loader.datum({endAngle: 0, startAngle: 0})
  
  loader.transition()
      .duration(animationTime)
      .attrTween("d", arcTween(degToRad(360), 'endAngle'));
  
   loader.transition()
      .delay(animationTime)
      .duration(animationTime)
      .attrTween("d", arcTween(degToRad(360), 'startAngle'));
}, animationTime * 2);


};


</script>


<template>
  <div data-id="component-header">
    <h2>Editor</h2>
    <div class="flex">
      <a href="http://localhost:8888/" target="_blank" rel="noopener">Staging</a>
      <button @click="clearNew"><img height="16" width="16" src="../../assets/greyx.svg"/></button>
    </div>
  </div>
  <div class="sticky-head" data-id="editor-controls-container">
    <button @click="clearNew">new post</button>
    <!-- <button value="editor" @click="setTabView">editor</button>-->
    <button value="preview" @click="toggleTabView">{{ componentState.previewToggleText }}</button>
  </div>
  <!-- marked preview -->
  <div id="editor" ref="previewEl" data-id="editor-preview-container"></div> 
  <div data-id="editor_view_container">
    <div data-id="editor_title_input_container">
      <label>Title</label>
      <input v-model="componentState.currentPostTitle" type="text" data-id="post_title_text_input" ref="postTitleInputEl" />
    </div>
    <div data-id="editor_input_container">
      <!-- codemirror edting -->
      <div id="code_mirror_editor_el" ref="editorEl"></div>
    </div>
    <div data-id="editor_buttons_container">
      <label>autosave<input type="checkbox" ref="isAutoSaveRef" v-model="isAutoSave" /></label>
      <button data-id="editor_save_button" class="primary" @click="savePost">
        <span>save</span>
        <svg id="thesvg" ref="autosaveIndicator" :class="{ saving: componentState.isSaving }" width="20" height="20"></svg>
      </button>
    </div>
  </div>
</template>





























<style scoped>
.sticky-head {
  position: sticky;
  top: 0;
}
[data-id="editor_title_input_container"] {
  display: flex;
  align-items: center;
  padding: .3rem 0;
  gap: .5rem;
}
[data-id="editor_title_input_container"] input {
  width: 100%;
  padding: .2rem;
  line-height: 1.5;
  border: 1px solid #dddddd;
  border-radius: .2rem;

}
[data-id="editor_title_input_container"] label {
  font-size: 11px;
  color: #777777;
  text-transform: uppercase;
  font-family: 'Courier New', Courier, monospace;
}



[data-id="editor-controls-container"] {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
}
[data-id="editor-preview-container"] {
  padding: 1rem;
}
[data-id="editor_view_container"] {
  padding: 1rem;
}
[data-id="editor_input_container"] {
  border: 1px solid #eeeeee;
  height: 500px;
  overflow-y: scroll;
}
[data-id="editor_buttons_container"] {
  display: flex;
  padding: 1rem;
  justify-content: end;
}
[data-id="editor_buttons_container"] label {
  display: flex;
  padding: 0 1.5rem;
  align-items: center;
}
[data-id="editor_save_button"] {
  background: blue;
  border: 1px solid #dddddd;
  color: #ffffff;
  display: flex;
  padding-left: 1.6rem;
  align-items: center;
}
[data-id="editor_save_button"]:hover {
  background: #efefef;
  border: 1px solid #eeeeee;
  color: darkred;
}
[data-id="editor_save_button"]:active {
  background: #444444;
  border: 1px solid #000000;
  color: #eeeeee;
}
[data-id="editor_save_button"] svg {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.5s linear;
}
[data-id="editor_save_button"] svg.saving {
  visibility: visible;
  opacity: .7;
  transition: opacity 0.5s linear;
}
</style>