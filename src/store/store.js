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
  const response = fetch('http://localhost:4444/api/posts', {
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
      const sortedCollection = data.sort(sortAlgo);
      const postCollectionState = sortedCollection.reduce((result, item, index) => {
        result[item.id] = item
        return result
      }, {});
      state.postList = sortedCollection;
    } 
  })
  .catch((error) => {

      console.error('| fetch posts error:', error);

  });
};




const state = reactive({
  data_1: 'test',
  postList: [
    {id: 'asdfasfd', title: 'dasdfasdf', body: 'asdfasdfsa'}
  ]  
});

const methods = {
  fetchPosts() {
    return fetchPosts();
  },

  getData1() {
    return state.data_1;
  },


};

export default {
  state,
  methods
};