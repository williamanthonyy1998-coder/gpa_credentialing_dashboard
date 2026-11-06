import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  CheckSquare, CreditCard, FileText, Landmark, MapPin, RefreshCw,
  ShieldCheck, Stethoscope, ClipboardCheck, Users
} from 'lucide-react';
import api from '../../api/client';
import { sectionResource, organizationSections } from '../../config/resources';
import StatusBadge from '../../components/common/StatusBadge';
import BackButton from '../../components/common/BackButton';
import AppBreadcrumbs from '../../components/common/AppBreadcrumbs';
import RecordPage from '../records/RecordPage';
import EmployeesPage from '../employees/EmployeesPage';
import AuditPage from '../audit/AuditPage';
import { LIST_KEYS } from '../../navigation/listReturn';

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

function OrganizationOverview({ org, stats, id }) {
  const nav = useNavigate();
  const quick = [
    ['Manage practices', 'practices', Landmark],
    ['Manage providers', 'providers', Stethoscope],
    ['Manage facilities', 'facilities', MapPin],
    ['Payer directory', 'payers', ShieldCheck],
    ['Payer enrollment', 'enrollments', CreditCard],
    ['Credentialing cases', 'cases', ClipboardCheck],
    ['Documents', 'documents', FileText],
    ['Employees & HR', 'employees', Users],
    ['Tasks & workflow', 'tasks', CheckSquare]
  ];
  return (
    <div className="org-overview-content">
      <div className="org-welcome panel">
        <div>
          <span className="eyebrow">WORKSPACE OVERVIEW</span>
          <h2>{org?.dba || org?.legalName || 'Organization'}</h2>
          <p>All records and operational work for this organization are managed from this workspace.</p>
        </div>
        <div className="org-status-block">
          <StatusBadge value={org?.status} />
          <small>{org?.phone || 'No phone added'}<br />{org?.email || 'No email added'}</small>
        </div>
      </div>
      <div className="org-quick-grid">
        {quick.map(([label, key, Icon]) => (
          <button key={key} className="org-quick-card" onClick={() => nav(`/organizations/${id}/${key}`)}>
            <span className="org-quick-icon"><Icon size={19} /></span>
            <b>{label}</b>
            <span>Open section <span aria-hidden="true">→</span></span>
          </button>
        ))}
      </div>
      <div className="note-strip">
        <ShieldCheck size={18} />
        <div>
          <b>Organization-centered records</b>
          <span>Use the same master provider, facility, payer and enrollment records across the organization. Affiliations connect shared providers without creating duplicate profiles.</span>
        </div>
      </div>
      <div className="org-stat-inline muted-note">
        Snapshot · Practices {stats.practices ?? 0} · Facilities {stats.facilities ?? 0} · Provider affiliations {stats.providerOrganizations ?? 0}
      </div>
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
      const resources = ['practices', 'facilities', 'providerOrganizations', 'enrollments', 'documents', 'cases'];
      const results = await Promise.all(
        resources.map(r => api.get(`/${r}`, { params: { limit: 100, organizationId: id } }).catch(() => ({ data: [] })))
      );
      setStats(Object.fromEntries(resources.map((r, i) => [r, results[i].data.length])));
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

  return (
    <div className="page org-workspace">
      <div className="org-workspace-head">
        <div>
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
          <p>
            {org?.legalName && org?.dba ? `${org.legalName} · ` : ''}
            {org?.taxId ? `Tax ID ${org.taxId} · ` : ''}
            {org?.email || 'Manage this organization’s people, locations, payer relationships and operations.'}
          </p>
        </div>
        <div className="org-head-actions">
          {org && <StatusBadge value={org.status} />}
          <button className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>
      {error && <div className="error banner">{error}</div>}
      {!error && (
        <>
          <div className="org-stat-grid">
            {[
              ['Practices', stats.practices, Landmark],
              ['Facilities', stats.facilities, MapPin],
              ['Provider affiliations', stats.providerOrganizations, Stethoscope],
              ['Payer enrollments', stats.enrollments, CreditCard],
              ['Credentialing cases', stats.cases, ClipboardCheck],
              ['Documents', stats.documents, FileText]
            ].map(([label, value, Icon]) => (
              <div className="org-stat" key={label}>
                <Icon size={18} />
                <span>{label}</span>
                <b>{loading ? '—' : value ?? 0}</b>
              </div>
            ))}
          </div>
          <div className="org-workspace-layout org-workspace-layout-unified">
            <section className="org-section-content">
              {section === 'overview' && <OrganizationOverview org={org} stats={stats} id={id} />}
              {section === 'profile' && <OrganizationProfile org={org} />}
              {section === 'audit' && <AuditPage organizationId={id} />}
              {section === 'employees' && <EmployeesPage organizationId={id} />}
              {section !== 'overview' && section !== 'profile' && section !== 'audit' && section !== 'employees' && (
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
