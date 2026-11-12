import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, apiLogin, authHeaders, fixtures, setAuthStorage } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 3D credentialing QA', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after seeding credentialing_e2e');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Missing fixtures');

  test('GPA scan/findings; client and provider denied; resolve requires underlying fix', async ({ browser }) => {
    const api = await playwrightRequest.newContext({ baseURL: API.replace(/\/api$/, '') });
    const tenantA = fixtures.tenants.a.id as string;
    const tenantB = fixtures.tenants.b.id as string;
    const gpa = await apiLogin(api, fixtures.users.gpaAdmin.email);

    const provRes = await api.post(`${API}/providers`, {
      headers: authHeaders(gpa.token, tenantA),
      data: {
        firstName: 'Qa',
        lastName: `E2E${Date.now()}`,
        email: `qa.e2e.${Date.now()}@e2e.credentialing.test`,
        status: 'ACTIVE'
      }
    });
    expect(provRes.ok(), await provRes.text()).toBeTruthy();
    const provider = await provRes.json();

    const scan = await api.post(`${API}/credentialing-qa/scan`, {
      headers: authHeaders(gpa.token, tenantA),
      data: { providerId: provider.id, persist: true }
    });
    expect(scan.ok(), await scan.text()).toBeTruthy();
    const scanBody = await scan.json();
    expect(scanBody.scan.status).toMatch(/COMPLETED|PARTIAL/);
    expect(scanBody.findings.some((f: any) => /specialty/i.test(f.title))).toBeTruthy();

    const findings = await api.get(`${API}/credentialing-qa/findings?all=1&status=OPEN`, {
      headers: authHeaders(gpa.token, tenantA)
    });
    expect(findings.ok()).toBeTruthy();
    const findingList = await findings.json();
    expect((findingList.data || []).length).toBeGreaterThan(0);
    const specialty = (findingList.data || []).find((f: any) => String(f.fingerprint || '').includes('missing_specialty'));

    if (specialty) {
      const badResolve = await api.post(`${API}/credentialing-qa/findings/${specialty.id}/resolve`, {
        headers: authHeaders(gpa.token, tenantA),
        data: { mode: 'RESOLVED' }
      });
      expect(badResolve.status()).toBe(409);
    }

    const clientA = await apiLogin(api, fixtures.users.clientA.email);
    const clientScan = await api.post(`${API}/credentialing-qa/scan`, {
      headers: authHeaders(clientA.token, tenantA),
      data: { persist: false }
    });
    expect([403, 401]).toContain(clientScan.status());

    const providerA = await apiLogin(api, fixtures.users.providerA.email);
    const providerDash = await api.get(`${API}/credentialing-qa/dashboard`, {
      headers: authHeaders(providerA.token)
    });
    expect([403, 401]).toContain(providerDash.status());

    const clientB = await apiLogin(api, fixtures.users.clientB.email);
    const cross = await api.get(`${API}/credentialing-qa/dashboard`, {
      headers: authHeaders(clientB.token, tenantB)
    });
    // Client role cannot use GPA QA dashboard
    expect([403, 401]).toContain(cross.status());

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await setAuthStorage(page, gpa, tenantA);
    await page.goto('/credentialing-qa');
    await expect(page.getByText(/Verification & data integrity/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/not automated state-board/i)).toBeVisible();
    await ctx.close();
    await api.dispose();
  });
});
