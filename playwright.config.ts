import { defineConfig, devices } from '@playwright/test';

const uiPort = process.env.PLAYWRIGHT_PORT ?? '4301';
const baseURL = `http://127.0.0.1:${uiPort}`;

export default defineConfig({
  testDir: './tests/ui',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/ui-preview.mjs',
    url: baseURL,
    env: {
      ...process.env,
      PORT: uiPort,
    },
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1',
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
      },
    },
  ],
});
