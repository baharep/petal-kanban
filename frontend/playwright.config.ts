import { randomBytes, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const backendPython = process.platform === 'win32'
  ? '.venv\\Scripts\\python.exe'
  : './.venv/bin/python';
const testSessionSecret = randomBytes(32).toString('base64url');
const apiOrigin = 'http://127.0.0.1:8101';
const testDatabasePath = join(tmpdir(), `petal-e2e-${randomUUID()}.db`);
process.env.PETAL_E2E_DATABASE_PATH = testDatabasePath;

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/*.e2e.spec.ts'],
  fullyParallel: false,
  workers: 1,
  globalTeardown: './tests/e2e-teardown.ts',
  timeout: 30000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'on-first-retry',
    browserName: 'chromium',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `${backendPython} -m uvicorn app.main:app --host 127.0.0.1 --port 8101`,
      cwd: '../backend',
      url: `${apiOrigin}/api/health`,
      env: {
        PETAL_SESSION_SECRET: testSessionSecret,
        PETAL_DATABASE_PATH: testDatabasePath,
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3101',
      url: 'http://127.0.0.1:3101',
      env: { PETAL_API_INTERNAL_URL: apiOrigin },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
