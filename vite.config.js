import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(
    {
      template: {
        compilerOptions: {
          // 1. Tell Vite that all components starting with "inline-draw" are webcomponents
          isCustomElement: (tag) => tag.startsWith('test-component') || tag.startsWith('inline-draw') 
        }
      }
    }
  ),],
})
