import { StateEffect } from '@codemirror/state';
import { reactive } from 'vue';
const state = reactive({
  postList: [],
  currentSortDir: 'desc',
  currentSortCol: 'lastUpdate',
  searchText: '',
  currentPost: {},
  currentPostId: '',
  currentPostBodyHasChanged: false,
  currentPostTitleHasChanged: false,
  maxCharCount: 0,
});
const postsServiceEndpoint = 'http://localhost:4444/api/posts';

// /api/post/

const sortState = {sortAscending: false, sortProp: 'lastUpdate'};
const sortAlgo = (a, b) => {
  if (sortState.sortAscending) {
    return (a[sortState.sortProp] > b[sortState.sortProp]) ? 1 : -1;
  }
  else {
    return (a[sortState.sortProp] < b[sortState.sortProp]) ? 1 : -1;
  }

 };

 const savePost = async (post) => {
  if (!post.body) {
    return;
  }
  if (!state.currentPostBodyHasChanged && !state.currentPostTitleHasChanged) {
    console.log('| no content change - no save api post (fetch) required');
    return;
  }
  console.log('|  content has changed save api post - (fetch)');
  var data = new FormData();
  data.append( "json", JSON.stringify( post ) );

  fetch(`http://localhost:4444/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(post),
    })
    .then((response) => {
      console.log('response status save post', response.status);
      if (response.status !== 200) {
        throw response;
      }
      return response.json();
    })
    .then(data => {
      console.log('save post Success:', data);
      // state.currentPost = data;
    })
    .catch((error) => {
      console.error('| save posts error:', error);
      return null;
    });
 };

const fetchPost = async (postId) => {
  if (!postId) {
    return;
  }
  fetch(`http://localhost:4444/api/post/${postId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    .then((response) => {
      console.log('response status', response.status);
      if (response.status !== 200) {
        throw response;
      }
      return response.json();
    })
    .then(data => {
      console.log('fetch post Success:', data);
      state.currentPost = data;
    })
    .catch((error) => {
      console.error('| fetch posts error:', error);
      return null;
    });
};

const fetchPosts = async () => {
  const response = fetch(postsServiceEndpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  })
  .then((response) => {
    console.log('response status', response.status);
    if (response.status !== 200) {
      throw response;
    }
    return response.json();
  })
  .then(data => {
   // console.log('Success:', data);
    if (data &&  data.sort) {
      let maxCharCount = 0;
      data = data.map((item) => {
        const characterCount = item?.body?.length ? item.body.length : 0;
        item.characterCount = characterCount;
        if (characterCount > maxCharCount) {
          maxCharCount = characterCount;
        }
        return item;
      });
      state.maxCharCount = maxCharCount;
      state.postList = data;
      state.sourcePostList = data;
      sortTheList();
    } 
  })
  .catch((error) => {
    console.error('| fetch posts error:', error);
  });
};

const paintPost = async (postId) => {
  if (postId) {
    const response = fetch(`http://localhost:4444/api/paintpost/${postId}?logit=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    .then((response) => {
      console.log('response status from paint request', response.status);
      if (response.status !== 200) {
  
        throw response;
      }
      return response.json();
    })
    .then(data => {
      console.log('paint post Success:', data);
      return data;

    })
    .catch((error) => {
  
        console.error('| paint post error:', error);
  
    });
    return response;
  }

};
// apply any filters
const refreshPostList = () => {
  if (state.searchText === '') {
    state.postList = state.sourcePostList;
  }
  else {
    state.postList = state.sourcePostList.filter((postItem) => {
      return postItem.title.indexOf(state.searchText) > -1;
    });
  }

}

const sortTheList = () => {
  const sortedList = state.postList.sort((a, b) => {
    const valA = a[state.currentSortCol];
    const valB = b[state.currentSortCol];
    if (state.currentSortDir === 'asc') {
      if (valA < valB) {
        return -1;
      }
      if (valA > valB) {
        return 1
      }
      return 0;
    }
    else {
      if (valB < valA) {
        return -1;
      }
      if (valB > valA) {
        return 1
      }
      return 0;
    }
  });
  return sortedList;

};




const methods = {
  fetchPosts () {
    return fetchPosts();
  },

  getData1 () {
    return state.data_1;
  },
  toggleSort (sortProperty) {
    if (sortProperty === state.currentSortCol) {
      state.currentSortDir = (state.currentSortDir === 'desc') ? 'asc' : 'desc';
    }
    state.currentSortCol = sortProperty;
    sortTheList();
  },

  updateTextSearchString (inputText) {
    state.searchText = inputText;
    refreshPostList();
  },
  
  clearSearchText () {
    refreshPostList();
  },

  paintPost (postId) {
    return paintPost(postId);
  },

  fetchPost (postId) {
    return fetchPost(postId);
  },

  updateCurrentPostBody (postBody) {
    const currentPostBody = state.currentPost.body;
    if (currentPostBody.length === postBody.length) {
      // post body has not changed
      state.currentPostBodyHasChanged = false;  
      return;
    }
    state.currentPostBodyHasChanged = true;
    state.currentPost.body = postBody;
  },

  updateCurrentPostTitle (postTitle) {
    if (state.currentPost.title === postTitle) {
      // post title has not changed
      state.currentPostTitleHasChanged = false;
      return;
    }
    state.currentPostTitleHasChanged = true;
    state.currentPost.title = postTitle;
  },

  saveCurrentPost () {
    if (state.currentPost) {
      return savePost(state.currentPost);
    }
  },
};

export default {
  state,
  methods
};