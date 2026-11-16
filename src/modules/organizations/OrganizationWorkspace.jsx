import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  CheckSquare, CreditCard, FileText, Landmark, MapPin, RefreshCw,
  ShieldCheck, Stethoscope, ClipboardCheck, Users, AlertTriangle
} from 'lucide-react';
import api from '../../api/client';
import { sectionResource, organizationSections } from '../../config/resources';
import StatusBadge from '../../components/common/StatusBadge';
import BackButton from '../../components/common/BackButton';
import AppBreadcrumbs from '../../components/common/AppBreadcrumbs';
import RecordPage from '../records/RecordPage';
import AuditPage from '../audit/AuditPage';
import EnrollmentsPage from '../enrollments/EnrollmentsPage';
import OrganizationEmployeesPanel from './OrganizationEmployeesPanel';
import OrganizationPayersPanel from './OrganizationPayersPanel';
import { LIST_KEYS } from '../../navigation/listReturn';

const MANAGEMENT_CARDS = [
  {
    key: 'practices',
    label: 'Manage Practices',
    description: 'View and maintain practices linked to this organization.',
    Icon: Landmark
  },
  {
    key: 'providers',
    label: 'Manage Providers',
    description: 'Review provider affiliations and shared master profiles.',
    Icon: Stethoscope
  },
  {
    key: 'facilities',
    label: 'Manage Facilities',
    description: 'Manage facility locations associated with this organization.',
    Icon: MapPin
  },
  {
    key: 'payers',
    label: 'Payer Participation',
    description: 'Manage organization–payer contracts and participation status.',
    Icon: ShieldCheck
  },
  {
    key: 'enrollments',
    label: 'Payer Enrollment',
    description: 'Track enrollment applications and payer follow-ups.',
    Icon: CreditCard
  },
  {
    key: 'cases',
    label: 'Credentialing Cases',
    description: 'Open and manage credentialing cases for this organization.',
    Icon: ClipboardCheck
  },
  {
    key: 'documents',
    label: 'Documents',
    description: 'Access organization documents and supporting files.',
    Icon: FileText
  },
  {
    key: 'employees',
    label: 'Employees & HR',
    description: 'Assign employees and manage organization HR roster.',
    Icon: Users
  },
  {
    key: 'tasks',
    label: 'Tasks & Workflow',
    description: 'Review tasks, assignments, and operational workflow.',
    Icon: CheckSquare
  }
];

function OrganizationProfile({ org }) {
  const fields = [
    ['Legal name', org?.legalName], ['DBA', org?.dba], ['Tax ID', org?.taxId],
    ['Established', org?.establishedAt ? new Date(org.establishedAt).toLocaleDateString() : null],
    ['Primary contact', org?.contactName], ['Contact title', org?.contactTitle],
    ['Phone', org?.phone], ['Fax', org?.fax], ['Email', org?.email], ['Status', org?.status]
  ];
  return (
    <div className="org-profile panel">
      <div className="panel-heading">
        <div>
          <h2>Organization Profile</h2>
          <p>Master identity and contact details for this organization.</p>
        </div>
      </div>
      <div className="org-profile-grid">
        {fields.map(([label, value]) => (
          <div key={label}><span>{label}</span><b>{value || '—'}</b></div>
        ))}
      </div>
      <div className="org-profile-note">
        Organization profile editing remains available from the Organizations directory. This workspace keeps the selected organization context visible.
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div className="org-info-field">
      <span>{label}</span>
      <b>{value || '—'}</b>
    </div>
  );
}

