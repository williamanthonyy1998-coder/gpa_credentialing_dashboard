import { test, expect } from '@playwright/test';

/**
 * Lightweight smoke tests.
 * Full journey lives in provider-intake-journey.spec.ts (requires PLAYWRIGHT_E2E=1).
 */
const enabled = process.env.PLAYWRIGHT_E2E === '1';

test.describe('Phase 2C smoke', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 with e2e stack');

  test('login page is reachable', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('provider invitation accept route renders validation UI', async ({ page }) => {
    await page.goto('/accept-provider-invitation/invalid-token-for-e2e');
    await expect(page.getByRole('heading', { name: /provider intake invitation/i })).toBeVisible();
    await expect(page.getByText(/invalid or no longer available/i)).toBeVisible({ timeout: 15_000 });
  });

  test('unauthenticated provider portal redirects to login', async ({ page }) => {
    await page.goto('/provider-portal');
    await expect(page).toHaveURL(/\/login/);
  });

  test('provider intake login remains usable at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
