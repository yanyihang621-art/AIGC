import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // 将 /api 请求代理到后端服务（端口 3001）
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
