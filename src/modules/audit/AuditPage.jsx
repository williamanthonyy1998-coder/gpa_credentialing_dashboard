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
        <div className="table-scroll table-cards">
          <table>
            <thead>
              <tr>
                <th className="col-mid">Time</th>
                <th>Actor</th>
                <th className="col-status">Action</th>
                <th className="col-mid">Record type</th>
                <th>Record ID</th>
                <th className="col-narrow">Source IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="table-empty">Loading audit events…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    <div className="empty-inline">
                      <b>No audit events yet</b>
                      <span>Create, update, and delete actions will appear here for operational traceability.</span>
                    </div>
                  </td>
                </tr>
              ) : rows.map(r => {
                const actor = r.actor?.name || r.actor?.email || 'System / unavailable';
                const when = new Date(r.createdAt).toLocaleString();
                return (
                <tr key={r.id}>
                  <td className="col-mid" data-label="Time" title={when}>{when}</td>
                  <td data-label="Actor"><span className="cell-clip" title={actor}>{actor}</span></td>
                  <td className="col-status" data-label="Action"><StatusBadge value={r.action} /></td>
                  <td className="col-mid" data-label="Record type"><span className="cell-clip" title={r.entityType}>{r.entityType}</span></td>
                  <td data-label="Record ID"><span className="cell-clip" title={r.entityId || '—'}>{r.entityId || '—'}</span></td>
                  <td className="col-narrow" data-label="Source IP"><span className="cell-clip" title={r.ipAddress || '—'}>{r.ipAddress || '—'}</span></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
