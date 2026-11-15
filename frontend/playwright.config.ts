import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const backendPython = process.platform === 'win32'
  ? '.venv\\Scripts\\python.exe'
  : './.venv/bin/python';
const testSessionSecret = randomBytes(32).toString('base64url');

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
  webServer: [
    {
      command: `${backendPython} -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/api/health',
      env: { PETAL_SESSION_SECRET: testSessionSecret },
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
      url: 'http://127.0.0.1:3000',
      env: { PETAL_API_INTERNAL_URL: 'http://127.0.0.1:8000' },
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
