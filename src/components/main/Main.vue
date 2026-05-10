<script setup>
import { PostList } from '../post_list/';
import { PostEditor } from '../post_editor/';
import { ref, inject } from 'vue';

const store = inject('store');
const urlParams = new URLSearchParams(window.location.search);

let uxMode = urlParams.get('mode') || 'edit';
const currentPostId = urlParams.get('post');

const isShowEditor = (uxMode === 'edit');
if (isShowEditor) {
  store.methods.fetchPost(currentPostId);
}

const generateStaging = () => {
  store.methods.generateStagingSite();
};

const isDeploying = ref(false);
const deployStatus = ref(null);

const regenerateSite = async () => {
  isDeploying.value = true;
  deployStatus.value = null;
  try {
    const result = await store.methods.deploySite();
    deployStatus.value = result.message;
  } catch (err) {
    deployStatus.value = 'Deploy failed — check server logs.';
    console.error('| regenerateSite error:', err);
  } finally {
    isDeploying.value = false;
  }
};
</script>

<template>
  <header><a href="/">Graffiti Engine</a></header>
  <PostEditor v-if="isShowEditor" />
  <div class="site-actions">
    <button @click="generateStaging">generate staging</button>
    <button @click="regenerateSite" :disabled="isDeploying">
      {{ isDeploying ? 'deploying…' : 'regenerate site' }}
    </button>
    <span v-if="deployStatus" class="deploy-status">{{ deployStatus }}</span>
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
.site-actions {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .5rem 0;
}
.deploy-status {
  font-size: .85rem;
  color: #555;
}
</style>