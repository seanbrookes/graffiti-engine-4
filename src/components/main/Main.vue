<script setup>
import { PostList } from '../post_list/';
import { PostEditor } from '../post_editor/';

let uxMode = '';
const urlParams = new URLSearchParams(window.location.search);
uxMode = urlParams.get('mode');

const currentPost = urlParams.get('post');

const isShowEditor = (uxMode === 'edit') && currentPost;

</script>
<template>
  <header><a href="/">Graffiti Engine</a></header>
  <PostEditor v-if="isShowEditor" />
  <PostList />
</template>