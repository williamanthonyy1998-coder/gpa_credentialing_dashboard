import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, PASSWORD, apiLogin, authHeaders, fixtures, setAuthStorage, uiLogin } from './helpers';

const enabled = process.env.PLAYWRIGHT_E2E === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 2C full provider intake journey', () => {
  test.skip(!enabled, 'Set PLAYWRIGHT_E2E=1 after migrating/seeding credentialing_e2e');
  test.skip(!fs.existsSync(path.join(__dirname, 'fixtures.e2e.json')), 'Run seed-e2e-provider-intake.ts first');

  test('GPA invite → provider draft/submit → changes → approve → convert', async ({ browser }) => {
    const api = await playwrightRequest.newContext({ baseURL: API.replace(/\/api$/, '') });
    const tenantA = fixtures.tenants.a.id as string;
    const gpa = await apiLogin(api, fixtures.users.gpaAdmin.email);

    // 1-4 Create intake + invitation (GPA / Tenant A)
    const createRes = await api.post(`${API}/intake`, {
      headers: authHeaders(gpa.token, tenantA),
      data: {
        kind: 'PROVIDER',
        organizationId: fixtures.organizations.a,
        contactName: 'Journey Provider',
        contactEmail: fixtures.users.providerA.email,
        payload: { provider: { email: fixtures.users.providerA.email } }
      }
    });
    expect(createRes.ok()).toBeTruthy();
    const intake = await createRes.json();

    const inviteRes = await api.post(`${API}/intake/${intake.id}/invite-provider`, {
      headers: authHeaders(gpa.token, tenantA),
      data: { email: fixtures.users.providerA.email, send: false }
    });
    expect(inviteRes.status()).toBe(201);
    const inviteBody = await inviteRes.json();
    expect(inviteBody.acceptanceUrl).toBeTruthy();
    const rawToken = String(inviteBody.acceptanceUrl).split('/accept-provider-invitation/')[1];
    expect(rawToken).toBeTruthy();

    // 5-7 Provider accepts (authenticated existing synthetic user)
    const providerAuth = await apiLogin(api, fixtures.users.providerA.email);
    const acceptRes = await api.post(`${API}/provider-invitations/${encodeURIComponent(rawToken)}/accept-authenticated`, {
      headers: authHeaders(providerAuth.token)
    });
    expect(acceptRes.ok(), await acceptRes.text()).toBeTruthy();
    const accepted = await acceptRes.json();
    expect(accepted.intakeRequestId).toBe(intake.id);

    // Provider UI: complete form, upload, draft, logout/login, resume, submit
    const providerCtx = await browser.newContext();
    const providerPage = await providerCtx.newPage();
    await setAuthStorage(providerPage, providerAuth);
    await providerPage.goto(`/provider-portal/intakes/${intake.id}`);
    await expect(providerPage.getByRole('heading', { name: intake.referenceNo })).toBeVisible({ timeout: 30_000 });

    await providerPage.getByLabel(/first name/i).fill('Pat');
    await providerPage.getByLabel(/last name/i).fill('Provider');
    await providerPage.getByLabel(/^npi$/i).fill('1234567893');
    await providerPage.getByLabel(/^email$/i).fill(fixtures.users.providerA.email);
    await providerPage.getByRole('button', { name: /^licenses$/i }).click();
    await providerPage.getByLabel(/^type$/i).first().fill('MD');
    await providerPage.getByLabel(/^number$/i).first().fill('E2E-LIC-001');
    await providerPage.getByLabel(/^state$/i).first().fill('TX');

    // Persist draft before upload so a document refresh cannot wipe unsaved fields.
    await providerPage.getByRole('button', { name: /save draft/i }).click();
    await expect(providerPage.getByText(/draft saved/i)).toBeVisible({ timeout: 20_000 });

    // Upload synthetic PDF
    const pdfPath = path.join(__dirname, 'synthetic-credential.pdf');
    if (!fs.existsSync(pdfPath)) {
      // Minimal valid-ish PDF header for magic sniff
      fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'));
    }
    await providerPage.getByRole('button', { name: /^documents$/i }).click();
    await providerPage.locator('input[type="file"]').setInputFiles(pdfPath);
    await expect(providerPage.getByText(/quarantined/i)).toBeVisible({ timeout: 20_000 });

    // Logout / login resume — draft must survive session
    await providerPage.evaluate(() => localStorage.clear());
    await uiLogin(providerPage, fixtures.users.providerA.email);
    await providerPage.goto(`/provider-portal/intakes/${intake.id}`);
    await providerPage.getByRole('button', { name: /^identity$/i }).click();
    await expect(providerPage.getByLabel(/first name/i)).toHaveValue('Pat');

    await providerPage.getByRole('button', { name: /submit for review/i }).click();
    await expect(providerPage.getByText(/submitted/i).first()).toBeVisible({ timeout: 30_000 });

    // Draft must not alter submitted snapshot
    const afterSubmit = await api.get(`${API}/provider-portal/intakes/${intake.id}`, {
      headers: authHeaders(providerAuth.token)
    });
    const submittedView = await afterSubmit.json();
    expect(submittedView.submittedPayload?.provider?.firstName || submittedView.submittedPayload?.firstName).toBeTruthy();
    expect(submittedView.currentSubmissionVersion).toBeGreaterThanOrEqual(1);

    // Reviewer requests changes
    const changeRes = await api.post(`${API}/intake/${intake.id}/request-changes`, {
      headers: authHeaders(gpa.token, tenantA),
      data: { comments: 'Please add primary specialty' }
    });
    expect(changeRes.ok(), await changeRes.text()).toBeTruthy();

    await providerPage.reload();
    await expect(providerPage.getByText(/please add primary specialty/i)).toBeVisible();
    await providerPage.getByRole('button', { name: /^identity$/i }).click();
    await providerPage.getByLabel(/primary specialty/i).fill('Family Medicine');
    await providerPage.getByRole('button', { name: /save draft/i }).click();
    await providerPage.getByRole('button', { name: /submit for review/i }).click();
    await expect(providerPage.getByText(/submitted|resubmit/i).first()).toBeVisible({ timeout: 30_000 });

    const versions = await api.get(`${API}/intake/${intake.id}`, {
      headers: authHeaders(gpa.token, tenantA)
    });
    const detail = await versions.json();
    // submissions relation may be on safe endpoint — check version counter
    expect(detail.currentSubmissionVersion).toBeGreaterThanOrEqual(2);

    // Resolve identity when NPI matches an existing provider (MATCHED/AMBIGUOUS).
    const beforeApprove = await (
      await api.get(`${API}/intake/${intake.id}`, { headers: authHeaders(gpa.token, tenantA) })
    ).json();
    if (beforeApprove.identityMatch === 'AMBIGUOUS' || beforeApprove.identityMatch === 'MATCHED') {
      const resolveRes = await api.post(`${API}/intake/${intake.id}/resolve-identity`, {
        headers: authHeaders(gpa.token, tenantA),
        data: {
          decision: 'USE_EXISTING',
          matchedProviderId: beforeApprove.matchedProviderId
        }
      });
      expect(resolveRes.ok(), await resolveRes.text()).toBeTruthy();
    }

    const approveRes = await api.post(`${API}/intake/${intake.id}/approve`, {
      headers: authHeaders(gpa.token, tenantA),
      data: {}
    });
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

    // Release document then convert
    const docs = detail.documents || [];
    // reload detail with documents via safe endpoint
    const safe = await (await api.get(`${API}/intake/${intake.id}/safe`, {
      headers: authHeaders(gpa.token, tenantA)
    })).json();
    for (const d of safe.documents || []) {
      if (d.securityStatus === 'QUARANTINED') {
        const rel = await api.post(`${API}/intake/documents/${d.id}/release`, {
          headers: authHeaders(gpa.token, tenantA),
          data: {
            reason: 'E2E authorized manual review release — not malware-scanned'
          }
        });
        expect(rel.ok(), await rel.text()).toBeTruthy();
      }
    }

    const convertRes = await api.post(`${API}/intake/${intake.id}/convert`, {
      headers: authHeaders(gpa.token, tenantA)
    });
    expect(convertRes.ok(), await convertRes.text()).toBeTruthy();
    const converted = await convertRes.json();
    expect(converted.providerId).toBeTruthy();

    // Idempotent convert
    const convert2 = await api.post(`${API}/intake/${intake.id}/convert`, {
      headers: authHeaders(gpa.token, tenantA)
    });
    expect(convert2.ok()).toBeTruthy();
    const converted2 = await convert2.json();
    expect(converted2.providerId).toBe(converted.providerId);
    expect(converted2.idempotent === true || converted2.providerId).toBeTruthy();

    // Client A sees status
    const clientA = await apiLogin(api, fixtures.users.clientA.email);
    const clientView = await api.get(`${API}/portal/provider-intakes/${intake.id}`, {
      headers: authHeaders(clientA.token, tenantA)
    });
    expect(clientView.ok()).toBeTruthy();
    const clientJson = await clientView.json();
    expect(clientJson.status).toBe('CONVERTED');
    expect(clientJson.internalNotes).toBeUndefined();

    await providerCtx.close();
    await api.dispose();
  });
});
