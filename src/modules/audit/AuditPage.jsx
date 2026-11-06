import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

export default function AuditPage({ organizationId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/audit', { params: organizationId ? { organizationId } : {} })
      .then(r => setRows(r.data))
      .catch(e => setError(e.response?.data?.error || 'Could not load audit history'))
      .finally(() => setLoading(false));
  }, [organizationId]);

  return (
    <div className={organizationId ? 'page org-record-page' : 'page'}>
      <PageHeader
        eyebrow="GOVERNANCE"
        title="Audit Log"
        description="Review recorded create, update, and delete events for operational traceability."
        breadcrumbs={organizationId
          ? [
            { label: 'Directory', to: '/organizations' },
            { label: 'Organization', to: `/organizations/${organizationId}/overview` },
            { label: 'Activity & Audit' }
          ]
          : [
            { label: 'Workspace', to: '/' },
            { label: 'Audit Log' }
          ]}
        back={organizationId
          ? { label: 'Back to Organization', fallbackHref: `/organizations/${organizationId}/overview`, autoLabel: true }
          : { label: 'Back', fallbackHref: null, autoLabel: true, hideIfNoTarget: true, listKey: 'audit' }}
      />
      {error && <div className="error banner">{error}</div>}
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th><th>Actor</th><th>Action</th>
                <th>Record type</th><th>Record ID</th><th>Source IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="table-empty">Loading audit events…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="6" className="table-empty">No audit events recorded yet.</td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{r.actor?.name || r.actor?.email || 'System / unavailable'}</td>
                  <td><StatusBadge value={r.action} /></td>
                  <td>{r.entityType}</td>
                  <td>{r.entityId || '—'}</td>
                  <td>{r.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
