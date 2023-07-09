import { reactive } from 'vue';

const postsServiceEndpoint = 'http://localhost:4444/api/posts';


const sortState = {sortAscending: false, sortProp: 'lastUpdate'};
const sortAlgo = (a, b) => {
  if (sortState.sortAscending) {
    return (a[sortState.sortProp] > b[sortState.sortProp]) ? 1 : -1;
  }
  else {
    return (a[sortState.sortProp] < b[sortState.sortProp]) ? 1 : -1;
  }

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
      // console.log('|');
      // console.log('|  non 200 response', response.json());
      // console.log('|');

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


const state = reactive({
  postList: [],
  currentSortDir: 'desc',
  currentSortCol: 'lastUpdate',
  searchText: '',
  maxCharCount: 0,
});

const methods = {
  fetchPosts() {
    return fetchPosts();
  },

  getData1() {
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
    state.searchText = '';
    refreshPostList();
  },

};

export default {
  state,
  methods
};