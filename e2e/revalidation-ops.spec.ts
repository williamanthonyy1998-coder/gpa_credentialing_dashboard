import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, apiLogin, authHeaders, fixtures } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 4E revalidation, deadlines & reports', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after seeding credentialing_e2e');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Missing fixtures');

  test('create revalidation; worklist; lifecycle; deadlines; reports; exports; client cannot finalize', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API.replace(/\/api$/, '') });
    const tenantA = fixtures.tenants.a.id as string;
    const gpa = await apiLogin(api, fixtures.users.gpaAdmin.email);
    const client = await apiLogin(api, fixtures.users.clientA.email);
    const headers = authHeaders(gpa.token, tenantA);
    const stamp = Date.now();
    const orgId = fixtures.organizations.a as string;

    const fac = await api.post(`${API}/facilities`, {
      headers,
      data: { name: `Rev Fac ${stamp}`, organizationId: orgId, status: 'ACTIVE' }
    });
    expect(fac.ok(), await fac.text()).toBeTruthy();
    const facilityId = (await fac.json()).id as string;

    const prov = await api.post(`${API}/providers`, {
      headers,
      data: {
        firstName: 'Rev',
        lastName: `E2E${stamp}`,
        primarySpecialty: 'Family Medicine',
        email: `rev.e2e.${stamp}@e2e.credentialing.test`,
        status: 'ACTIVE'
      }
    });
    expect(prov.ok(), await prov.text()).toBeTruthy();
    const providerId = (await prov.json()).id as string;
    await api.post(`${API}/directory/provider-facilities`, {
      headers,
      data: { providerId, facilityId, approvalStatus: 'Approved' }
    });

    const payerRes = await api.post(`${API}/payers`, {
      headers,
      data: { name: `Rev Payer ${stamp}`, payerCode: `RV${stamp}`, status: 'ACTIVE' }
    });
    expect(payerRes.ok()).toBeTruthy();
    const payerId = (await payerRes.json()).id as string;
    const planRes = await api.post(`${API}/plans`, {
      headers,
      data: { payerId, name: `Rev Plan ${stamp}`, status: 'ACTIVE' }
    });
    expect(planRes.ok()).toBeTruthy();
    const planId = (await planRes.json()).id as string;

    const enr = await api.post(`${API}/enrollments`, {
      headers,
      data: {
        subject: `Rev Enr ${stamp}`,
        providerId,
        organizationId: orgId,
        facilityId,
        payerPlanId: planId,
        enrollmentType: 'INDIVIDUAL'
      }
    });
    expect(enr.ok(), await enr.text()).toBeTruthy();
    const enrollmentId = (await enr.json()).id as string;
    const beforeStatus = (await (await api.get(`${API}/enrollments/${enrollmentId}`, { headers })).json()).status;

    const due = new Date(Date.now() + 40 * 86400000).toISOString();
    const create = await api.post(`${API}/enrollments/${enrollmentId}/revalidations`, {
      headers,
      data: {
        revalidationType: 'COMMERCIAL_REVALIDATION',
        dueDate: due,
        dueDateSource: 'CONFIRMED',
        source: 'Payer letter',
        sourceReference: `LETTER-${stamp}`
      }
    });
    expect(create.status(), await create.text()).toBe(201);
    const reval = await create.json();
    expect(reval.id).toBeTruthy();

    const afterCreate = await api.get(`${API}/enrollments/${enrollmentId}`, { headers });
    expect((await afterCreate.json()).status).toBe(beforeStatus);

    const clientCreate = await api.post(`${API}/enrollments/${enrollmentId}/revalidations`, {
      headers: authHeaders(client.token, tenantA),
      data: { revalidationType: 'MEDICARE_REVALIDATION', dueDateSource: 'MANUAL' }
    });
    expect(clientCreate.status()).toBe(403);

    const wl = await api.get(`${API}/credentialing/revalidation-worklist`, { headers });
    expect(wl.ok()).toBeTruthy();
    const wlBody = await wl.json();
    expect(wlBody.items.some((i: any) => i.id === reval.id)).toBeTruthy();

    await api.post(`${API}/revalidations/${reval.id}/prepare`, { headers, data: {} });
    await api.post(`${API}/revalidations/${reval.id}/ready`, { headers, data: {} });
    const submit = await api.post(`${API}/revalidations/${reval.id}/submit`, {
      headers,
      data: { confirmedSent: true, referenceNumber: `REF-${stamp}` }
    });
    expect(submit.ok(), await submit.text()).toBeTruthy();

    const clientSubmit = await api.post(`${API}/revalidations/${reval.id}/acknowledge`, {
      headers: authHeaders(client.token, tenantA),
      data: {}
    });
    expect(clientSubmit.status()).toBe(403);

    const deadlines = await api.get(`${API}/credentialing/deadlines?withinDays=120`, { headers });
    expect(deadlines.ok()).toBeTruthy();

    const reports = await api.get(`${API}/credentialing/reports/enrollments`, { headers });
    expect(reports.ok()).toBeTruthy();

    const xlsx = await api.get(`${API}/credentialing/reports/export.xlsx`, { headers });
    expect(xlsx.ok(), await xlsx.text()).toBeTruthy();
    expect(xlsx.headers()['content-type']).toContain('spreadsheetml');

    const pdf = await api.get(`${API}/credentialing/reports/export.pdf`, { headers });
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()['content-type']).toContain('pdf');

    const clientExport = await api.get(`${API}/credentialing/reports/export.xlsx`, {
      headers: authHeaders(client.token, tenantA)
    });
    expect(clientExport.status()).toBe(403);

    const qa = await api.post(`${API}/credentialing-qa/scan`, {
      headers,
      data: { limit: 20, persist: true }
    });
    expect(qa.ok(), await qa.text()).toBeTruthy();
  });
});
