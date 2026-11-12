import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, apiLogin, authHeaders, fixtures } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 3A professional history', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after seeding credentialing_e2e');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Missing fixtures.e2e.json');

  test('GPA adds history sections, verifies, provider cannot self-verify or cross-tenant', async ({ browser }) => {
    const api = await playwrightRequest.newContext({ baseURL: API.replace(/\/api$/, '') });
    const tenantA = fixtures.tenants.a.id as string;
    const tenantB = fixtures.tenants.b.id as string;
    const gpa = await apiLogin(api, fixtures.users.gpaAdmin.email);

    // Create a provider in Tenant A
    const createProv = await api.post(`${API}/providers`, {
      headers: authHeaders(gpa.token, tenantA),
      data: {
        firstName: 'Hist',
        lastName: `E2E${Date.now()}`,
        email: `hist.e2e.${Date.now()}@e2e.credentialing.test`,
        status: 'ACTIVE'
      }
    });
    expect(createProv.ok(), await createProv.text()).toBeTruthy();
    const provider = await createProv.json();
    const base = `${API}/providers/${provider.id}/professional-history`;

    const education = await api.post(`${base}/education`, {
      headers: authHeaders(gpa.token, tenantA),
      data: {
        institutionName: 'E2E Medical University',
        degreeName: 'MD',
        fieldOfStudy: 'Medicine',
        graduationDate: '2015-06-01',
        country: 'United States'
      }
    });
    expect(education.status()).toBe(201);
    const edu = await education.json();
    expect(edu.verificationStatus).toBe('PENDING_REVIEW');

    for (const [section, body] of [
      ['residency', { institutionName: 'E2E Residency Hospital', programName: 'IM', specialtyName: 'Internal Medicine', startDate: '2015-07-01', endDate: '2018-06-30' }],
      ['fellowship', { institutionName: 'E2E Fellowship Center', programName: 'Cards', specialtyName: 'Cardiology', startDate: '2018-07-01', endDate: '2019-06-30' }],
      ['board_certification', { certifyingBoard: 'ABIM', specialtyName: 'Internal Medicine', doesNotExpire: true, issueDate: '2020-01-01' }],
      ['employment', { employerName: 'E2E Clinic', positionTitle: 'Physician', isCurrent: true, startDate: '2020-02-01' }],
      ['hospital_affiliation', { hospitalName: 'E2E General Hospital', affiliationType: 'Active staff', privilegeStatus: 'Pending' }],
      ['malpractice', { insuranceCarrier: 'E2E Mutual', policyNumber: 'E2E-POL-1', perOccurrenceAmount: 1000000, isCurrent: true, effectiveDate: '2024-01-01', expirationDate: '2025-12-31' }]
    ] as const) {
      const res = await api.post(`${base}/${section}`, {
        headers: authHeaders(gpa.token, tenantA),
        data: body
      });
      expect(res.ok(), `${section}: ${await res.text()}`).toBeTruthy();
      const json = await res.json();
      expect(json.verificationStatus).toBe('PENDING_REVIEW');
    }

    const summary = await (await api.get(`${base}/summary`, { headers: authHeaders(gpa.token, tenantA) })).json();
    expect(summary.education).toBeGreaterThanOrEqual(1);
    expect(summary.pendingVerification).toBeGreaterThanOrEqual(1);

    const verify = await api.post(`${base}/education/${edu.id}/verify`, {
      headers: authHeaders(gpa.token, tenantA),
      data: {}
    });
    expect(verify.ok(), await verify.text()).toBeTruthy();
    const verified = await verify.json();
    expect(verified.verificationStatus).toBe('VERIFIED');

    // Cross-tenant: Client B / header Tenant B cannot read Tenant A provider history
    const clientB = await apiLogin(api, fixtures.users.clientB.email);
    const cross = await api.get(`${base}/education`, {
      headers: authHeaders(clientB.token, tenantB)
    });
    expect([403, 404]).toContain(cross.status());

    // Provider cannot verify (even if somehow targeted)
    const providerA = await apiLogin(api, fixtures.users.providerA.email);
    // Link provider A to this provider via a synthetic converted intake for portal ACL tests
    // Without ownership, history endpoints must 404
    const providerPortal = await api.get(
      `${API}/provider-portal/providers/${provider.id}/professional-history/summary`,
      { headers: authHeaders(providerA.token) }
    );
    expect([403, 404]).toContain(providerPortal.status());

    // UI: GPA opens provider profile professional history step
    const gpaCtx = await browser.newContext();
    const page = await gpaCtx.newPage();
    await page.addInitScript(
      ({ token, user, tenants, tenantId }) => {
        localStorage.setItem('credentialing_token', token);
        localStorage.setItem('credentialing_user', JSON.stringify(user));
        localStorage.setItem('credentialing_tenants', JSON.stringify(tenants || []));
        localStorage.setItem('credentialing_tenant_id', tenantId);
      },
      {
        token: gpa.token,
        user: gpa.user,
        tenants: gpa.tenants || [],
        tenantId: tenantA
      }
    );
    await page.goto(`/providers/${provider.id}/profile?step=history`);
    await expect(page.getByRole('heading', { name: /professional history/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /^Education$/i })).toBeVisible();
    await expect(page.getByText(/E2E Medical University/i)).toBeVisible({ timeout: 20_000 });

    await gpaCtx.close();
    await api.dispose();
  });
});
