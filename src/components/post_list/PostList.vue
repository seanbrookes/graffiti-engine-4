<script setup>
import { ref, inject, reactive, watch } from 'vue';
import { LengthViz } from './';
import { clearNew } from '../../ge4-helpers';

const store = inject('store');

store.methods.fetchPosts();

const postListRef = ref([]);

const state = reactive({
  currentSortDir: 'asc',
  currentSortCol: 'title',
  maxCharLength: 0,
  searchText: '',
});


const toggleSort = (event) => {
  const sortProperty = event.target.value;
  store.methods.toggleSort(sortProperty);

};

const clearSearchText = () => {
  store.methods.clearSearchText();
};

const searchTextInput = (event) => {
  const currentSearchText = event.target.value;
  console.log('| currentSearchText ', currentSearchText);
  store.methods.updateTextSearchString(currentSearchText);
};

const toggleRowCommandMenu = (event) => {
  const targetPostId = event.currentTarget.value;
  console.log('| POST test to command menu for ', targetPostId);
  // store.methods.paintPost(targetPostId);
  // server.get('/api/repaint/:id', (req, res) => {
};

const editPost = (event) => {
  const postId = event.target.value;
  if (postId) {
    document.location.href = `/?mode=edit&post=${postId}`;
  }
}

</script>

<template>
  <div data-id="post_list_container">
    <div data-id="component-header">
      <h2>Post list</h2>
    </div>    
    <div data-id="post_list_search_container">
      <div class="flex">
        <input
          placeholder="search..."
          data-id="post_list_search_input"
          type="text"
          @input="searchTextInput"
          :value="store.state.searchText"
        />
        <button @click="clearSearchText">X</button>
      </div>
      <button @click="clearNew">new post</button>
    </div>
    <table>
      <thead class="sticky-head">
        <tr>
          <th></th>
          <th>
            <button value="title" @click="toggleSort">title</button>
          </th>          
          <th>
            <button value="status" @click="toggleSort">status</button>
          </th>
          <th>
            <button value="lastUpdate" @click="toggleSort">update</button>
          </th>
          <th>
            <button value="characterCount" @click="toggleSort">size</button>
          </th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(post, index) in store.state.postList" :key="post.id" :class="[post.id === store.state?.currentPost?.id ? 'post-row-highlight' : '']">
          <td style="text-align: right; font-size: 9px; padding-right: .2rem">{{ index + 1 }})</td>
          <td>
            <button @click="editPost" :value="post.id" data-id="post_list_title_button" :title="post.title">{{ post.title }}</button>
          </td>
          <td>{{ post.status }}</td>
          <td>{{ new Date(post.lastUpdate).toLocaleDateString() }}</td>
          <td style="padding: 0; margin: 0"><LengthViz :post="post" :max="store.state.maxCharCount" /></td>
          <td>
            <button :value="post.id" @click="toggleRowCommandMenu">
              <img class="icon" src="../../assets/Menu-Circles.svg" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sticky-head {
  position: sticky;
  top: 0;
}
[data-id="post_list_container"] {
  padding: 2rem 6rem 0 6rem;
  border: 1px solid #eeeeee;
  border-radius: 1rem;
  display: grid;
  max-width: 55rem;
}
[data-id="post_list_search_container"] {
  display: flex;
  align-items: center;
  padding: 0 0 .3rem 0;
  gap: .2rem;
}
.flex {
  display: flex;
  align-items: center;
}
[data-id="post_list_search_container"] {
  display: flex;
  align-items: center;
  padding: 0 0 .3rem 0;
  gap: .2rem;
  justify-content: space-between;
}
[data-id="post_list_search_container"] .flex {
  gap: .2rem;
}
[data-id="post_list_search_container"] button {
  border-color: #eeeeee;
}

caption {
  text-align: left;
}

td {
  padding: .3rem;
}
button.post-title {
  border: 0;
  background: transparent;
  cursor: pointer;
}
tr:nth-child(odd) {
  background-color: #e8e8e8;
}
tr.post-row-highlight {
  background-color: rgb(218, 230, 238);
}
[data-id="post_list_title_button"] {
  max-width: 30rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: darkblue;
}
[data-id="post_list_title_button"]:hover {
  color: blue;
  text-decoration: underline;
}
[data-id="post_list_title_button"]:active {
  color: darkred;
  text-decoration: none;
}
[data-id="post_list_search_input"] {
  width: 26rem;
  padding: .5rem;
  border: 1px solid #cccccc;
  border-radius: .3rem; 
}
</style>
