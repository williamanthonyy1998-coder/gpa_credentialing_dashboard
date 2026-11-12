import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, apiLogin, authHeaders, fixtures } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 3B license lifecycle', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after seeding credentialing_e2e');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Missing fixtures');

  test('GPA create/submit/verify license; renew preserves prior; cross-tenant deny; provider cannot verify', async ({ browser }) => {
    const api = await playwrightRequest.newContext({ baseURL: API.replace(/\/api$/, '') });
    const tenantA = fixtures.tenants.a.id as string;
    const tenantB = fixtures.tenants.b.id as string;
    const gpa = await apiLogin(api, fixtures.users.gpaAdmin.email);

    const provRes = await api.post(`${API}/providers`, {
      headers: authHeaders(gpa.token, tenantA),
      data: {
        firstName: 'Lic',
        lastName: `E2E${Date.now()}`,
        email: `lic.e2e.${Date.now()}@e2e.credentialing.test`,
        status: 'ACTIVE'
      }
    });
    expect(provRes.ok(), await provRes.text()).toBeTruthy();
    const provider = await provRes.json();

    const create = await api.post(`${API}/provider-licenses/providers/${provider.id}`, {
      headers: authHeaders(gpa.token, tenantA),
      data: {
        type: 'MD',
        number: `E2E-MD-${Date.now()}`,
        state: 'TX',
        issuedAt: '2020-01-01',
        expiresAt: '2027-06-01'
      }
    });
    expect(create.status()).toBe(201);
    const lic = await create.json();
    expect(lic.verificationStatus).toBe('NOT_SUBMITTED');

    const submit = await api.post(`${API}/provider-licenses/${lic.id}/submit`, {
      headers: authHeaders(gpa.token, tenantA)
    });
    expect(submit.ok(), await submit.text()).toBeTruthy();

    const verify = await api.post(`${API}/provider-licenses/${lic.id}/verify`, {
      headers: authHeaders(gpa.token, tenantA),
      data: { verificationSource: 'manual_review' }
    });
    expect(verify.ok(), await verify.text()).toBeTruthy();
    expect((await verify.json()).verificationStatus).toBe('VERIFIED');

    const renew = await api.post(`${API}/provider-licenses/${lic.id}/renew`, {
      headers: authHeaders(gpa.token, tenantA),
      data: { issuedAt: '2026-01-01', expiresAt: '2028-06-01' }
    });
    expect(renew.status()).toBe(201);
    const renewal = await renew.json();
    expect(renewal.verificationStatus).toBe('PENDING_REVIEW');

    const prior = await (await api.get(`${API}/provider-licenses/${lic.id}`, {
      headers: authHeaders(gpa.token, tenantA)
    })).json();
    expect(String(prior.expiresAt).startsWith('2027')).toBeTruthy();

    const clientB = await apiLogin(api, fixtures.users.clientB.email);
    const cross = await api.get(`${API}/provider-licenses/providers/${provider.id}`, {
      headers: authHeaders(clientB.token, tenantB)
    });
    expect([403, 404]).toContain(cross.status());

    const providerA = await apiLogin(api, fixtures.users.providerA.email);
    const selfVerify = await api.post(`${API}/provider-licenses/${lic.id}/verify`, {
      headers: authHeaders(providerA.token)
    });
    expect([401, 403, 404]).toContain(selfVerify.status());

    const summary = await api.get(`${API}/provider-licenses/expiration-summary`, {
      headers: authHeaders(gpa.token, tenantA),
      params: { providerId: provider.id }
    });
    expect(summary.ok()).toBeTruthy();
    const s = await summary.json();
    expect(s.counts.total).toBeGreaterThanOrEqual(1);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(
      ({ token, user, tenants, tenantId }) => {
        localStorage.setItem('credentialing_token', token);
        localStorage.setItem('credentialing_user', JSON.stringify(user));
        localStorage.setItem('credentialing_tenants', JSON.stringify(tenants || []));
        localStorage.setItem('credentialing_tenant_id', tenantId);
      },
      { token: gpa.token, user: gpa.user, tenants: gpa.tenants || [], tenantId: tenantA }
    );
    await page.goto(`/providers/${provider.id}/profile?step=licenses`);
    await expect(page.getByRole('heading', { name: /licenses/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/credential completeness/i)).toBeVisible();
    await ctx.close();
    await api.dispose();
  });
});
