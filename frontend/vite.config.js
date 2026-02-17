import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    reporters: ['default', 'html', 'json'],
    outputFile: {
      html: './test-report/index.html',
      json: './test-report/results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './test-report/coverage',
      include: [
        'src/components/**/*.jsx',
        'src/pages/**/*.jsx',
        'src/services/**/*.js',
        'src/utils/**/*.js',
      ],
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/__tests__/**',
      ],
    },
  },
})
