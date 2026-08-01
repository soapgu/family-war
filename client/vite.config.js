import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  base: '/family-war/',
  plugins: [react()],
  build: {
    outDir: 'build',
  },
  server: {
    port: 3000,
    open: {
      app: 'Google Chrome',
    },
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setup-vitest.js',
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'tests/experiments/**'],
  },
})
