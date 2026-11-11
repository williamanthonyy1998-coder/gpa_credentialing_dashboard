import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Settings, X } from 'lucide-react';
import IconRail from './IconRail';
import AppSidebar from './AppSidebar';
import NotificationBell from '../common/NotificationBell';
import GlobalSearch from '../common/GlobalSearch';
import { ShellProvider, useShell } from './ShellContext';
import { NavigationHistoryProvider } from '../../navigation/NavigationHistoryContext';
import { roleLabel } from '../../utils/format';

function ShellChrome({ children }) {
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  const nav = useNavigate();
  const { hideTopbar, secondarySidebarCollapsed } = useShell();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('credentialing_user') || '{}'));

  useEffect(() => {
    const fn = () => nav('/login');
    window.addEventListener('credentialing:logout', fn);
    return () => window.removeEventListener('credentialing:logout', fn);
  }, [nav]);

  useEffect(() => {
    setUser(JSON.parse(localStorage.getItem('credentialing_user') || '{}'));
    setMobile(false);
  }, [location.pathname]);

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
        <div className="shell-content scroll-region">{children}</div>
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
