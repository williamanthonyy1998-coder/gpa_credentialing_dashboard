import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, apiLogin, authHeaders, fixtures } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 4B enrollment packet & payer requirements', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after seeding credentialing_e2e');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Missing fixtures');

  test('GPA configures requirements, evaluates packet, maps data; client cannot waive; status unchanged', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API.replace(/\/api$/, '') });
    const tenantA = fixtures.tenants.a.id as string;
    const tenantB = fixtures.tenants.b.id as string;
    const orgId = fixtures.organizations.a as string;
    const practiceId = fixtures.practiceA as string | undefined;
    const gpa = await apiLogin(api, fixtures.users.gpaAdmin.email);
    const headers = authHeaders(gpa.token, tenantA);
    const stamp = Date.now();

    const payerRes = await api.post(`${API}/payers`, {
      headers,
      data: { name: `Pkt Payer ${stamp}`, payerCode: `PK${stamp}`, status: 'ACTIVE' }
    });
    expect(payerRes.ok(), await payerRes.text()).toBeTruthy();
    const payerId = (await payerRes.json()).id as string;

    const planRes = await api.post(`${API}/plans`, {
      headers,
      data: { payerId, name: `Pkt Plan ${stamp}`, status: 'ACTIVE' }
    });
    expect(planRes.ok(), await planRes.text()).toBeTruthy();
    const planId = (await planRes.json()).id as string;

    const reqRes = await api.post(`${API}/payer-requirements`, {
      headers,
      data: {
        scope: 'PLATFORM',
        payerId,
        code: `SPEC-${stamp}`,
        title: 'Primary Specialty',
        category: 'SPECIALTY',
        isRequired: true,
        status: 'ACTIVE',
        source: 'GPA authorized test configuration'
      }
    });
    expect(reqRes.status(), await reqRes.text()).toBe(201);

    const planReq = await api.post(`${API}/payer-requirements`, {
      headers,
      data: {
        scope: 'PLATFORM',
        payerId,
        payerPlanId: planId,
        code: `W9-${stamp}`,
        title: 'W-9 Tax Form',
        category: 'TAX_W9',
        documentCategoryCode: 'IRS',
        isRequired: true,
        status: 'ACTIVE'
      }
    });
    expect(planReq.ok(), await planReq.text()).toBeTruthy();

    const preview = await api.post(`${API}/payer-requirements/preview`, {
      headers,
      data: {
        payerId,
        payerPlanId: planId,
        enrollmentType: 'INDIVIDUAL',
        hasFacility: true
      }
    });
    expect(preview.ok(), await preview.text()).toBeTruthy();
    const previewBody = await preview.json();
    expect(previewBody.items.length).toBeGreaterThan(0);

    const clientA = await apiLogin(api, fixtures.users.clientA.email);
    const clientCreate = await api.post(`${API}/payer-requirements`, {
      headers: authHeaders(clientA.token, tenantA),
      data: { scope: 'PLATFORM', title: 'Client cannot', isRequired: true }
    });
    expect([403, 401]).toContain(clientCreate.status());

    const facCreate = await api.post(`${API}/facilities`, {
      headers,
      data: {
        name: `Pkt Facility ${stamp}`,
        organizationId: orgId,
        practiceId: practiceId || undefined,
        status: 'ACTIVE'
      }
    });
    expect(facCreate.ok(), await facCreate.text()).toBeTruthy();
    const facilityId = (await facCreate.json()).id as string;

    const provRes = await api.post(`${API}/providers`, {
      headers,
      data: {
        firstName: 'Pkt',
        lastName: `E2E${stamp}`,
        // Omit NPI when not required — avoids global unique collisions across E2E runs
        primarySpecialty: 'Internal Medicine',
        email: `pkt.e2e.${stamp}@e2e.credentialing.test`,
        status: 'ACTIVE'
      }
    });
    expect(provRes.ok(), await provRes.text()).toBeTruthy();
    const providerId = (await provRes.json()).id as string;

    await api.post(`${API}/directory/provider-facilities`, {
      headers,
      data: { providerId, facilityId, approvalStatus: 'Approved' }
    });

    const create = await api.post(`${API}/enrollments`, {
      headers,
      data: {
        facilityId,
        providerId,
        payerId,
        payerPlanId: planId,
        organizationId: orgId,
        practiceId: practiceId || undefined,
        subject: `Pkt Enrollment ${stamp}`
      }
    });
    expect(create.status(), await create.text()).toBe(201);
    const enrollment = await create.json();
    expect(enrollment.status).toBe('NOT_STARTED');

    const evaluate = await api.post(`${API}/enrollments/${enrollment.id}/packet/evaluate`, { headers });
    expect(evaluate.ok(), await evaluate.text()).toBeTruthy();
    const evalBody = await evaluate.json();
    expect(evalBody.enrollmentStatus).toBe('NOT_STARTED');
    expect(evalBody.packet?.items?.length).toBeGreaterThan(0);
    const specItem = evalBody.packet.items.find((i: any) => String(i.requirementCode || '').startsWith('SPEC'));
    expect(specItem).toBeTruthy();
    expect(specItem.status).toBe('INFORMATION_AVAILABLE');
    expect(specItem.status).not.toBe('VERIFIED');

    const w9Item = evalBody.packet.items.find((i: any) => String(i.requirementCode || '').startsWith('W9'));
    expect(w9Item).toBeTruthy();

    const clientWaive = await api.post(
      `${API}/enrollments/${enrollment.id}/packet/requirements/${w9Item.id}/waive`,
      {
        headers: authHeaders(clientA.token, tenantA),
        data: { reason: 'client cannot waive' }
      }
    );
    expect([403, 401]).toContain(clientWaive.status());

    const verify = await api.post(
      `${API}/enrollments/${enrollment.id}/packet/requirements/${specItem.id}/review`,
      {
        headers,
        data: { decision: 'VERIFY', reason: 'Specialty confirmed' }
      }
    );
    expect(verify.ok(), await verify.text()).toBeTruthy();

    const after = await api.get(`${API}/enrollments/${enrollment.id}`, { headers });
    expect((await after.json()).status).toBe('NOT_STARTED');

    const clientB = await apiLogin(api, fixtures.users.clientB.email);
    const cross = await api.get(`${API}/enrollments/${enrollment.id}/packet`, {
      headers: authHeaders(clientB.token, tenantB)
    });
    expect([403, 404]).toContain(cross.status());

    await api.dispose();
  });
});
