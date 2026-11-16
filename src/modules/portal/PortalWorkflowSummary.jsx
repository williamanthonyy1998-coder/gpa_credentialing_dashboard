import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

export default function PortalWorkflowSummary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState('');
  const [status, setStatus] = useState('');
  const [slaStatus, setSlaStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/portal/workflow-summary', {
        params: {
          organizationId: organizationId || undefined,
          status: status || undefined,
          slaStatus: slaStatus || undefined
        }
      });
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not load workflow summary');
    } finally {
      setLoading(false);
    }
  }, [organizationId, status, slaStatus]);

  useEffect(() => { load(); }, [load]);

  const c = data?.counts || {};

  return (
    <div className="page">
      <PageHeader
        eyebrow="CLIENT PORTAL"
        title="Enrollment workflow summary"
        description="Read-only SLA and follow-up visibility for your assigned organizations."
        breadcrumbs={[{ label: 'Portal', to: '/portal' }, { label: 'Workflow' }]}
      />

      {error && <div className="error banner">{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
          <option value="">All my organizations</option>
          {(data?.organizations || []).map((o) => (
            <option key={o.id} value={o.id}>{o.dba || o.legalName}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All application statuses</option>
          {['PREPARING', 'READY_TO_SUBMIT', 'SUBMITTED', 'ACKNOWLEDGED', 'PAYER_REVIEW', 'ADDITIONAL_INFORMATION_NEEDED', 'APPROVED', 'EFFECTIVE', 'DENIED', 'WITHDRAWN'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={slaStatus} onChange={(e) => setSlaStatus(e.target.value)}>
          <option value="">All SLA statuses</option>
          {['NOT_STARTED', 'WITHIN_SLA', 'DUE_SOON', 'AT_RISK', 'OVERDUE', 'COMPLETED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="button" className="secondary" onClick={load}>Refresh</button>
        <Link className="secondary" to="/portal">Back to portal</Link>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && data && (
        <>
          <p className="muted">{data.note}</p>
          <div className="org-stat-grid" style={{ marginBottom: 16 }}>
            {[
              ['Active enrollments', c.activeEnrollments],
              ['Pending applications', c.pendingApplications],
              ['Upcoming follow-ups', c.upcomingFollowUps],
              ['Overdue applications', c.overdueApplications],
              ['Completed applications', c.completedApplications]
            ].map(([label, value]) => (
              <div className="org-stat" key={label}>
                <span className="org-stat-label">{label}</span>
                <b>{value ?? 0}</b>
              </div>
            ))}
          </div>

          {!data.items?.length && <p className="muted">No enrollment applications match these filters.</p>}
          {!!data.items?.length && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Organization</th>
                    <th>Provider</th>
                    <th>Payer</th>
                    <th>Status</th>
                    <th>Last follow-up</th>
                    <th>Next follow-up</th>
                    <th>SLA</th>
                    <th>Expected completion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={`/enrollments?id=${row.id}`}>{row.applicationNo}</Link>
                      </td>
                      <td>{row.organizationName || '—'}</td>
                      <td>{row.providerName || '—'}</td>
                      <td>{row.payerName || '—'}</td>
                      <td><StatusBadge value={row.status} /></td>
                      <td>{row.lastFollowUpAt ? new Date(row.lastFollowUpAt).toLocaleDateString() : '—'}</td>
                      <td>{row.nextFollowUpAt ? new Date(row.nextFollowUpAt).toLocaleDateString() : '—'}</td>
                      <td>{row.slaStatus ? <StatusBadge value={row.slaStatus} /> : '—'}</td>
                      <td>{row.expectedCompletionAt ? new Date(row.expectedCompletionAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
