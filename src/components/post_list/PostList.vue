<script setup>
import { inject } from 'vue';

const store = inject('store');

store.methods.fetchPosts();

</script>

<template>
  <h1>post list</h1>
  <div>
    <!--
    {{ store.state.postList }}
    -->
    <table>
      <tbody>
        <tr v-for="post in store.state.postList">
          <td></td>
          <td>{{ post.status }}</td>
          <td>{{ post.lastUpdate }}</td>
          <td style="text-align: left">
            <button>{{ post.title }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
button.post-title {
  border: 0;
  background: transparent;
  cursor: pointer;
}
</style>
