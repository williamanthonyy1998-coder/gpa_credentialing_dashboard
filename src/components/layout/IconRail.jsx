import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2, Calendar, ClipboardList, FolderOpen, Gauge, Globe2, LogOut, Settings, Shield
} from 'lucide-react';

const items = [
  { to: '/', icon: Gauge, end: true, title: 'Dashboard', match: (p) => p === '/' },
  {
    to: '/organizations',
    icon: FolderOpen,
    title: 'Directory',
    match: (p) => (
      p.startsWith('/organizations')
      || p.startsWith('/practices')
      || p.startsWith('/facilities')
      || p.startsWith('/providers')
      || p.startsWith('/credentials')
      || p.startsWith('/documents')
      || p.startsWith('/licenses')
    )
  },
  { to: '/tasks', icon: ClipboardList, title: 'Tasks', match: (p) => p.startsWith('/tasks') },
  { to: '/cases', icon: Shield, title: 'Credentialing', match: (p) => p.startsWith('/cases') },
  { to: '/enrollments', icon: Calendar, title: 'Enrollments', match: (p) => p.startsWith('/enrollments') || p.startsWith('/plans') },
  { to: '/payers', icon: Globe2, title: 'Payers', match: (p) => p.startsWith('/payers') },
  { to: '/credentials', icon: Building2, title: 'Credentials', match: (p) => p.startsWith('/credentials') },
  { to: '/employees', icon: Settings, title: 'Settings / HR', match: (p) => p.startsWith('/employees') || p.startsWith('/audit') }
];

export default function IconRail() {
  const location = useLocation();
  const nav = useNavigate();
  const path = location.pathname;

  function logout() {
    localStorage.removeItem('credentialing_token');
    localStorage.removeItem('credentialing_user');
    nav('/login');
  }

  let activeTo = '/';
  if (path.startsWith('/tasks')) activeTo = '/tasks';
  else if (path.startsWith('/cases')) activeTo = '/cases';
  else if (path.startsWith('/enrollments') || path.startsWith('/plans')) activeTo = '/enrollments';
  else if (path.startsWith('/payers')) activeTo = '/payers';
  else if (path.startsWith('/credentials')) activeTo = '/credentials';
  else if (path.startsWith('/employees') || path.startsWith('/audit')) activeTo = '/employees';
  else if (
    path.startsWith('/organizations')
    || path.startsWith('/practices')
    || path.startsWith('/facilities')
    || path.startsWith('/providers')
    || path.startsWith('/documents')
    || path.startsWith('/licenses')
  ) activeTo = '/organizations';
  else if (path === '/' || path === '') activeTo = '/';

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
              className={() => `icon-rail-btn ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.75} />
            </NavLink>
          );
        })}
      </div>
      <div className="icon-rail-bottom">
        <span className="icon-rail-brand">ECA</span>
        <button type="button" className="icon-rail-btn" title="Sign out" onClick={logout}>
          <LogOut size={18} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
