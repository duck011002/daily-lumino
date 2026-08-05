import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
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
