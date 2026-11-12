import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 20000
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('credentialing_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = localStorage.getItem('credentialing_tenant_id');
  if (tenantId) config.headers['X-Tenant-Id'] = tenantId;
  const platformAccess = localStorage.getItem('credentialing_platform_access');
  if (platformAccess === '1') config.headers['X-Platform-Access'] = '1';
  return config;
});

api.interceptors.response.use(r => r, error => {
  if (error.response?.status === 401 && !String(error.config?.url).includes('/auth/login')) {
    localStorage.removeItem('credentialing_token');
    localStorage.removeItem('credentialing_user');
    localStorage.removeItem('credentialing_tenant_id');
    localStorage.removeItem('credentialing_tenants');
    localStorage.removeItem('credentialing_platform_access');
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
  localStorage.removeItem('credentialing_token');
  localStorage.removeItem('credentialing_user');
  localStorage.removeItem('credentialing_tenant_id');
  localStorage.removeItem('credentialing_tenants');
  localStorage.removeItem('credentialing_platform_access');
}

export default api;
