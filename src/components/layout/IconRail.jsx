import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2, Calendar, ClipboardList, FolderOpen, Gauge, Globe2, LogOut, Settings, Shield
} from 'lucide-react';

const items = [
  {
    to: '/',
    icon: Gauge,
    end: true,
    title: 'Dashboard',
    match: (p) => p === '/' || p === '' || p.startsWith('/intake')
  },
  {
    to: '/organizations',
    icon: FolderOpen,
    title: 'Directory',
    match: (p) => (
      p.startsWith('/organizations')
      || p.startsWith('/practices')
      || p.startsWith('/facilities')
      || p.startsWith('/providers')
      || p.startsWith('/documents')
      || p.startsWith('/licenses')
      || p.startsWith('/providerOrganizations')
    )
  },
  { to: '/tasks', icon: ClipboardList, title: 'Tasks', match: (p) => p.startsWith('/tasks') },
  { to: '/cases', icon: Shield, title: 'Credentialing', match: (p) => p.startsWith('/cases') },
  { to: '/enrollments', icon: Calendar, title: 'Enrollments', match: (p) => p.startsWith('/enrollments') || p.startsWith('/plans') },
  { to: '/payers', icon: Globe2, title: 'Payers', match: (p) => p.startsWith('/payers') },
  { to: '/credentials', icon: Building2, title: 'Credentials', match: (p) => p.startsWith('/credentials') },
  { to: '/employees', icon: Settings, title: 'Settings / HR', match: (p) => p.startsWith('/employees') || p.startsWith('/audit') }
];

function resolveActiveTo(path) {
  const hit = items.find(item => item.match(path));
  return hit?.to || '/';
}

export default function IconRail() {
  const location = useLocation();
  const nav = useNavigate();
  const path = location.pathname;
  const activeTo = resolveActiveTo(path);

  function logout() {
    localStorage.removeItem('credentialing_token');
    localStorage.removeItem('credentialing_user');
    nav('/login');
  }

  return (
    <aside className="icon-rail" aria-label="Primary navigation">
      <div className="icon-rail-top">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = activeTo === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.title}
              aria-label={item.title}
              aria-current={isActive ? 'page' : undefined}
              className={() => `icon-rail-btn ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </NavLink>
          );
        })}
      </div>
      <div className="icon-rail-bottom">
        <span className="icon-rail-brand" aria-hidden="true">ECA</span>
        <button type="button" className="icon-rail-btn" title="Sign out" aria-label="Sign out" onClick={logout}>
          <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
