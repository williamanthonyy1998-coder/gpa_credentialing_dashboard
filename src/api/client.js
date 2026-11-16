import axios from 'axios';

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE = 'gpa_csrf';

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

/** Collapse accidental `//api` from trailing-slash VITE_API_URL values. */
export function resolveApiBaseUrl(raw = import.meta.env.VITE_API_URL) {
  const fallback = 'http://localhost:4000/api';
  const value = String(raw || fallback).trim();
  if (!value) return fallback;
  return value.replace(/([^:]\/)\/+/g, '$1').replace(/\/+$/, '') || fallback;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 20000,
  withCredentials: true
});

api.interceptors.request.use(config => {
  // Session JWT lives in HttpOnly cookie — never localStorage/sessionStorage.
  const tenantId = localStorage.getItem('credentialing_tenant_id');
  if (tenantId) config.headers['X-Tenant-Id'] = tenantId;
  const platformAccess = localStorage.getItem('credentialing_platform_access');
  if (platformAccess === '1') config.headers['X-Platform-Access'] = '1';
  const method = String(config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie(CSRF_COOKIE) || sessionStorage.getItem('credentialing_csrf') || '';
    if (csrf) config.headers[CSRF_HEADER] = csrf;
  }
  return config;
});

api.interceptors.response.use(r => {
  if (r?.data?.csrfToken) {
    try { sessionStorage.setItem('credentialing_csrf', r.data.csrfToken); } catch { /* ignore */ }
  }
  return r;
}, error => {
  if (error.response?.status === 401 && !String(error.config?.url).includes('/auth/login')) {
    clearAuthStorage();
    window.dispatchEvent(new Event('credentialing:logout'));
  }
  return Promise.reject(error);
});

export function setActiveTenantId(tenantId) {
  const prev = localStorage.getItem('credentialing_tenant_id');
  if (tenantId) localStorage.setItem('credentialing_tenant_id', tenantId);
  else localStorage.removeItem('credentialing_tenant_id');
  if (prev !== (tenantId || null)) {
    window.dispatchEvent(new CustomEvent('credentialing:tenant-changed', { detail: { tenantId } }));
  }
}

export function clearAuthStorage() {
  // Never persist JWT. Clear non-sensitive workspace prefs only.
  localStorage.removeItem('credentialing_token');
  localStorage.removeItem('credentialing_user');
  localStorage.removeItem('credentialing_tenant_id');
  localStorage.removeItem('credentialing_tenants');
  localStorage.removeItem('credentialing_platform_access');
  try {
    sessionStorage.removeItem('credentialing_csrf');
    sessionStorage.removeItem('credentialing_token');
  } catch { /* ignore */ }
}

export function persistSessionUser(user, tenants, defaultTenantId) {
  if (user) localStorage.setItem('credentialing_user', JSON.stringify(user));
  localStorage.setItem('credentialing_tenants', JSON.stringify(tenants || []));
  const usable = (tenants || []).filter(t => t.usable);
  const selected = defaultTenantId || (usable.length === 1 ? usable[0].tenantId : '');
  if (selected) localStorage.setItem('credentialing_tenant_id', selected);
  else localStorage.removeItem('credentialing_tenant_id');
  // Explicitly scrub any legacy JWT copies.
  localStorage.removeItem('credentialing_token');
  try { sessionStorage.removeItem('credentialing_token'); } catch { /* ignore */ }
}

export async function logoutSession() {
  try {
    await api.post('/auth/logout');
  } catch { /* ignore network errors on logout */ }
  clearAuthStorage();
}

export default api;
