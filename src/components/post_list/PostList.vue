<script setup>
import { ref, inject, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { LengthViz } from './';
import { clearNew } from '../../ge4-helpers';

const store = inject('store');

store.methods.fetchPosts();

const postListRef = ref([]);

const POST_ACTIONS = {
  PUBLISH: 'publish',
  STAGE: 'stage',
  UNSTAGE: 'unstage',
  REPAINT: 'repaint',
  DELETE: 'delete',
  UNPUBLISH: 'unpublish',
};

const state = reactive({
  currentSortDir: 'asc',
  currentSortCol: 'title',
  maxCharLength: 0,
  searchText: '',
});



// 1. Reactive state for the menu
const openPostId = ref(null) 

// 2. Template ref to identify the menu element
const menuContainer = ref(null)

const toggleMenu = (postId) => {
  openPostId.value = openPostId.value === postId ? null : postId
}

const handleAction = (actionName, postId) => {
  openPostId.value = null;
  if (actionName === POST_ACTIONS.STAGE)     store.methods.stagePost(postId);
  if (actionName === POST_ACTIONS.PUBLISH)   store.methods.publishPost(postId);
  if (actionName === POST_ACTIONS.UNSTAGE)   store.methods.unstagePost(postId);
  if (actionName === POST_ACTIONS.REPAINT)   store.methods.paintPost(postId);
  if (actionName === POST_ACTIONS.UNPUBLISH) store.methods.unpublishPost(postId);
};

// 4. Close on click outside logic
const closeOnOutsideClick = (event) => {
  if (menuContainer.value && !menuContainer.value.contains(event.target)) {
    openPostId.value = null
  }
}

onMounted(() => window.addEventListener('click', closeOnOutsideClick))
onUnmounted(() => window.removeEventListener('click', closeOnOutsideClick))






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
};

const postList = computed(() => {
  return store.state.postList;
})

watch(postList, (postList) => {
  console.log('post list length ', postList.length);
  playWithPosts(postList);
});

const playWithPosts = (list) => {
  console.log('| list of posts', list);
  for (let i = 0; i < list.length; i++) {
    console.log('| post ', list[i]);
  }
};

</script>

<template>
  <div data-id="post_list_container" ref="menuContainer">
    <div data-id="component-header">
      <h2>Post list</h2>
    </div>
    <div v-if="store.state.stagedPostConflict" class="staged-conflict-warning">
      <span><strong>{{ store.state.stagedPostConflict.title }}</strong> is currently staged. Publish or un-stage it before staging a new post.</span>
      <button @click="store.methods.clearStagedPostConflict()">Dismiss</button>
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
        <tr v-for="(post, index) in store.state.postList" :key="post.id" :class="[post.id === store.state?.currentPost?.id ? 'post-row-highlight' : '', post.status === 'staged' ? 'post-row-staged' : '']">
          <td style="text-align: right; font-size: 9px; padding-right: .2rem">{{ index + 1 }})</td>
          <td>
            <a :href="`/?mode=edit&post=${post.id}`">{{ post.title }}</a>
            <!--
            <button @click="editPost" :value="post.id" data-id="post_list_title_button" :title="post.title">{{ post.title }}</button>
            -->
          </td>
          <td>{{ post.status }}</td>
          <td>{{ new Date(post.lastUpdate).toLocaleDateString() }}</td>
          <td style="padding: 0; margin: 0"><LengthViz :post="post" :max="store.state.maxCharCount" /></td>
          <td>
            <div class="kebab-menu-container">
              <!-- The Trigger Button -->
              <button  @click="toggleMenu(post.id)" class="kebab-trigger" aria-haspopup="true" id="kebab-trigger" aria-expanded="false">
                <!-- Place your SVG asset here -->
                <img class="icon" src="../../assets/Menu-Circles.svg" />
              </button>

              <!-- The Dropdown List -->
              <div v-if="openPostId === post.id" class="dropdown-menu menu-list" id="kebab-list">
                <template v-if="post.status === 'draft'">
                  <button @click="handleAction(POST_ACTIONS.STAGE, post.id)">Stage</button>
                  <button @click="handleAction(POST_ACTIONS.DELETE, post.id)">Delete</button>
                </template>
                <template v-else-if="post.status === 'staged'">
                  <button @click="handleAction(POST_ACTIONS.PUBLISH, post.id)">Publish</button>
                  <button @click="handleAction(POST_ACTIONS.UNSTAGE, post.id)">Un-stage</button>
                  <button @click="handleAction(POST_ACTIONS.DELETE, post.id)">Delete</button>
                </template>
                <template v-else-if="post.status === 'published'">
                  <button @click="handleAction(POST_ACTIONS.REPAINT, post.id)">Repaint</button>
                  <button @click="handleAction(POST_ACTIONS.UNPUBLISH, post.id)">Unpublish</button>
                </template>
              </div>
            </div>
            <!--
            <button :value="post.id" @click="toggleRowCommandMenu">
              <img class="icon" src="../../assets/Menu-Circles.svg" />
            </button>
            -->
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
/*
  kebab menu
*/
.kebab-menu-container { position: relative; display: inline-block; }
.menu-list {
  position: absolute;
  right: 0;
  top: 100%;
  background: white;
  border: 1px solid #ccc;
  display: flex;
  flex-direction: column;
  z-index: 10;
}
.menu-list button {
  text-align: left;
  padding: .6rem;
}
.hidden { display: none; }
/** end kebab menu */

tr.post-row-staged {
  background-color: rgb(255, 251, 224);
}
.staged-conflict-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: .6rem 1rem;
  margin-bottom: .5rem;
  background: rgb(255, 243, 190);
  border: 1px solid rgb(220, 180, 0);
  border-radius: .3rem;
  font-size: .9rem;
}
</style>
