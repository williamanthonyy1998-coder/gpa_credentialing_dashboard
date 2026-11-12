import React, { useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2, Calendar, ClipboardList, FolderOpen, Gauge, Globe2, LogOut, Settings, Shield, Users
} from 'lucide-react';

import { clearAuthStorage } from '../../api/client';

const GPA_ITEMS = [
  {
    to: '/',
    icon: Gauge,
    end: true,
    title: 'Dashboard',
    match: (p) => p === '/' || p === '' || p.startsWith('/intake')
  },
  {
    to: '/clients',
    icon: Users,
    title: 'Clients',
    match: (p) => p.startsWith('/clients'),
    roles: ['ADMIN', 'CREDENTIALING_MANAGER']
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

const CLIENT_ITEMS = [
  {
    to: '/portal',
    icon: Gauge,
    end: true,
    title: 'Client portal',
    match: (p) => p === '/portal' || p === '/portal/'
  },
  {
    to: '/portal/organizations',
    icon: FolderOpen,
    title: 'Organizations',
    match: (p) => p.startsWith('/portal/organizations') || p.startsWith('/organizations') || p.startsWith('/practices') || p.startsWith('/facilities')
  },
  {
    to: '/portal/provider-intakes',
    icon: ClipboardList,
    title: 'Provider intakes',
    match: (p) => p.startsWith('/portal/provider-intakes')
  },
  {
    to: '/portal/users',
    icon: Users,
    title: 'Users',
    match: (p) => p.startsWith('/portal/users')
  },
  {
    to: '/portal/profile',
    icon: Settings,
    title: 'Profile',
    match: (p) => p.startsWith('/portal/profile')
  },
  { to: '/credentials', icon: Building2, title: 'Credentials', match: (p) => p.startsWith('/credentials') },
  { to: '/enrollments', icon: Calendar, title: 'Enrollments', match: (p) => p.startsWith('/enrollments') }
];

const PROVIDER_ITEMS = [
  {
    to: '/provider-portal',
    icon: Gauge,
    end: true,
    title: 'Provider portal',
    match: (p) => p === '/provider-portal' || p === '/provider-portal/'
  },
  {
    to: '/provider-portal/intakes',
    icon: ClipboardList,
    title: 'My intakes',
    match: (p) => p.startsWith('/provider-portal/intakes')
  }
];

function resolveActiveTo(items, path) {
  const hit = items.find(item => item.match(path));
  return hit?.to || items[0]?.to || '/';
}

export default function IconRail() {
  const location = useLocation();
  const nav = useNavigate();
  const path = location.pathname;
  const user = useMemo(() => JSON.parse(localStorage.getItem('credentialing_user') || '{}'), [path]);
  const isClient = user.role === 'CLIENT_USER';
  const isProvider = user.role === 'EXTERNAL_PROVIDER';
  const items = useMemo(() => {
    if (isProvider) return PROVIDER_ITEMS;
    if (isClient) return CLIENT_ITEMS;
    return GPA_ITEMS.filter((item) => {
      if (!item.roles) return true;
      return item.roles.includes(user.role);
    });
  }, [isClient, isProvider, user.role]);
  const activeTo = resolveActiveTo(items, path);

  function logout() {
    clearAuthStorage();
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
