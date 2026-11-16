import { expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures.e2e.json'), 'utf8')
);

export const API = process.env.E2E_API_URL || 'http://localhost:4010/api';
export const PASSWORD = fixtures.password as string;

export async function apiLogin(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/auth/login`, {
    data: { email, password: PASSWORD }
  });
  expect(res.ok(), `login failed for ${email}: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return body as {
    /** Present only when E2E_SAFE_DATABASE bypass is active on the API. */
    token?: string;
    user: { id: string; email: string; role: string; name: string };
    tenants?: Array<{ tenantId: string; usable: boolean; tenant?: { name: string } }>;
    defaultTenantId?: string;
    csrfToken?: string;
  };
}

export async function uiLogin(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);

  const loginResponsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST',
    { timeout: 30_000 }
  );
  await page.getByRole('button', { name: /sign in/i }).click();
  const loginRes = await loginResponsePromise;
  if (!loginRes.ok()) {
    const body = await loginRes.text().catch(() => '');
    throw new Error(`UI login failed for ${email}: HTTP ${loginRes.status()} ${body}`);
  }

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
}

export async function setAuthStorage(
  page: Page,
  auth: Awaited<ReturnType<typeof apiLogin>>,
  tenantId?: string
) {
  // Cookie session is authoritative. Persist non-sensitive workspace prefs only.
  await page.addInitScript(
    ({ user, tenants, tenantId: tid, csrf }) => {
      localStorage.setItem('credentialing_user', JSON.stringify(user));
      localStorage.setItem('credentialing_tenants', JSON.stringify(tenants || []));
      localStorage.removeItem('credentialing_token');
      if (tid) localStorage.setItem('credentialing_tenant_id', tid);
      else localStorage.removeItem('credentialing_tenant_id');
      if (csrf) {
        try { sessionStorage.setItem('credentialing_csrf', csrf); } catch { /* ignore */ }
      }
    },
    {
      user: auth.user,
      tenants: auth.tenants || [],
      tenantId: tenantId || auth.defaultTenantId || '',
      csrf: auth.csrfToken || ''
    }
  );
}

export function authHeaders(token: string | undefined, tenantId?: string, csrf?: string) {
  const h: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) h.Authorization = `Bearer ${token}`;
  if (tenantId) h['X-Tenant-Id'] = tenantId;
  if (csrf) h['X-CSRF-Token'] = csrf;
  return h;
}
