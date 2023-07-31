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
</script>
<template>
  <header><a href="/">Graffiti Engine</a></header>
  <PostEditor v-if="isShowEditor" />
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