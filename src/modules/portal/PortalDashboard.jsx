import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Inbox, RefreshCw, Users } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';

export default function PortalDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/portal/dashboard');
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load client portal');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <PageHeader
        eyebrow="CLIENT PORTAL"
        title={data?.tenant?.name || 'Client portal'}
        description="Tenant-scoped overview for your GPA client account."
        breadcrumbs={[{ label: 'Portal' }]}
        actions={<button type="button" className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>}
      />
      {error && <div className="error banner">{error}</div>}
      {data && (
        <>
          <p className="muted">
            Onboarding: <StatusBadge value={data.tenant.onboardingStatus} /> · Account: <StatusBadge value={data.tenant.status} />
          </p>
          <div className="metric-grid">
            <StatCard label="Organizations" value={loading ? '—' : data.counts.organizations} icon={Building2} tone="navy" />
            <StatCard label="Practices" value={loading ? '—' : data.counts.practices} icon={Building2} tone="blue" />
            <StatCard label="Facilities" value={loading ? '—' : data.counts.facilities} icon={Building2} tone="green" />
            <StatCard label="Active users" value={loading ? '—' : data.counts.activeUsers} icon={Users} tone="navy" />
            <StatCard label="Pending invites" value={loading ? '—' : data.counts.pendingInvitations} icon={Inbox} tone="warning" />
          </div>

          <section className="panel" style={{ padding: 16, marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Quick links</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link className="secondary" to="/portal/profile">Client profile</Link>
              <Link className="secondary" to="/portal/users">Users & invitations</Link>
              <Link className="secondary" to="/portal/organizations">Organizations</Link>
              <Link className="secondary" to="/portal/provider-intakes">Provider intakes</Link>
              <Link className="secondary" to="/portal/credentialing-readiness">Credentialing readiness</Link>
              <Link className="secondary" to="/organizations">Full directory</Link>
            </div>
          </section>

          <section className="panel" style={{ padding: 16, marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Module availability</h3>
            <ul>
              {Object.entries(data.modules || {}).map(([key, mod]) => (
                <li key={key}>
                  <b>{key}</b>: {mod.available ? 'Available' : 'Upcoming'} — {mod.note}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel table-panel" style={{ marginTop: 16 }}>
            <h3 style={{ padding: '12px 16px', margin: 0 }}>Recent activity</h3>
            <div className="table-scroll">
              <table>
                <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Actor</th></tr></thead>
                <tbody>
                  {(data.recentActivity || []).map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.createdAt).toLocaleString()}</td>
                      <td>{a.action}</td>
                      <td>{a.entityType}</td>
                      <td>{a.actor?.name || a.actor?.email || '—'}</td>
                    </tr>
                  ))}
                  {!data.recentActivity?.length && (
                    <tr><td colSpan="4" className="table-empty">No recent activity</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
