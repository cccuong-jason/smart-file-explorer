import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/lib/search/core.ts',
        'src/lib/file-browser/utils.ts',
        'src/lib/theme-provider.tsx',
        'src/lib/i18n/index.tsx',
        'src/components/search/search-input.tsx',
        'src/components/ui/pagination.tsx',
        'src/components/ui/progress-bar.tsx',
        'src/components/ui/helper-alert.tsx',
        'src/components/ui/tag-input.tsx',
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
