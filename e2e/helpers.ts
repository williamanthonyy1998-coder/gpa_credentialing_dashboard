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
    token: string;
    user: { id: string; email: string; role: string; name: string };
    tenants?: Array<{ tenantId: string; usable: boolean; tenant?: { name: string } }>;
    defaultTenantId?: string;
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
  await page.addInitScript(
    ({ token, user, tenants, tenantId: tid }) => {
      localStorage.setItem('credentialing_token', token);
      localStorage.setItem('credentialing_user', JSON.stringify(user));
      localStorage.setItem('credentialing_tenants', JSON.stringify(tenants || []));
      if (tid) localStorage.setItem('credentialing_tenant_id', tid);
      else localStorage.removeItem('credentialing_tenant_id');
    },
    {
      token: auth.token,
      user: auth.user,
      tenants: auth.tenants || [],
      tenantId: tenantId || auth.defaultTenantId || ''
    }
  );
}

export function authHeaders(token: string, tenantId?: string) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  if (tenantId) h['X-Tenant-Id'] = tenantId;
  return h;
}
