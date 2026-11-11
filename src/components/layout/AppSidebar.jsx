import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, Building2, CheckSquare, ChevronLeft, ChevronRight, ClipboardCheck, CreditCard, Crown, FileText,
  FolderOpen, Gauge, Inbox, Landmark, MapPin, Plus, ShieldCheck, Stethoscope, Users
} from 'lucide-react';
import { organizationSections } from '../../config/resources';
import { resolveIcon } from './icons';
import { useShell } from './ShellContext';

const WORKSPACE_LINKS = [
  { to: '/', label: 'Overview', icon: Gauge, end: true },
  { to: '/organizations', label: 'Directory', icon: FolderOpen },
  { to: '/cases', label: 'Credentialing', icon: ClipboardCheck },
  { to: '/enrollments', label: 'Enrollments', icon: CreditCard },
  { to: '/intake', label: 'Intake', icon: Inbox },
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
  { to: '/intake', label: 'Intake', icon: Inbox },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/audit', label: 'Audit Log', icon: Activity },
  { to: '/documents', label: 'Documents', icon: FileText }
];

function NavBlock({ caption, links }) {
  const { secondarySidebarCollapsed } = useShell();

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
              title={secondarySidebarCollapsed ? item.label : undefined}
              aria-label={item.label}
            >
              {Icon && <Icon size={15} strokeWidth={1.75} aria-hidden="true" />}
              <span className="ctx-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

function OrgWorkspaceNav({ orgId }) {
  const { secondarySidebarCollapsed } = useShell();

  return (
    <>
      <NavBlock caption="DIRECTORY" links={DIRECTORY_LINKS.slice(0, 4)} />
      <div className="dir-side-block">
        <div className="dir-side-caption">ORGANIZATION</div>
        <nav className="ctx-nav-list" aria-label="Organization sections">
          {organizationSections.map(item => {
            const Icon = resolveIcon(item.icon);
            return (
              <NavLink
                key={item.key}
                to={`/organizations/${orgId}/${item.key}`}
                className={({ isActive }) => `ctx-nav-link ${isActive ? 'active' : ''}`}
                title={secondarySidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
              >
                <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                <span className="ctx-nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="dir-side-back">
          <NavLink
            to="/organizations"
            className="ctx-nav-link"
            title={secondarySidebarCollapsed ? 'All organizations' : undefined}
            aria-label="All organizations"
          >
            <Building2 size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="ctx-nav-label">All organizations</span>
          </NavLink>
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
  if (path.startsWith('/intake') || path.startsWith('/employees') || path.startsWith('/tasks') || path.startsWith('/audit')) {
    return <NavBlock caption="OPERATIONS" links={OPERATIONS_LINKS} />;
  }
  return <NavBlock caption="WORKSPACE" links={WORKSPACE_LINKS} />;
}

function providerDisplayName(p) {
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unnamed provider';
}

function providerStatusLabel(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'ACTIVE') return 'Active';
  if (value === 'INACTIVE') return 'Inactive';
  if (!value) return '';
  return value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
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
  providers = [],
  selectedProviderId,
  onSelectProvider,
  providersLoading = false,
  providersError = '',
  steps = [],
  activeStepKey,
  onStepChange
}) {
  const nav = useNavigate();
  const { secondarySidebarCollapsed } = useShell();

  if (entityType === 'PROVIDER') {
    return (
      <div className="dir-side-block">
        <div className="dir-side-caption row">
          <span>PROVIDERS</span>
          <button
            type="button"
            className="icon-mini"
            onClick={() => nav('/providers/new/profile')}
            aria-label="Add provider"
            title="Add provider"
          >
            <Plus size={14} />
          </button>
        </div>
        <select
          className="dir-practice-select"
          value={selectedProviderId || ''}
          onChange={e => onSelectProvider?.(e.target.value)}
          aria-label="Select provider"
          title={secondarySidebarCollapsed ? 'Select provider' : undefined}
          tabIndex={secondarySidebarCollapsed ? -1 : undefined}
          aria-hidden={secondarySidebarCollapsed || undefined}
        >
          <option value="">Select provider…</option>
          {providers.map(p => (
            <option key={p.id} value={p.id}>
              {providerDisplayName(p)}
            </option>
          ))}
        </select>
        <nav className="dir-step-nav" style={{ marginTop: 10 }} aria-label="Provider steps">
          {steps.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className={`dir-step ${activeStepKey === s.key ? 'active' : ''}`}
              onClick={() => onStepChange?.(s.key)}
              title={secondarySidebarCollapsed ? s.label : undefined}
              aria-label={s.label}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              <span className="dir-step-label">{s.label}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <>
      <div className="dir-side-block">
        <div className="dir-side-caption row">
          <span>PRACTICE</span>
          <button
            type="button"
            className="icon-mini"
            onClick={() => nav('/practices/new/profile')}
            aria-label="Add practice"
            title="Add practice"
          >
            <Plus size={14} />
          </button>
        </div>
        <select
          className="dir-practice-select"
          value={selectedPracticeId || ''}
          onChange={e => onSelectPractice?.(e.target.value)}
          aria-label="Select practice"
          title={secondarySidebarCollapsed ? 'Select practice' : undefined}
          tabIndex={secondarySidebarCollapsed ? -1 : undefined}
          aria-hidden={secondarySidebarCollapsed || undefined}
        >
          <option value="">Select practice…</option>
          {practices.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {entityType === 'PRACTICE' && (
          <nav className="dir-step-nav" aria-label="Practice steps">
            {steps.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={`dir-step ${activeStepKey === s.key ? 'active' : ''}`}
                onClick={() => onStepChange?.(s.key)}
                title={secondarySidebarCollapsed ? s.label : undefined}
                aria-label={s.label}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span className="dir-step-label">{s.label}</span>
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onAddFacility) onAddFacility();
              else nav('/facilities/new/profile');
            }}
            aria-label="Add facility"
            title="Add facility"
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
              title={f.name}
              aria-label={f.name}
            >
              <Crown size={13} className="crown" aria-hidden="true" />
              <span className="truncate dir-item-label">{f.name}</span>
              <span className={`mini-dot ${f.status === 'ACTIVE' ? 'green' : ''}`} />
            </button>
          ))}
          {!facilities.length && <div className="dir-empty">No facilities yet</div>}
        </div>
      </div>

      {entityType === 'FACILITY' && (
        <div className="dir-side-block">
          <div className="dir-side-caption">INDIVIDUAL PROVIDERS</div>
          <div className="dir-provider-list" aria-label="Providers assigned to selected facility">
            {providersLoading && <div className="dir-empty">Loading providers…</div>}
            {!providersLoading && providersError && (
              <div className="dir-empty dir-empty-error" role="alert">{providersError}</div>
            )}
            {!providersLoading && !providersError && !selectedFacilityId && (
              <div className="dir-empty">Select a facility to view providers.</div>
            )}
            {!providersLoading && !providersError && selectedFacilityId && !providers.length && (
              <div className="dir-empty">No providers assigned to this facility.</div>
            )}
            {!providersLoading && !providersError && providers.map(p => {
              const active = selectedProviderId === p.id;
              const status = String(p.status || '').toUpperCase();
              const name = providerDisplayName(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`dir-provider-item ${active ? 'active' : ''}`}
                  onClick={() => onSelectProvider?.(p.id)}
                  title={name}
                  aria-label={name}
                >
                  <Stethoscope size={13} className="dir-provider-icon" aria-hidden="true" />
                  <span className="dir-provider-copy dir-item-label">
                    <span className="dir-provider-name truncate">{name}</span>
                    {(p.primarySpecialty || status) && (
                      <span className="dir-provider-meta truncate">
                        {[p.primarySpecialty, providerStatusLabel(status)].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className={`mini-dot ${status === 'ACTIVE' ? 'green' : ''}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {entityType === 'FACILITY' && (
        <div className="dir-side-block">
          <nav className="dir-step-nav" aria-label="Facility steps">
            {steps.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={`dir-step ${activeStepKey === s.key ? 'active' : ''}`}
                onClick={() => onStepChange?.(s.key)}
                title={secondarySidebarCollapsed ? s.label : undefined}
                aria-label={s.label}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span className="dir-step-label">{s.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

function SidebarCollapseToggle() {
  const { secondarySidebarCollapsed, toggleSecondarySidebar } = useShell();
  const label = secondarySidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <div className="sidebar-collapse-bar">
      <button
        type="button"
        className="sidebar-collapse-toggle"
        onClick={toggleSecondarySidebar}
        aria-expanded={!secondarySidebarCollapsed}
        aria-controls="app-secondary-sidebar"
        title={label}
        aria-label={label}
      >
        {secondarySidebarCollapsed
          ? <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          : <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />}
      </button>
    </div>
  );
}

export default function AppSidebar() {
  const { contextualNav, secondarySidebarCollapsed } = useShell();

  return (
    <aside
      id="app-secondary-sidebar"
      className={`app-sidebar dir-side${secondarySidebarCollapsed ? ' is-collapsed' : ''}`}
      aria-label="Module navigation"
      data-collapsed={secondarySidebarCollapsed ? 'true' : 'false'}
    >
      <SidebarCollapseToggle />
      <div className="app-sidebar-scroll">
        {contextualNav || <DefaultSidebarNav />}
      </div>
    </aside>
  );
}
