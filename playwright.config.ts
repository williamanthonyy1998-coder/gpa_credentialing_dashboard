import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'backend');
const apiPort = process.env.E2E_API_PORT || '4010';
const webPort = process.env.E2E_WEB_PORT || '5175';
const runE2E = process.env.PLAYWRIGHT_E2E === '1';

function requireE2eDatabaseUrl(): string {
  const url = String(process.env.E2E_DATABASE_URL || '').trim();
  if (!url) {
    throw new Error(
      '[playwright] E2E_DATABASE_URL is required when PLAYWRIGHT_E2E=1. '
      + 'Use an isolated database (name must match *_e2e / credentialing_e2e).'
    );
  }
  // Never print credentials — validate database name only.
  const pathPart = url.replace(/^[^/]+:\/\//, '').split('/').slice(1).join('/');
  const dbName = (pathPart.split('?')[0] || '').replace(/\/$/, '');
  const ok =
    /(_e2e|_test)$/i.test(dbName)
    || /^credentialing_e2e$/i.test(dbName);
  if (!ok) {
    throw new Error(
      '[playwright] E2E_DATABASE_URL must target an isolated *_e2e / *_test / credentialing_e2e database'
    );
  }
  if (/credentialing_db$/i.test(dbName) || /production/i.test(dbName)) {
    throw new Error('[playwright] Refusing E2E_DATABASE_URL that looks like a production database');
  }
  return url;
}

function requireE2eJwtSecret(): string {
  const secret = String(process.env.E2E_JWT_SECRET || process.env.PLAYWRIGHT_JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error(
      '[playwright] E2E_JWT_SECRET (or PLAYWRIGHT_JWT_SECRET) is required when PLAYWRIGHT_E2E=1. '
      + 'Use a dedicated test-only secret — never reuse production JWT_SECRET.'
    );
  }
  if (secret.length < 32) {
    throw new Error('[playwright] E2E_JWT_SECRET must be at least 32 characters');
  }
  return secret;
}

const e2eDbUrl = runE2E ? requireE2eDatabaseUrl() : '';
const e2eJwtSecret = runE2E ? requireE2eJwtSecret() : '';

/**
 * Phase 2C Playwright configuration (security-hardened).
 *
 * Full suite (PLAYWRIGHT_E2E=1):
 * - Requires E2E_DATABASE_URL (isolated e2e DB) and E2E_JWT_SECRET (test-only)
 * - Starts API on :4010 against credentialing_e2e
 * - Starts Vite on :5175
 *
 * Without PLAYWRIGHT_E2E=1, journey specs skip (safe for CI without browsers/DB).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: runE2E
    ? [
        {
          command: `npx tsx src/server.ts`,
          cwd: backend,
          url: `http://localhost:${apiPort}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            ...process.env,
            PORT: apiPort,
            DATABASE_URL: e2eDbUrl,
            E2E_SAFE_DATABASE: '1',
            WEB_ORIGIN: `http://localhost:${webPort}`,
            APP_BASE_URL: `http://localhost:${webPort}`,
            JWT_SECRET: e2eJwtSecret,
            NODE_ENV: process.env.NODE_ENV === 'production' ? 'test' : (process.env.NODE_ENV || 'development')
          }
        },
        {
          command: `npx vite --host 127.0.0.1 --port ${webPort}`,
          cwd: path.join(root, 'frontend'),
          url: `http://localhost:${webPort}/login`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            VITE_API_URL: `http://localhost:${apiPort}/api`
          }
        }
      ]
    : undefined
});
