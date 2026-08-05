import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://lovestory1314.fun',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