function OrganizationOverview({ org, stats, id }) {
  const nav = useNavigate();
  const displayName = org?.dba || org?.legalName || 'Organization';

  const snapshot = [
    { label: 'Total employees', value: stats.employeesTotal, to: 'employees' },
    { label: 'Active employees', value: stats.employeesActive, to: 'employees' },
    { label: 'Payer relationships', value: stats.payersTotal, to: 'payers' },
    { label: 'Active contracted payers', value: stats.payersActive, to: 'payers' },
    { label: 'Contracting / pending', value: stats.payersContracting, to: 'payers' },
    { label: 'Upcoming renewals (90d)', value: stats.payersRenewal, to: 'payers' },
    { label: 'Practices', value: stats.practices, to: 'practices' },
    { label: 'Facilities', value: stats.facilities, to: 'facilities' },
    { label: 'Providers', value: stats.providers, to: 'providers' },
    { label: 'Active enrollments', value: stats.enrollmentsActive, to: 'enrollments' },
    { label: 'Pending credentialing', value: stats.casesPending, to: 'cases' },
    { label: 'Overdue tasks', value: stats.tasksOverdue, to: 'tasks' }
  ];

  return (
    <div className="org-overview-content">
      <section className="org-info-card panel">
        <div className="panel-heading">
          <div>
            <h2>Organization Information</h2>
            <p>Core identity and contact details for {displayName}.</p>
          </div>
          {org && <StatusBadge value={org.status} />}
        </div>
        <div className="org-info-grid">
          <InfoField label="Organization name" value={displayName} />
          <InfoField label="Legal name" value={org?.legalName} />
          <InfoField label="DBA" value={org?.dba} />
          <InfoField label="Status" value={org?.status} />
          <InfoField label="Tax ID" value={org?.taxId} />
          <InfoField label="Email" value={org?.email} />
          <InfoField label="Phone" value={org?.phone} />
          <InfoField label="Fax" value={org?.fax} />
          <InfoField label="Primary contact" value={org?.contactName} />
          <InfoField label="Contact title" value={org?.contactTitle} />
          <InfoField
            label="Established"
            value={org?.establishedAt ? new Date(org.establishedAt).toLocaleDateString() : null}
          />
        </div>
      </section>

      <section className="org-management-section">
        <div className="org-section-head">
          <div>
            <h2>Organization Management</h2>
            <p>Open a section to manage records connected to this organization.</p>
          </div>
        </div>
        <div className="org-quick-grid">
          {MANAGEMENT_CARDS.map(({ key, label, description, Icon }) => (
            <button
              key={key}
              type="button"
              className="org-quick-card"
              onClick={() => nav(`/organizations/${id}/${key}`)}
            >
              <span className="org-quick-icon"><Icon size={20} strokeWidth={1.75} /></span>
              <b>{label}</b>
              <p>{description}</p>
              <span className="org-quick-action">Open section <span aria-hidden="true">→</span></span>
            </button>
          ))}
        </div>
      </section>

      <section className="org-records-panel panel">
        <div className="org-records-inner">
          <span className="org-records-icon"><ShieldCheck size={22} strokeWidth={1.75} /></span>
          <div>
            <h3>Organization-centered records</h3>
            <p>
              Practices, providers, facilities, and payer participation connect to this organization through shared master
              records and affiliations. Provider affiliations reuse the same provider profiles across the
              organization without creating duplicate records. Facilities and practices remain linked through
              the organization context used by enrollments, credentialing cases, documents, and tasks.
            </p>
          </div>
        </div>
      </section>

      <section className="org-snapshot panel">
        <div className="panel-heading">
          <div>
            <h2>Organization Snapshot</h2>
            <p>Live counts from database records linked to this organization.</p>
          </div>
        </div>
        <div className="org-snapshot-grid">
          {snapshot.map((item) => (
            <button
              key={item.label}
              type="button"
              className="org-snapshot-item"
              onClick={() => nav(`/organizations/${id}/${item.to}`)}
            >
              <span>{item.label}</span>
              <b>{item.value ?? 0}</b>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function OrganizationWorkspace() {
  const { id } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const [org, setOrg] = useState(null);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const parts = location.pathname.split('/').filter(Boolean);
  const section = parts[2] || 'overview';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const found = (await api.get(`/organizations/${id}`)).data;
      setOrg(found);
      const summary = (await api.get(`/organizations/${id}/workspace-summary`)).data;
      setStats(summary || {});
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not load organization workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  const title = org?.dba || org?.legalName || 'Organization Workspace';
  const sectionMeta = organizationSections.find(s => s.key === section);
  const crumbs = [
    { label: 'Directory', to: '/organizations' },
    { label: 'Organizations', to: '/organizations' },
    { label: title, to: `/organizations/${id}/overview` },
    ...(section !== 'overview' ? [{ label: sectionMeta?.label || section }] : [])
  ];

  const kpiCards = [
    ['Employees', stats.employeesActive, Users, 'employees'],
    ['Payers (active)', stats.payersActive, ShieldCheck, 'payers'],
    ['Practices', stats.practices, Landmark, 'practices'],
    ['Facilities', stats.facilities, MapPin, 'facilities'],
    ['Providers', stats.providers, Stethoscope, 'providers'],
    ['Active enrollments', stats.enrollmentsActive, CreditCard, 'enrollments'],
    ['Pending cases', stats.casesPending, ClipboardCheck, 'cases'],
    ['Overdue tasks', stats.tasksOverdue, AlertTriangle, 'tasks']
  ];

  return (
    <div className="page org-workspace">
      <div className="org-workspace-head">
        <div className="org-workspace-head-main">
          <BackButton
            label="Back to Organizations"
            fallbackHref="/organizations"
            listKey={LIST_KEYS.organizations}
            autoLabel
            hints={{ organizationId: id }}
            className="back-btn page-back"
          />
          <AppBreadcrumbs crumbs={crumbs} />
          <span className="eyebrow">ORGANIZATION WORKSPACE</span>
          <h1>{loading ? 'Loading organization…' : title}</h1>
          <div className="org-head-meta">
            {org?.taxId && <span>Tax ID {org.taxId}</span>}
            {org?.email && <span>{org.email}</span>}
            {org?.phone && <span>{org.phone}</span>}
            {!org?.taxId && !org?.email && !org?.phone && (
              <span>Manage this organization’s people, locations, payer relationships and operations.</span>
            )}
          </div>
        </div>
        <div className="org-head-actions">
          {org && <StatusBadge value={org.status} />}
          <button type="button" className="secondary" onClick={load}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="error banner">{error}</div>}

      {!error && (
        <>
          <div className="org-stat-grid">
            {kpiCards.map(([label, value, Icon, key]) => (
              <button
                type="button"
                className="org-stat"
                key={label}
                onClick={() => nav(`/organizations/${id}/${key}`)}
              >
                <span className="org-stat-icon"><Icon size={18} strokeWidth={1.75} /></span>
                <span className="org-stat-label">{label}</span>
                <b>{loading ? '—' : value ?? 0}</b>
              </button>
            ))}
          </div>

          <div className="org-workspace-layout">
            <section className="org-section-content">
              {section === 'overview' && <OrganizationOverview org={org} stats={stats} id={id} />}
              {section === 'profile' && <OrganizationProfile org={org} />}
              {section === 'audit' && <AuditPage organizationId={id} />}
              {section === 'employees' && (
                <OrganizationEmployeesPanel organizationId={id} orgName={title} />
              )}
              {section === 'payers' && (
                <OrganizationPayersPanel organizationId={id} orgName={title} />
              )}
              {section === 'enrollments' && <EnrollmentsPage organizationId={id} />}
              {section !== 'overview'
                && section !== 'profile'
                && section !== 'audit'
                && section !== 'employees'
                && section !== 'payers'
                && section !== 'enrollments' && (
                <RecordPage
                  type={sectionResource[section] || 'providers'}
                  scopedId={id}
                  orgName={title}
                />
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
