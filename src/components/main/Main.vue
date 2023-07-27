<script setup>
import { PostList } from '../post_list/';
import { PostEditor } from '../post_editor/';
import { ref, inject, reactive, watch } from 'vue';

const store = inject('store');


let uxMode = '';
const urlParams = new URLSearchParams(window.location.search);
uxMode = urlParams.get('mode');

const currentPostId = urlParams.get('post');

const isShowEditor = (uxMode === 'edit') && currentPostId;
if (isShowEditor) {
  store.methods.fetchPost(currentPostId);
}
</script>
<template>
  <header><a href="/">Graffiti Engine</a></header>
  <PostEditor v-if="isShowEditor" />
  <PostList />
</template>