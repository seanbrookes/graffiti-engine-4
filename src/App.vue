<script setup>
import { PostList } from './components/post_list';
import { provide } from 'vue';
import dataStore from './store/store.js';

provide('store', dataStore);

</script>

<template>
  <PostList />
</template>

<style scoped>
</style>
