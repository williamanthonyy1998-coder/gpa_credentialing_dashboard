import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';

export default function ProviderDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      setData((await api.get('/provider-portal/dashboard')).data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load provider portal');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <PageHeader
        eyebrow="PROVIDER PORTAL"
        title="My intakes"
        description="Complete assigned credentialing intake requests and upload supporting documents."
        breadcrumbs={[{ label: 'Provider portal' }]}
        actions={<button type="button" className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>}
      />
      {error && <div className="error banner">{error}</div>}
      {data && (
        <>
          <div className="metric-grid">
            <StatCard label="Assigned" value={data.counts.total} tone="navy" />
            <StatCard label="In progress" value={data.counts.draft} tone="blue" />
            <StatCard label="Submitted" value={data.counts.submitted} tone="green" />
            <StatCard label="Changes requested" value={data.counts.changesRequested} tone="warning" />
            <StatCard label="Approved" value={data.counts.approved} tone="green" />
          </div>
          {(data.convertedProviders || []).length > 0 && (
            <section className="panel" style={{ marginTop: 16, padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>Professional history</h3>
              <p className="muted">After conversion you can maintain structured professional history for review.</p>
              <ul>
                {data.convertedProviders.map((p) => (
                  <li key={p.providerId}>
                    <Link to={`/provider-portal/providers/${p.providerId}/history`}>
                      History for {p.referenceNo}{p.tenantName ? ` (${p.tenantName})` : ''}
                    </Link>
                    {' · '}
                    <Link to={`/provider-portal/providers/${p.providerId}/credentialing`}>
                      Credentialing profile
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="panel table-panel" style={{ marginTop: 16 }}>
            <h3 style={{ padding: '12px 16px', margin: 0 }}>Recent intakes</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(data.intakes || []).map((row) => (
                    <tr key={row.id}>
                      <td>{row.referenceNo}</td>
                      <td>{row.tenant?.name || '—'}</td>
                      <td><StatusBadge value={row.status} /></td>
                      <td>{new Date(row.updatedAt).toLocaleString()}</td>
                      <td><Link to={`/provider-portal/intakes/${row.id}`}>Open</Link></td>
                    </tr>
                  ))}
                  {!data.intakes?.length && (
                    <tr><td colSpan="5" className="table-empty">No assigned intakes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <p className="muted" style={{ marginTop: 12 }}>
            <Link to="/provider-portal/intakes">View all intakes</Link>
          </p>
        </>
      )}
    </div>
  );
}
