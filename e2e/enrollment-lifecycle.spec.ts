import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, apiLogin, authHeaders, fixtures } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 4A enrollment lifecycle', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after seeding credentialing_e2e');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Missing fixtures');

  test('GPA create → prepare → submit → acknowledge → approve → effective; client cannot approve; cross-tenant deny', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API.replace(/\/api$/, '') });
    const tenantA = fixtures.tenants.a.id as string;
    const tenantB = fixtures.tenants.b.id as string;
    const orgId = fixtures.organizations.a as string;
    const practiceId = fixtures.practiceA as string | undefined;
    const gpa = await apiLogin(api, fixtures.users.gpaAdmin.email);
    const headers = authHeaders(gpa.token, tenantA);

    const stamp = Date.now();

    // Platform payers/plans via resources API (not /directories/*)
    const payerRes = await api.post(`${API}/payers`, {
      headers,
      data: { name: `E2E Payer ${stamp}`, payerCode: `E2E${stamp}`, status: 'ACTIVE' }
    });
    expect(payerRes.ok(), await payerRes.text()).toBeTruthy();
    const payer = await payerRes.json();
    const payerId = payer.id as string;

    const planRes = await api.post(`${API}/plans`, {
      headers,
      data: { payerId, name: `E2E Plan ${stamp}`, status: 'ACTIVE' }
    });
    expect(planRes.ok(), await planRes.text()).toBeTruthy();
    const planId = (await planRes.json()).id as string;

    // Wrong payer + plan combination must be rejected
    const otherPayerRes = await api.post(`${API}/payers`, {
      headers,
      data: { name: `E2E Other Payer ${stamp}`, payerCode: `OTH${stamp}`, status: 'ACTIVE' }
    });
    expect(otherPayerRes.ok(), await otherPayerRes.text()).toBeTruthy();
    const otherPayerId = (await otherPayerRes.json()).id as string;

    const facCreate = await api.post(`${API}/facilities`, {
      headers,
      data: {
        name: `E2E Facility ${stamp}`,
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
        firstName: 'Enroll',
        lastName: `E2E${stamp}`,
        email: `enr.e2e.${stamp}@e2e.credentialing.test`,
        status: 'ACTIVE'
      }
    });
    expect(provRes.ok(), await provRes.text()).toBeTruthy();
    const providerId = (await provRes.json()).id as string;

    const aff = await api.post(`${API}/directory/provider-facilities`, {
      headers,
      data: { providerId, facilityId, approvalStatus: 'Approved' }
    });
    expect(aff.ok(), await aff.text()).toBeTruthy();

    const bad = await api.post(`${API}/enrollments`, {
      headers,
      data: {
        facilityId,
        providerId,
        payerId: otherPayerId,
        payerPlanId: planId,
        practiceId: practiceId || undefined,
        organizationId: orgId,
        subject: `Bad combo ${stamp}`
      }
    });
    expect([400, 404, 409]).toContain(bad.status());

    const create = await api.post(`${API}/enrollments`, {
      headers,
      data: {
        facilityId,
        providerId,
        payerId,
        payerPlanId: planId,
        practiceId: practiceId || undefined,
        organizationId: orgId,
        subject: `E2E Enrollment ${stamp}`
      }
    });
    expect(create.status(), await create.text()).toBe(201);
    const enrollment = await create.json();
    expect(enrollment.status).toBe('NOT_STARTED');
    expect(enrollment.attention).toBeTruthy();

    const prepare = await api.post(`${API}/enrollments/${enrollment.id}/prepare`, { headers });
    expect(prepare.ok(), await prepare.text()).toBeTruthy();

    const ready = await api.post(`${API}/enrollments/${enrollment.id}/ready`, { headers });
    expect(ready.ok(), await ready.text()).toBeTruthy();

    const submit = await api.post(`${API}/enrollments/${enrollment.id}/submit`, {
      headers,
      data: { referenceNo: 'E2E-SUB-1', notes: 'Recorded submission (not automated)' }
    });
    expect(submit.ok(), await submit.text()).toBeTruthy();
    expect((await submit.json()).status).toBe('SUBMITTED');

    const ack = await api.post(`${API}/enrollments/${enrollment.id}/acknowledge`, {
      headers,
      data: { referenceNo: 'E2E-ACK-1' }
    });
    expect(ack.ok(), await ack.text()).toBeTruthy();

    const approve = await api.post(`${API}/enrollments/${enrollment.id}/approve`, {
      headers,
      data: { notes: 'Approval letter on file', payerEnrollmentId: 'E2E-PAY-1' }
    });
    expect(approve.ok(), await approve.text()).toBeTruthy();

    const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const effective = await api.post(`${API}/enrollments/${enrollment.id}/effective`, {
      headers,
      data: { effectiveAt: future }
    });
    expect(effective.ok(), await effective.text()).toBeTruthy();
    const effBody = await effective.json();
    expect(effBody.status).toBe('EFFECTIVE');
    expect(effBody.attention).toBe('APPROVED_NOT_EFFECTIVE');

    const follow = await api.post(`${API}/enrollments/${enrollment.id}/follow-ups`, {
      headers,
      data: {
        dueAt: new Date(Date.now() - 86400000).toISOString(),
        reason: 'Overdue portal check'
      }
    });
    expect(follow.status()).toBe(201);

    const dash = await api.get(`${API}/enrollments/dashboard`, { headers });
    expect(dash.ok(), await dash.text()).toBeTruthy();
    const dashBody = await dash.json();
    expect(dashBody.counts.total).toBeGreaterThan(0);
    expect(dashBody.counts.overdueFollowUps).toBeGreaterThanOrEqual(1);

    const bypass = await api.patch(`${API}/enrollments/${enrollment.id}`, {
      headers,
      data: { status: 'DENIED' }
    });
    expect(bypass.status()).toBe(400);

    const clientA = await apiLogin(api, fixtures.users.clientA.email);
    const clientApprove = await api.post(`${API}/enrollments/${enrollment.id}/approve`, {
      headers: authHeaders(clientA.token, tenantA),
      data: { notes: 'client cannot' }
    });
    expect([403, 401]).toContain(clientApprove.status());

    const providerA = await apiLogin(api, fixtures.users.providerA.email);
    const providerEff = await api.post(`${API}/enrollments/${enrollment.id}/effective`, {
      headers: authHeaders(providerA.token),
      data: { effectiveAt: future }
    });
    expect([403, 401]).toContain(providerEff.status());

    const clientB = await apiLogin(api, fixtures.users.clientB.email);
    const cross = await api.get(`${API}/enrollments/${enrollment.id}`, {
      headers: authHeaders(clientB.token, tenantB)
    });
    expect([403, 404]).toContain(cross.status());

    await api.dispose();
  });
});
