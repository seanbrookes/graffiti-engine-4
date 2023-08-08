<script setup>
import { ref, inject, reactive, watch, computed, onMounted, onUnmounted, onBeforeMount } from 'vue';

const store = inject('store');

const componentState = reactive({
  isEditorClosed: false,
});


const closeVecotorEditor = () => {
  store.methods.closeVectorEditor();
};

onMounted(() => {
  document.querySelector('[data-id="vector-editor"]').style.resize = 'both';
});

</script>


<template>
  <div data-id="vector-editor" :class="{ vector_editor_open: store.state.isShowVectorEditor }">
    <div data-id="component-header">
      <h2>Vector Editor</h2>
      <button @click="closeVecotorEditor"><img height="16" width="16" src="../../assets/greyx.svg"/></button>      
    </div>
    <iframe src="http://localhost:3242/"  class="iframe" :class="{ vector_editor_open: store.state.isShowVectorEditor }" />
  </div>
</template>


<style scoped>
[data-id="vector-editor"] {
  border: 1px solid white;
  opacity: 0;
  height: 0;
  visibility: hidden;
  transition: opacity .8s ease-out;
  transition: height .8s ease-out;
}

.vector_editor_open {
  visibility: visible;
  opacity: 1;
  height: 580px;
  transition: opacity .8s ease-out;
  transition: height .8s ease-out;
}


.iframe {
  resize: both;
  overflow: auto;
  border: 1px solid #efefef;
  width: 100%;
  height: 520px;
}

</style>