import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, apiLogin, authHeaders, fixtures } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 4C submission, communications & follow-ups', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after seeding credentialing_e2e');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Missing fixtures');

  test('prepare/confirm submission; communication; follow-up; client denied; status transitions via lifecycle', async () => {
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
      data: { name: `Sub Payer ${stamp}`, payerCode: `SU${stamp}`, status: 'ACTIVE' }
    });
    expect(payerRes.ok(), await payerRes.text()).toBeTruthy();
    const payerId = (await payerRes.json()).id as string;
    const planRes = await api.post(`${API}/plans`, {
      headers,
      data: { payerId, name: `Sub Plan ${stamp}`, status: 'ACTIVE' }
    });
    expect(planRes.ok(), await planRes.text()).toBeTruthy();
    const planId = (await planRes.json()).id as string;

    await api.post(`${API}/payer-requirements`, {
      headers,
      data: {
        scope: 'PLATFORM',
        payerId,
        code: `SPEC-${stamp}`,
        title: 'Primary Specialty',
        category: 'SPECIALTY',
        isRequired: true,
        status: 'ACTIVE'
      }
    });

    const facCreate = await api.post(`${API}/facilities`, {
      headers,
      data: {
        name: `Sub Facility ${stamp}`,
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
        firstName: 'Sub',
        lastName: `E2E${stamp}`,
        primarySpecialty: 'Cardiology',
        email: `sub.e2e.${stamp}@e2e.credentialing.test`,
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
        subject: `Sub Enrollment ${stamp}`
      }
    });
    expect(create.status(), await create.text()).toBe(201);
    const enrollment = await create.json();

    await api.post(`${API}/enrollments/${enrollment.id}/prepare`, { headers });
    await api.post(`${API}/enrollments/${enrollment.id}/ready`, { headers });
    const evalPkt = await api.post(`${API}/enrollments/${enrollment.id}/packet/evaluate`, { headers });
    expect(evalPkt.ok(), await evalPkt.text()).toBeTruthy();

    const prep = await api.post(`${API}/enrollments/${enrollment.id}/submissions/prepare`, {
      headers,
      data: { channel: 'EMAIL', notes: 'Prepared packet for send' }
    });
    expect(prep.status(), await prep.text()).toBe(201);
    const prepBody = await prep.json();
    expect(prepBody.enrollmentStatus).not.toBe('SUBMITTED');
    expect(prepBody.submission.confirmationStatus).toBe('PREPARED');

    const mid = await api.get(`${API}/enrollments/${enrollment.id}`, { headers });
    expect((await mid.json()).status).toBe('READY_TO_SUBMIT');

    const badConfirm = await api.post(`${API}/enrollments/${enrollment.id}/submissions/confirm`, {
      headers,
      data: { confirmedSent: false }
    });
    expect(badConfirm.status()).toBe(400);

    const confirm = await api.post(`${API}/enrollments/${enrollment.id}/submissions/confirm`, {
      headers,
      data: {
        confirmedSent: true,
        channel: 'EMAIL',
        referenceNo: `REF-${stamp}`,
        createInitialFollowUp: true,
        // Packet may still show REVIEW_REQUIRED for evidence items; allow documented GPA override in E2E
        overrideReason: 'E2E: specialty mapped; authorized GPA exception for remaining optional evidence'
      }
    });
    expect(confirm.ok(), await confirm.text()).toBeTruthy();
    const confBody = await confirm.json();
    expect(confBody.submission.confirmationStatus).toBe('CONFIRMED');

    const after = await api.get(`${API}/enrollments/${enrollment.id}`, { headers });
    expect((await after.json()).status).toBe('SUBMITTED');

    const subs = await api.get(`${API}/enrollments/${enrollment.id}/submissions`, { headers });
    expect((await subs.json()).items.length).toBeGreaterThan(0);

    const comm = await api.post(`${API}/enrollments/${enrollment.id}/communications`, {
      headers,
      data: {
        communicationType: 'STATUS_INQUIRY',
        channel: 'PHONE',
        channelExplanation: 'Called payer support',
        summary: 'Asked for receipt confirmation'
      }
    });
    expect(comm.status()).toBe(201);

    const follow = await api.post(`${API}/enrollments/${enrollment.id}/follow-ups`, {
      headers,
      data: {
        followUpType: 'STATUS_CHECK',
        dueAt: new Date(Date.now() - 3600000).toISOString(),
        description: 'Overdue status check'
      }
    });
    expect(follow.status()).toBe(201);
    const followId = (await follow.json()).id;

    const followList = await api.get(`${API}/enrollments/${enrollment.id}/follow-ups`, { headers });
    const items = (await followList.json()).items || [];
    expect(items.some((f: any) => f.overdue)).toBeTruthy();

    const complete = await api.post(`${API}/enrollments/${enrollment.id}/follow-ups/${followId}/complete`, {
      headers,
      data: { completionNotes: 'Heard back' }
    });
    expect(complete.ok()).toBeTruthy();

    const timeline = await api.get(`${API}/enrollments/${enrollment.id}/timeline`, { headers });
    expect(timeline.ok()).toBeTruthy();
    expect(((await timeline.json()).events || []).length).toBeGreaterThan(0);

    const clientA = await apiLogin(api, fixtures.users.clientA.email);
    const clientConfirm = await api.post(`${API}/enrollments/${enrollment.id}/submissions/confirm`, {
      headers: authHeaders(clientA.token, tenantA),
      data: { confirmedSent: true, channel: 'EMAIL' }
    });
    expect([403, 401]).toContain(clientConfirm.status());

    const clientView = await api.get(`${API}/enrollments/${enrollment.id}/submissions`, {
      headers: authHeaders(clientA.token, tenantA)
    });
    // Client may view own tenant enrollment submissions (sanitized) or be denied by org ACL — either ok if not 500
    expect([200, 403, 404]).toContain(clientView.status());

    const clientB = await apiLogin(api, fixtures.users.clientB.email);
    const cross = await api.get(`${API}/enrollments/${enrollment.id}/submissions`, {
      headers: authHeaders(clientB.token, tenantB)
    });
    expect([403, 404]).toContain(cross.status());

    await api.dispose();
  });
});
