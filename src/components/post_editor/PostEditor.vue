<script setup>
import { ref, inject, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import {EditorState, Compartment} from "@codemirror/state"
import { marked } from 'marked';
import { mangle } from "marked-mangle";
import { gfmHeadingId } from "marked-gfm-heading-id";
import { clearNew } from '../../ge4-helpers';

let autosaveTimer = null;

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


const startAutosaveTimer = () => {
  // Clear any existing timer first
  if (autosaveTimer) clearTimeout(autosaveTimer);
  
  // Set a new timer
  autosaveTimer = setTimeout(() => {
    savePost();
  }, DEFAULT_AUTOSAVE_MS);
};

// TODO this is sloppy
const toggleTabView = () => {
  componentState.isShowPreview = !componentState.isShowPreview;
  renderCodeMirror();
};

let isAutoSave = ref(true);


const metaService = inject('meta-service');
const title = ref('Graffiti Engine');

const previewEl = ref(null);
const editorEl = ref(null);

// Escape HTML entities for raw-text rendering (mirrors the server's escapeXml)
const escapeHtml = (str) => (str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

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
    const post = store?.state?.currentPost || {};
    const slug = post.slug || '';
    const postTitle = post.title || '';
    const publishDate = post.publishDate || '';
    const publishDateFormatted = publishDate
      ? new Date(publishDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const author = post.author || '';

    marked.use(mangle());
    marked.use(gfmHeadingId(markedOptions));
    let bodyHtml;
    if (bodyMode.value === 'html') {
      bodyHtml = post.body || '';
    } else if (bodyMode.value === 'text') {
      bodyHtml = `<pre>${escapeHtml(post.body)}</pre>`;
    } else {
      bodyHtml = post.body ? marked.parse(post.body) : '';
    }

    const metaHtml = (publishDateFormatted || author) ? `
      <div class="post-meta">
        ${publishDateFormatted ? `<time datetime="${publishDate}">${publishDateFormatted}</time>` : ''}
        ${author ? `<span class="post-author">${author}</span>` : ''}
      </div>` : '';

    previewEl.value.className = 'ge4-preview';
    previewEl.value.innerHTML = `
      <article class="post--${slug}">
        <h1>${postTitle}</h1>
        ${metaHtml}
        <div class="post-body">${bodyHtml}</div>
      </article>`;
  }
  else {
    previewEl.value.innerHTML = null;
    previewEl.value.className = '';
  }
  /**
   * 
   *  CODE MIRROR EDITOR
   * 
   * 
   */
  const code_mirror_el = document.getElementById('code_mirror_editor_el');  
  // componentState.currentPostTitle = store?.state?.currentPost?.title;
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
const languageConf = new Compartment();
const initialEditorState = {
  doc: store?.state?.currentPost?.body,
  extensions: [
    EditorView.updateListener.of(function(e) {
      sync_val = e.state.doc.toString();
    }),
    basicSetup,
    languageConf.of(markdown()),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ spellcheck: 'true' }),
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
// Initial timer start
  if (isAutoSave.value) {
    startAutosaveTimer();
  }

  metaService.setTitle(`[edit]: ${currentTitle}`);

  console.log('|');
  console.log('| onMounted editorState ', editorState);
  console.log('|');


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
  componentState.isActivelyEditing = true;
  
  // 1. Reset the "Is Editing" flag after a pause
  // (Optional: use a separate timeout for this if you use it for UI indicators)
  
  // 2. IMPORTANT: Reset the autosave clock on every keypress
  startAutosaveTimer();
};


onUnmounted(() => {
  document.removeEventListener('keypress', typingStatus);
});



const currentPost = computed(() => {
  return store?.state?.currentPost?.body;
});




const currentTitle = computed({
  get() {
    return store?.state?.currentPost?.title || '';
  },
  set(newValue) {
    // This pushes the change to the store immediately as the user types
    store.methods.updateCurrentPostTitle(newValue);
    // Optional: Trigger your autosave timer reset here too
    startAutosaveTimer();
  }
});




// Supported body formats, in cycle order. 'text' = raw text (escaped), 'markdown', 'html' = raw fragment.
const BODY_MODES = ['markdown', 'html', 'text'];

// CodeMirror syntax highlighting per mode (no dedicated html/text langs are imported)
const languageFor = (mode) => {
  if (mode === 'html') return javascript();
  if (mode === 'text') return [];
  return markdown();
};

const bodyMode = computed({
  get() { return store?.state?.currentPost?.bodyMode || 'markdown'; },
  set(mode) {
    store.methods.updateCurrentPostBodyMode(mode);
    editor.dispatch({
      effects: languageConf.reconfigure(languageFor(mode))
    });
    startAutosaveTimer();
  }
});

const currentSummary = computed({
  get() { return store?.state?.currentPost?.summary || ''; },
  set(value) {
    store.methods.updateCurrentPostSummary(value);
    startAutosaveTimer();
  }
});

const toggleBodyMode = () => {
  const idx = BODY_MODES.indexOf(bodyMode.value);
  bodyMode.value = BODY_MODES[(idx + 1) % BODY_MODES.length];
};

watch(isAutoSave, (enabled) => {
  if (enabled) {
    startAutosaveTimer();
  } else {
    clearTimeout(autosaveTimer);
  }
});




watch(currentPost, (newValue) => {
  // Only update CodeMirror if the data in the store is different from the editor
  // This prevents the "Save -> Store Update -> Watcher Fires -> Editor Resets" loop
  const editorValue = editor.state.doc.toString();
  if (newValue !== editorValue) {
    editor.dispatch({
      changes: {
        from: 0,
        to: editorValue.length,
        insert: newValue || "",
      },
    });
  }
  doTheSvg();
});




watch(currentTitle, (theTitle) => {
  metaService.setTitle(`[edit]: ${theTitle}`);
});


const setSaveIndicator = (value) => {
  componentState.isSaving = value;
};

const savePost = () => {
  // Use .value because it's a computed ref in <script setup>
  const titleToSave = currentTitle.value; 

  if (!titleToSave) {
    console.warn('| Save aborted: No title present.');
    return;
  }

  if (sync_val) {
    setSaveIndicator(true);
    
    // The title is likely already updated in the store via the 'set' 
    // in our writable computed, but calling this ensures consistency.
    store.methods.updateCurrentPostTitle(titleToSave);
    store.methods.updateCurrentPostBody(sync_val);
    store.methods.saveCurrentPost();

    if (isAutoSave.value) {
      startAutosaveTimer();
    }

    setTimeout(() => {
      setSaveIndicator(false);
    }, 3000);
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
    <div class="flex">
      <button value="preview" @click="toggleTabView">{{ componentState.previewToggleText }}</button>
      <button @click="toggleBodyMode" :data-mode="bodyMode" data-id="body-mode-toggle">{{ bodyMode }}</button>
    </div>
  </div>
  <!-- marked preview -->
  <div id="editor" ref="previewEl" data-id="editor-preview-container"></div> 
  <div data-id="editor_view_container">
    <div data-id="editor_title_input_container">
      <label>Title</label>
      <input v-model="currentTitle" type="text" data-id="post_title_text_input" ref="postTitleInputEl" />
    </div>
    <div data-id="editor_summary_input_container">
      <div class="summary-label-row">
        <label>Description</label>
        <span class="char-hint" :class="{ 'char-hint-warn': currentSummary.length > 160 }">{{ currentSummary.length }} / 160</span>
      </div>
      <textarea v-model="currentSummary" rows="2" spellcheck="true" data-id="post_summary_textarea" placeholder="Brief description for search engines and social previews — leave blank to auto-generate from post body"></textarea>
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
[data-id="editor-preview-container"].ge4-preview {
  padding: 2rem;
  border: 1px dashed #dddddd;
  border-radius: 0.25rem;
  background: #ffffff;
}
[data-id="editor_view_container"] {
  padding: 1rem;
}
[data-id="editor_summary_input_container"] {
  padding: .3rem 0;
}
.summary-label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: .2rem;
}
[data-id="editor_summary_input_container"] label {
  font-size: 11px;
  color: #777777;
  text-transform: uppercase;
  font-family: 'Courier New', Courier, monospace;
}
.char-hint {
  font-size: 10px;
  color: #aaaaaa;
  font-family: 'Courier New', Courier, monospace;
}
.char-hint-warn {
  color: #cc5500;
}
[data-id="post_summary_textarea"] {
  width: 100%;
  padding: .2rem;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #dddddd;
  border-radius: .2rem;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
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
[data-id="body-mode-toggle"] {
  font-family: 'Courier New', Courier, monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #777777;
}
[data-id="body-mode-toggle"][data-mode="html"] {
  color: #cc5500;
  border-color: #cc5500;
}
[data-id="body-mode-toggle"][data-mode="text"] {
  color: #0055cc;
  border-color: #0055cc;
}
</style>