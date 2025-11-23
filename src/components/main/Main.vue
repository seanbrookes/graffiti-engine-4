<script setup>
import { PostList } from '../post_list/';
import { PostEditor } from '../post_editor/';
import { ref, inject, reactive, watch } from 'vue';

const store = inject('store');


let uxMode = '';
const urlParams = new URLSearchParams(window.location.search);
uxMode = urlParams.get('mode');

const currentPostId = urlParams.get('post');

const isShowEditor = (uxMode === 'edit');
if (isShowEditor) {
  store.methods.fetchPost(currentPostId);
}

const generateStaging = () => {
  /*
    we want to
    - find all the published posts
    - generate a page for each one
    - post the page to the inbox on the host
    - generate a new index.html
    - post it to the inbox on the host
  */
 console.log('| generate staging site', store.generateStagingSite);
 store.methods.generateStagingSite();
};
</script>
<template>
  <header><a href="/">Graffiti Engine</a></header>
  <PostEditor v-if="isShowEditor" />
  <div>
    <button
      @click="generateStaging"
    >generate staging</button>
  </div>
  <div class="ge4-layout-block">
    <PostList />
  </div>  

</template>

<style scoped>
.ge4-layout-block {
  display: grid;
  grid-auto-rows: 1fr;
  justify-content: center;
}
</style>