import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Settings, X } from 'lucide-react';
import IconRail from './IconRail';
import AppSidebar from './AppSidebar';
import NotificationBell from '../common/NotificationBell';
import GlobalSearch from '../common/GlobalSearch';
import { ShellProvider, useShell } from './ShellContext';
import { NavigationHistoryProvider } from '../../navigation/NavigationHistoryContext';
import { roleLabel } from '../../utils/format';
import api, { getActiveTenantId, isPlatformAccessEnabled, setActiveTenantId, setPlatformAccess } from '../../api/client';

function ShellChrome({ children }) {
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  const nav = useNavigate();
  const { hideTopbar, secondarySidebarCollapsed } = useShell();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('credentialing_user') || '{}'));
  const [tenants, setTenants] = useState(() => JSON.parse(localStorage.getItem('credentialing_tenants') || '[]'));
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('credentialing_tenant_id') || '');
  const [tenantEpoch, setTenantEpoch] = useState(0);
  const [platformClients, setPlatformClients] = useState([]);

  useEffect(() => {
    const fn = () => nav('/login');
    window.addEventListener('credentialing:logout', fn);
    return () => window.removeEventListener('credentialing:logout', fn);
  }, [nav]);

  useEffect(() => {
    const onTenant = () => {
      setTenantId(localStorage.getItem('credentialing_tenant_id') || '');
      setTenants(JSON.parse(localStorage.getItem('credentialing_tenants') || '[]'));
      setTenantEpoch(v => v + 1);
    };
    window.addEventListener('credentialing:tenant-changed', onTenant);
    return () => window.removeEventListener('credentialing:tenant-changed', onTenant);
  }, []);

  useEffect(() => {
    const nextUser = JSON.parse(localStorage.getItem('credentialing_user') || '{}');
    setUser(nextUser);
    setTenants(JSON.parse(localStorage.getItem('credentialing_tenants') || '[]'));
    setTenantId(localStorage.getItem('credentialing_tenant_id') || '');
    setMobile(false);
    // Cover sessions created before platform-access was persisted on login.
    if (nextUser?.role === 'ADMIN' && !isPlatformAccessEnabled()) {
      setPlatformAccess(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      setPlatformClients([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get('/clients', { params: { status: 'ACTIVE', pageSize: 100 } });
        if (cancelled) return;
        const rows = (r.data?.data || []).map((c) => ({
          tenantId: c.id,
          usable: true,
          platform: true,
          tenant: { id: c.id, name: c.name, slug: c.slug, status: c.status }
        }));
        setPlatformClients(rows);
        const current = getActiveTenantId();
        if (!current && rows.length === 1) {
          setActiveTenantId(rows[0].tenantId);
          setTenantId(rows[0].tenantId);
        }
      } catch {
        if (!cancelled) setPlatformClients([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.role]);

  const usableTenants = useMemo(() => {
    const memberships = (tenants || []).filter(t => t.usable);
    if (user?.role !== 'ADMIN' || !platformClients.length) return memberships;
    const byId = new Map();
    for (const t of platformClients) byId.set(t.tenantId, t);
    // Prefer membership metadata when the admin also belongs to the tenant.
    for (const t of memberships) byId.set(t.tenantId, { ...byId.get(t.tenantId), ...t, usable: true });
    return Array.from(byId.values()).sort((a, b) =>
      String(a.tenant?.name || a.tenantId).localeCompare(String(b.tenant?.name || b.tenantId))
    );
  }, [tenants, platformClients, user?.role]);

  const activeTenant = usableTenants.find(t => t.tenantId === tenantId) || usableTenants[0];

  function onTenantChange(e) {
    const next = e.target.value;
    setActiveTenantId(next || null);
    setTenantId(next || '');
    // Force remount of tenant-scoped views so stale responses cannot paint into the new tenant.
    setTenantEpoch(v => v + 1);
    const role = JSON.parse(localStorage.getItem('credentialing_user') || '{}')?.role;
    nav(role === 'CLIENT_USER' ? '/portal' : '/');
  }

  const crumbs = location.pathname.split('/').filter(Boolean);
  const crumbLabel = crumbs.length === 0 ? 'Dashboard' : crumbs[0].replace(/-/g, ' ');

  return (
    <div className={`app-shell unified-shell${secondarySidebarCollapsed ? ' secondary-sidebar-collapsed' : ''}`}>
      <IconRail />

      <div className={`shell-module-wrap${mobile ? ' show' : ''}`}>
        <button type="button" className="icon-button close-nav shell-close-ctx" onClick={() => setMobile(false)} aria-label="Close menu">
          <X size={18} />
        </button>
        <AppSidebar />
      </div>
      {mobile && (
        <div
          className="mobile-scrim"
          onClick={() => setMobile(false)}
          onKeyDown={e => e.key === 'Escape' && setMobile(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      <div className="shell-main">
        {!hideTopbar && (
          <header className="topbar shell-topbar">
            <button type="button" className="icon-button mobile-menu" onClick={() => setMobile(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="crumb">
              eClinicAssist <span>/</span> <b style={{ textTransform: 'capitalize' }}>{crumbLabel}</b>
            </div>
            {usableTenants.length > 0 && (
              <label className="tenant-switcher" title="Active client account">
                <span className="sr-only">Active tenant</span>
                {usableTenants.length === 1 ? (
                  <span className="tenant-switcher-label">{activeTenant?.tenant?.name || 'Tenant'}</span>
                ) : (
                  <select value={tenantId} onChange={onTenantChange} aria-label="Select tenant">
                    {!tenantId && <option value="">Select tenant…</option>}
                    {usableTenants.map(t => (
                      <option key={t.tenantId} value={t.tenantId}>{t.tenant?.name || t.tenantId}</option>
                    ))}
                  </select>
                )}
              </label>
            )}
            <GlobalSearch />
            <div className="topbar-right">
              <button type="button" className="icon-button" title="Settings" aria-label="Settings" onClick={() => nav('/employees')}>
                <Settings size={17} />
              </button>
              <NotificationBell />
              <div className="shell-user-chip">
                <div className="top-avatar">{(user.name || 'U').slice(0, 1).toUpperCase()}</div>
                <div className="shell-user-meta">
                  <b>{user.name || 'Workspace User'}</b>
                  <small>{roleLabel(user.role)}</small>
                </div>
              </div>
            </div>
          </header>
        )}
        {hideTopbar && (
          <button type="button" className="icon-button mobile-menu shell-mobile-float" onClick={() => setMobile(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
        )}
        <div className="shell-content scroll-region" key={`tenant-${tenantEpoch}-${tenantId}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }) {
  return (
    <ShellProvider>
      <NavigationHistoryProvider>
        <ShellChrome>{children}</ShellChrome>
      </NavigationHistoryProvider>
    </ShellProvider>
  );
}
