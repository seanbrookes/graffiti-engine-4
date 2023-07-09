<script setup>
import { Main } from './components/';
import { provide } from 'vue';
import dataStore from './store/store.js';

provide('store', dataStore);

</script>

<template>
  <Main />
</template>

<style scoped>
</style>
