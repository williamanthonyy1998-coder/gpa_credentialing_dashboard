import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, apiLogin, authHeaders, fixtures } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 2C cross-tenant isolation', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after seeding');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Missing fixtures.e2e.json');

  test('Provider A cannot access Tenant B intake or documents', async () => {
    const api = await playwrightRequest.newContext();
    const providerA = await apiLogin(api, fixtures.users.providerA.email);
    const denied = await api.get(`${API}/provider-portal/intakes/${fixtures.intakes.b}`, {
      headers: authHeaders(providerA.token)
    });
    expect(denied.status()).toBe(404);

    // Guessed document download
    const fakeDoc = await api.get(`${API}/provider-portal/documents/nonexistent/file`, {
      headers: authHeaders(providerA.token)
    });
    expect([403, 404]).toContain(fakeDoc.status());
    await api.dispose();
  });

  test('Client A cannot access Client B intake / org / invite APIs', async () => {
    const api = await playwrightRequest.newContext();
    const clientA = await apiLogin(api, fixtures.users.clientA.email);
    const tenantA = fixtures.tenants.a.id;
    const tenantB = fixtures.tenants.b.id;

    const crossIntake = await api.get(`${API}/portal/provider-intakes/${fixtures.intakes.b}`, {
      headers: authHeaders(clientA.token, tenantA)
    });
    expect([403, 404]).toContain(crossIntake.status());

    // Switching header to Tenant B without membership must deny
    const stealTenant = await api.get(`${API}/portal/provider-intakes`, {
      headers: authHeaders(clientA.token, tenantB)
    });
    expect([403, 401]).toContain(stealTenant.status());

    const orgB = await api.get(`${API}/organizations/${fixtures.organizations.b}`, {
      headers: authHeaders(clientA.token, tenantA)
    });
    expect([403, 404]).toContain(orgB.status());

    await api.dispose();
  });

  test('Revoked provider invitation cannot be accepted', async () => {
    const api = await playwrightRequest.newContext();
    const gpa = await apiLogin(api, fixtures.users.gpaAdmin.email);
    const tenantA = fixtures.tenants.a.id;

    const create = await api.post(`${API}/intake`, {
      headers: authHeaders(gpa.token, tenantA),
      data: {
        kind: 'PROVIDER',
        contactEmail: `revoke.${Date.now()}@e2e.credentialing.test`,
        payload: {}
      }
    });
    expect(create.ok()).toBeTruthy();
    const intake = await create.json();
    const invite = await api.post(`${API}/intake/${intake.id}/invite-provider`, {
      headers: authHeaders(gpa.token, tenantA),
      data: { email: intake.contactEmail, send: false }
    });
    expect(invite.status()).toBe(201);
    const body = await invite.json();
    const inviteId = body.invitation.id;
    const token = String(body.acceptanceUrl).split('/accept-provider-invitation/')[1];

    const revoke = await api.post(`${API}/intake/provider-invitations/${inviteId}/revoke`, {
      headers: authHeaders(gpa.token, tenantA)
    });
    expect(revoke.ok()).toBeTruthy();

    const accept = await api.get(`${API}/provider-invitations/${encodeURIComponent(token)}`);
    expect(accept.status()).toBe(400);
    await api.dispose();
  });

  test('Provider UI direct URL to other intake shows not found', async ({ browser }) => {
    const api = await playwrightRequest.newContext();
    const providerA = await apiLogin(api, fixtures.users.providerA.email);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem('credentialing_token', token);
        localStorage.setItem('credentialing_user', JSON.stringify(user));
      },
      { token: providerA.token, user: providerA.user }
    );
    await page.goto(`/provider-portal/intakes/${fixtures.intakes.b}`);
    await expect(page.getByText(/not found|could not load/i)).toBeVisible({ timeout: 20_000 });
    await ctx.close();
    await api.dispose();
  });
});
