import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';

/**
 * GPA Credentialing QA dashboard (Phase 3D).
 * On-demand scan — not a background scheduler. Not payer approval.
 */
export default function CredentialingQaDashboard() {
  const [dash, setDash] = useState(null);
  const [findings, setFindings] = useState([]);
  const [scans, setScans] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('OPEN');

  const load = useCallback(async () => {
    setError('');
    try {
      const [d, f, s] = await Promise.all([
        api.get('/credentialing-qa/dashboard').then((r) => r.data),
        api.get('/credentialing-qa/findings', {
          params: { all: '1', status: status || undefined, severity: severity || undefined, pageSize: 50 }
        }).then((r) => r.data),
        api.get('/credentialing-qa/scans').then((r) => r.data)
      ]);
      setDash(d);
      setFindings(f.data || []);
      setScans(s.items || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load credentialing QA');
    }
  }, [status, severity]);

  useEffect(() => { load(); }, [load]);

  async function runScan() {
    setBusy(true);
    setError('');
    try {
      await api.post('/credentialing-qa/scan', { persist: true, limit: 100 });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Scan failed');
    } finally {
      setBusy(false);
    }
  }

  async function resolveFinding(id, mode) {
    setBusy(true);
    setError('');
    try {
      await api.post(`/credentialing-qa/findings/${id}/resolve`, { mode });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Resolve failed — underlying issue may remain');
    } finally {
      setBusy(false);
    }
  }

  const c = dash?.counts || {};

  return (
    <div className="page">
      <PageHeader
        eyebrow="CREDENTIALING QA"
        title="Verification & data integrity"
        description="Operational QA only. Manual verification is not automated state-board verification. Not payer enrollment approval."
        breadcrumbs={[{ label: 'Credentialing QA' }]}
        actions={(
          <>
            <button type="button" className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
            <button type="button" className="btn" disabled={busy} onClick={runScan}>
              <ShieldAlert size={15} /> Run tenant QA scan
            </button>
          </>
        )}
      />
      {error && <div className="error banner">{error}</div>}
      {dash && (
        <>
          <p className="muted">{dash.disclaimer}</p>
          <div className="metric-grid">
            <StatCard label="Providers" value={c.providersTotal} tone="navy" />
            <StatCard label="Incomplete (no specialty)" value={c.incompleteProfiles} tone="warning" />
            <StatCard label="Pending license verify" value={c.pendingLicenseVerification} tone="blue" />
            <StatCard label="Rejected licenses" value={c.rejectedLicenses} tone="warning" />
            <StatCard label="Expired licenses" value={c.expiredLicenses} tone="warning" />
            <StatCard label="Expiring 30d" value={c.licensesExpiring30} tone="blue" />
            <StatCard label="Pending history" value={c.pendingHistoryVerification} tone="blue" />
            <StatCard label="Rejected history" value={c.rejectedHistory} tone="warning" />
            <StatCard label="Quarantined docs" value={c.quarantinedDocuments} tone="warning" />
            <StatCard label="Open QA findings" value={c.openQaFindings} tone="navy" />
            <StatCard label="Open gaps" value={c.openCredentialingGaps} tone="blue" />
            <StatCard label="Reviews awaiting" value={c.reviewsAwaitingAction} tone="blue" />
          </div>

          <section className="panel" style={{ padding: 16, marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Findings</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="REOPENED">REOPENED</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="ACCEPTED_LEGITIMATE">ACCEPTED_LEGITIMATE</option>
              </select>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="">All severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f) => {
                    const providerId = f.details?.providerId || (f.directoryType === 'credentialing.providers' ? f.recordId : null);
                    return (
                      <tr key={f.id}>
                        <td><StatusBadge value={f.severity} /></td>
                        <td>
                          <div>{f.title}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{f.description}</div>
                        </td>
                        <td>{f.directoryType}</td>
                        <td><StatusBadge value={f.status} /></td>
                        <td>
                          {providerId ? (
                            <Link to={`/providers/${providerId}/profile?step=readiness`}>Open profile</Link>
                          ) : '—'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {['OPEN', 'UNDER_REVIEW', 'REOPENED'].includes(f.status) && (
                            <>
                              <button type="button" className="secondary" disabled={busy} onClick={() => resolveFinding(f.id, 'RESOLVED')}>Resolve</button>{' '}
                              <button type="button" className="secondary" disabled={busy} onClick={() => resolveFinding(f.id, 'FALSE_POSITIVE')}>False positive</button>{' '}
                              <button type="button" className="secondary" disabled={busy} onClick={() => resolveFinding(f.id, 'ACCEPTED_RISK')}>Accept risk</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!findings.length && (
                    <tr><td colSpan={6} className="table-empty">No findings — run a scan to populate</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" style={{ padding: 16, marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Scan history</h3>
            <ul>
              {scans.map((s) => (
                <li key={s.id}>
                  {new Date(s.startedAt).toLocaleString()} — <StatusBadge value={s.status} /> —
                  providers {s.providersInspected}, created {s.findingsCreated}, updated {s.findingsUpdated}
                </li>
              ))}
              {!scans.length && <li className="muted">No scans yet</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
