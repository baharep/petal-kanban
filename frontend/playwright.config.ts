import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/*.e2e.spec.ts'],
  fullyParallel: true,
  timeout: 30000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    browserName: 'chromium',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
