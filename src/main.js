import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { meta } from './meta'; // 'meta' is imported as a named export

// 1. Create the app instance.
const app = createApp(App);

// 2. Use the 'provide' method on the app instance to make 'meta' available 
// globally to all components. The key is typically a string, like 'meta-service'.
app.provide('meta-service', meta);

// 3. Mount the app.
app.mount('#app');