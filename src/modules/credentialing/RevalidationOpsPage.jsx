import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

/**
 * Phase 4E — revalidation / renewal / reporting ops surface.
 * Additive page; does not redesign unrelated dashboards.
 */
export default function RevalidationOpsPage() {
  const [kpis, setKpis] = useState(null);
  const [worklist, setWorklist] = useState({ items: [], total: 0 });
  const [deadlines, setDeadlines] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [ops, wl, dl, enr] = await Promise.all([
        api.get('/credentialing/ops-dashboard'),
        api.get('/credentialing/revalidation-worklist', {
          params: { page: 1, pageSize: 25, status: statusFilter || undefined }
        }),
        api.get('/credentialing/deadlines', { params: { withinDays: 90, includeOverdue: 1 } }),
        api.get('/credentialing/reports/enrollments')
      ]);
      setKpis(ops.data);
      setWorklist(wl.data);
      setDeadlines(dl.data.items || []);
      setReport(enr.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function evaluateDeadlines() {
    try {
      await api.post('/credentialing/deadlines/evaluate', {});
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  async function download(kind) {
    try {
      const res = await api.get(`/credentialing/reports/export.${kind}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credentialing-report.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Export failed');
    }
  }

  const r = kpis?.revalidations || {};
  const c = kpis?.credentials || {};

  return (
    <div className="page">
      <PageHeader
        title="Revalidation & renewals"
        subtitle="Payer revalidation is separate from credential expiration. Exports are tenant-scoped and audited."
      />
      {error && <p className="form-error" role="alert">{error}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {[
          ['Upcoming', r.upcomingTotal],
          ['Due 30d', r.dueWithin30Days],
          ['Overdue', r.overdue],
          ['Preparing', r.preparing],
          ['Awaiting submit', r.awaitingSubmission],
          ['Awaiting payer', r.awaitingPayerResponse],
          ['Additional information requested', r.additionalInformationRequested],
          ['Completed', r.completed],
          ['Denied', r.denied],
          ['Creds 30d', c.credentialsExpiringWithin30Days],
          ['Expired creds', c.expiredCredentials],
          ['Pending verify', c.credentialsPendingVerification],
          ['Open tasks', c.openRenewalRelatedTasks]
        ].map(([label, value]) => (
          <div key={label} style={{ minWidth: 110 }}>
            <div className="muted">{label}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{value ?? '—'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" className="secondary" onClick={evaluateDeadlines}>
          Evaluate deadlines (tasks only)
        </button>
        <button type="button" className="secondary" onClick={() => download('xlsx')}>Export Excel</button>
        <button type="button" className="secondary" onClick={() => download('pdf')}>Export PDF</button>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All revalidation statuses</option>
          {['UPCOMING', 'PREPARING', 'READY_FOR_INTERNAL_REVIEW', 'SUBMITTED', 'OVERDUE', 'COMPLETED', 'DENIED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <h3>Revalidation worklist ({worklist.total || 0})</h3>
      <div className="table-scroll table-cards">
        <table className="brand-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>NPI</th>
              <th>Payer</th>
              <th>Type</th>
              <th>Status</th>
              <th>Due</th>
              <th>Days</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            {(worklist.items || []).map((row) => (
              <tr key={row.id}>
                <td>{[row.provider?.firstName, row.provider?.lastName].filter(Boolean).join(' ') || '—'}</td>
                <td>{row.provider?.npi || '—'}</td>
                <td>{row.payer?.name || '—'}</td>
                <td>{row.revalidationType}</td>
                <td><StatusBadge value={row.status} /></td>
                <td>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}</td>
                <td style={{ color: row.overdue ? '#b42318' : undefined }}>
                  {row.daysRemaining ?? '—'}
                </td>
                <td>{row.assignedTo?.name || '—'}</td>
              </tr>
            ))}
            {!worklist.items?.length && <tr><td colSpan="8" className="table-empty">No revalidations.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 24 }}>Upcoming deadlines</h3>
      <ul className="muted">
        {deadlines.slice(0, 25).map((d) => (
          <li key={`${d.category}-${d.recordId}`}>
            {d.category}: {d.title} — {d.daysRemaining}d ({d.statusHint})
          </li>
        ))}
        {!deadlines.length && <li>No deadlines in range.</li>}
      </ul>

      {report && (
        <>
          <h3>Enrollment status report snapshot</h3>
          <div className="muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {Object.entries(report.totals || {}).map(([k, v]) => (
              <span key={k}>{k}: <b>{v}</b></span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
