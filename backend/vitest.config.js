import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    forceRexit: true,
    testTimeout: 10000,
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
        'routes/**/*.js',
        'utils/**/*.js',
        'config/**/*.js',
        'server.js',
      ],
      exclude: [
        'node_modules/**',
        '__tests__/**',
        'uploads/**',
      ],
    },
  },
});
