import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, apiLogin, authHeaders, fixtures } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 4D external integrations foundation', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after seeding credentialing_e2e');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Missing fixtures');

  test('registry list; tenant clone; manual fallback; client denied configure; no fake CONNECTED', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API.replace(/\/api$/, '') });
    const tenantA = fixtures.tenants.a.id as string;
    const gpa = await apiLogin(api, fixtures.users.gpaAdmin.email);
    const client = await apiLogin(api, fixtures.users.clientA.email);
    const headers = authHeaders(gpa.token, tenantA);
    const stamp = Date.now();

    const list = await api.get(`${API}/integrations`, { headers });
    expect(list.ok(), await list.text()).toBeTruthy();
    const catalog = await list.json();
    expect(catalog.items?.length).toBeGreaterThan(0);
    const caqh = catalog.items.find((i: any) => i.integrationType === 'CAQH');
    const pecos = catalog.items.find((i: any) => i.integrationType === 'PECOS');
    expect(caqh).toBeTruthy();
    expect(pecos?.status).toBe('MANUAL_ONLY');
    expect(JSON.stringify(catalog)).not.toMatch(/credentialSecretRef/);
    expect(caqh.status).not.toBe('CONNECTED');

    const clientList = await api.get(`${API}/integrations`, {
      headers: authHeaders(client.token, tenantA)
    });
    expect(clientList.ok()).toBeTruthy();

    const createDenied = await api.post(`${API}/integrations`, {
      headers: authHeaders(client.token, tenantA),
      data: {
        integrationType: 'CAQH',
        displayName: 'Nope',
        systemName: 'nope'
      }
    });
    expect(createDenied.status()).toBe(403);

    const create = await api.post(`${API}/integrations`, {
      headers,
      data: {
        integrationType: 'PAYER_PORTAL',
        displayName: `Manual Portal ${stamp}`,
        systemName: `PORTAL-${stamp}`,
        cloneFromPlatformId: catalog.items.find((i: any) => i.integrationType === 'PAYER_PORTAL')?.id
      }
    });
    expect(create.status()).toBe(201);
    const integration = await create.json();
    expect(integration.status).not.toBe('CONNECTED');
    expect(integration.credentialSecretRef).toBeUndefined();

    const orgId = fixtures.organizations.a as string;
    const practiceId = fixtures.practiceA as string | undefined;
    const fac = await api.post(`${API}/facilities`, {
      headers,
      data: {
        name: `Int Fac ${stamp}`,
        organizationId: orgId,
        practiceId: practiceId || undefined,
        status: 'ACTIVE'
      }
    });
    expect(fac.ok(), await fac.text()).toBeTruthy();
    const facilityId = (await fac.json()).id as string;

    const provRes = await api.post(`${API}/providers`, {
      headers,
      data: {
        firstName: 'Int',
        lastName: `E2E${stamp}`,
        primarySpecialty: 'Family Medicine',
        email: `int.e2e.${stamp}@e2e.credentialing.test`,
        status: 'ACTIVE'
      }
    });
    expect(provRes.ok(), await provRes.text()).toBeTruthy();
    const pid = (await provRes.json()).id as string;

    const authGrant = await api.post(`${API}/providers/${pid}/integration-authorizations`, {
      headers,
      data: { integrationId: integration.id, notes: 'E2E delegation' }
    });
    expect(authGrant.status(), await authGrant.text()).toBe(201);

    const payerRes = await api.post(`${API}/payers`, {
      headers,
      data: { name: `Int Payer ${stamp}`, payerCode: `IP${stamp}`, status: 'ACTIVE' }
    });
    expect(payerRes.ok()).toBeTruthy();
    const payerId = (await payerRes.json()).id as string;
    const planRes = await api.post(`${API}/plans`, {
      headers,
      data: { payerId, name: `Int Plan ${stamp}`, status: 'ACTIVE' }
    });
    expect(planRes.ok()).toBeTruthy();
    const planId = (await planRes.json()).id as string;

    await api.post(`${API}/directory/provider-facilities`, {
      headers,
      data: { providerId: pid, facilityId, approvalStatus: 'Approved' }
    });

    const enr = await api.post(`${API}/enrollments`, {
      headers,
      data: {
        subject: `Int Enr ${stamp}`,
        providerId: pid,
        organizationId: orgId,
        facilityId,
        payerPlanId: planId,
        enrollmentType: 'INDIVIDUAL'
      }
    });
    expect(enr.ok(), await enr.text()).toBeTruthy();
    const enrollmentId = (await enr.json()).id as string;

    const before = await api.get(`${API}/enrollments/${enrollmentId}`, { headers });
    const beforeStatus = (await before.json()).status;

    const manual = await api.post(`${API}/enrollments/${enrollmentId}/integrations/manual-action`, {
      headers,
      data: {
        integrationId: integration.id,
        actionType: 'PORTAL_CHECK',
        summary: 'Staff checked payer portal manually',
        externalReference: 'E2E-REF',
        channel: 'PAYER_PORTAL_MANUAL'
      }
    });
    expect(manual.status(), await manual.text()).toBe(201);
    const manualBody = await manual.json();
    expect(manualBody.enrollmentStatus).toBe(beforeStatus);
    expect(manualBody.operation.operationStatus).toBe('REQUIRES_MANUAL_ACTION');

    const testConn = await api.post(`${API}/integrations/${integration.id}/test-connection`, { headers });
    expect(testConn.ok(), await testConn.text()).toBeTruthy();
    const testBody = await testConn.json();
    expect(testBody.integration.status).not.toBe('CONNECTED');
  });
});
