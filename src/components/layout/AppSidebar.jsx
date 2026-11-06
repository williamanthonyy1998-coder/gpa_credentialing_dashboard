import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, Building2, CheckSquare, ClipboardCheck, CreditCard, Crown, FileText,
  FolderOpen, Gauge, Landmark, MapPin, Plus, ShieldCheck, Stethoscope, Users
} from 'lucide-react';
import { organizationSections } from '../../config/resources';
import { useShell } from './ShellContext';

const WORKSPACE_LINKS = [
  { to: '/', label: 'Overview', icon: Gauge, end: true },
  { to: '/organizations', label: 'Directory', icon: FolderOpen },
  { to: '/cases', label: 'Credentialing', icon: ClipboardCheck },
  { to: '/enrollments', label: 'Enrollments', icon: CreditCard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/employees', label: 'Employees & HR', icon: Users },
  { to: '/audit', label: 'Activity & Audit', icon: Activity }
];

const DIRECTORY_LINKS = [
  { to: '/organizations', label: 'Organizations', icon: Building2 },
  { to: '/practices', label: 'Practices', icon: Landmark },
  { to: '/facilities', label: 'Facilities', icon: MapPin },
  { to: '/providers', label: 'Providers', icon: Stethoscope },
  { to: '/payers', label: 'Payers', icon: ShieldCheck },
  { to: '/credentials', label: 'Credentials', icon: FileText },
  { to: '/documents', label: 'Documents', icon: FileText }
];

const CREDENTIALING_LINKS = [
  { to: '/cases', label: 'Cases', icon: ClipboardCheck },
  { to: '/credentials', label: 'Credentials', icon: FileText },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/providers', label: 'Providers', icon: Stethoscope },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare }
];

const ENROLLMENT_LINKS = [
  { to: '/enrollments', label: 'Applications', icon: CreditCard },
  { to: '/payers', label: 'Payers', icon: ShieldCheck },
  { to: '/plans', label: 'Payer Plans', icon: FileText },
  { to: '/providers', label: 'Providers', icon: Stethoscope },
  { to: '/practices', label: 'Practices', icon: Landmark },
  { to: '/tasks', label: 'Follow-ups', icon: CheckSquare }
];

const OPERATIONS_LINKS = [
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/audit', label: 'Audit Log', icon: Activity },
  { to: '/documents', label: 'Documents', icon: FileText }
];

function NavBlock({ caption, links }) {
  return (
    <div className="dir-side-block">
      {caption && <div className="dir-side-caption">{caption}</div>}
      <nav className="ctx-nav-list" aria-label={caption || 'Module navigation'}>
        {links.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `ctx-nav-link ${isActive ? 'active' : ''}`}
            >
              {Icon && <Icon size={15} strokeWidth={1.75} />}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

function OrgWorkspaceNav({ orgId }) {
  return (
    <>
      <NavBlock caption="DIRECTORY" links={DIRECTORY_LINKS.slice(0, 4)} />
      <div className="dir-side-block">
        <div className="dir-side-caption">ORGANIZATION</div>
        <nav className="ctx-nav-list">
          {organizationSections.map(item => (
            <NavLink
              key={item.key}
              to={`/organizations/${orgId}/${item.key}`}
              className={({ isActive }) => `ctx-nav-link ${isActive ? 'active' : ''}`}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 14 }}>
          <NavLink to="/organizations" className="ctx-nav-link">← All organizations</NavLink>
        </div>
      </div>
    </>
  );
}

function DefaultSidebarNav() {
  const path = useLocation().pathname;
  const orgMatch = path.match(/^\/organizations\/([^/]+)/);

  if (orgMatch?.[1] && orgMatch[1] !== 'new') {
    return <OrgWorkspaceNav orgId={orgMatch[1]} />;
  }
  if (path === '/' || path === '') {
    return <NavBlock caption="WORKSPACE" links={WORKSPACE_LINKS} />;
  }
  if (
    path.startsWith('/organizations')
    || path.startsWith('/practices')
    || path.startsWith('/facilities')
    || path.startsWith('/providers')
    || path.startsWith('/payers')
    || path.startsWith('/credentials')
    || path.startsWith('/documents')
    || path.startsWith('/licenses')
    || path.startsWith('/providerOrganizations')
  ) {
    return <NavBlock caption="DIRECTORY" links={DIRECTORY_LINKS} />;
  }
  if (path.startsWith('/cases')) {
    return <NavBlock caption="CREDENTIALING" links={CREDENTIALING_LINKS} />;
  }
  if (path.startsWith('/enrollments') || path.startsWith('/plans')) {
    return <NavBlock caption="ENROLLMENTS" links={ENROLLMENT_LINKS} />;
  }
  if (path.startsWith('/employees') || path.startsWith('/tasks') || path.startsWith('/audit')) {
    return <NavBlock caption="OPERATIONS" links={OPERATIONS_LINKS} />;
  }
  return <NavBlock caption="WORKSPACE" links={WORKSPACE_LINKS} />;
}

/** Practice / Facility wizard nav — registered into the single AppSidebar via ShellContext. */
export function DirectoryEntityNav({
  entityType = 'PRACTICE',
  practices = [],
  selectedPracticeId,
  onSelectPractice,
  facilities = [],
  selectedFacilityId,
  onSelectFacility,
  onAddFacility,
  steps = [],
  activeStepKey,
  onStepChange
}) {
  const nav = useNavigate();

  return (
    <>
      <div className="dir-side-block">
        <div className="dir-side-caption">PRACTICE</div>
        <select
          className="dir-practice-select"
          value={selectedPracticeId || ''}
          onChange={e => onSelectPractice?.(e.target.value)}
        >
          <option value="">Select practice…</option>
          {practices.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {entityType === 'PRACTICE' && (
          <nav className="dir-step-nav">
            {steps.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={`dir-step ${activeStepKey === s.key ? 'active' : ''}`}
                onClick={() => onStepChange?.(s.key)}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="dir-side-block">
        <div className="dir-side-caption row">
          <span>FACILITIES</span>
          <button
            type="button"
            className="icon-mini"
            onClick={onAddFacility || (() => nav('/facilities/new/profile'))}
            aria-label="Add facility"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="dir-facility-list">
          {facilities.map(f => (
            <button
              key={f.id}
              type="button"
              className={`dir-facility-item ${selectedFacilityId === f.id ? 'active' : ''}`}
              onClick={() => onSelectFacility?.(f.id)}
            >
              <Crown size={13} className="crown" />
              <span className="truncate">{f.name}</span>
              <span className={`mini-dot ${f.status === 'ACTIVE' ? 'green' : ''}`} />
            </button>
          ))}
          {!facilities.length && <div className="dir-empty">No facilities yet</div>}
        </div>

        {entityType === 'FACILITY' && (
          <nav className="dir-step-nav" style={{ marginTop: 10 }}>
            {steps.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={`dir-step ${activeStepKey === s.key ? 'active' : ''}`}
                onClick={() => onStepChange?.(s.key)}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}

export default function AppSidebar() {
  const { contextualNav } = useShell();

  return (
    <aside className="app-sidebar dir-side" aria-label="Module navigation">
      <div className="app-sidebar-scroll">
        {contextualNav || <DefaultSidebarNav />}
      </div>
    </aside>
  );
}
