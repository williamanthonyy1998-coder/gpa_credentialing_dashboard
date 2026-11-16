import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const QUEUES = [
  { key: 'my-work', label: 'My Work' },
  { key: 'pending-follow-ups', label: 'Pending Follow-ups' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'expiring-credentials', label: 'Expiring Credentials' },
  { key: 'revalidation-due', label: 'Revalidation Due' },
  { key: 'sla', label: 'SLA Overview' }
];

const KPI_TO_QUEUE = {
  pendingFollowUps: 'pending-follow-ups',
  followUpsDueToday: 'pending-follow-ups',
  overdueFollowUps: 'overdue',
  applicationsAtRisk: 'sla',
  overdueApplications: 'sla',
  upcomingCredentialExpirations: 'expiring-credentials',
  expiredCredentials: 'expiring-credentials',
  pendingRevalidations: 'revalidation-due',
  openEscalations: 'escalated',
  overdueTasks: 'overdue'
};

const POLICY_KINDS = [
  'FOLLOW_UP_INTERVAL',
  'ESCALATION',
  'SLA',
  'EXPIRY_ALERT',
  'TASK_ASSIGNMENT',
  'NOTIFICATION'
];

export default function AutomationPage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'dashboard';
  const queue = params.get('queue') || 'my-work';

  const [kpis, setKpis] = useState(null);
  const [queueData, setQueueData] = useState({ items: [] });
  const [policies, setPolicies] = useState([]);
  const [runs, setRuns] = useState([]);
  const [ops, setOps] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [policyForm, setPolicyForm] = useState(null);

  const setTab = (next) => {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p);
  };

  const setQueue = (next) => {
    const p = new URLSearchParams(params);
    p.set('tab', 'queues');
    p.set('queue', next);
    setParams(p);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'dashboard' || tab === 'queues') {
        const dash = await api.get('/automation/dashboard');
        setKpis(dash.data);
      }
      if (tab === 'queues') {
        const q = await api.get(`/automation/queues/${queue}`);
        setQueueData(q.data);
      }
      if (tab === 'policies') {
        const p = await api.get('/automation/policies');
        setPolicies(p.data.items || []);
      }
      if (tab === 'history') {
        const r = await api.get('/automation/runs');
        setRuns(r.data.items || []);
      }
      if (tab === 'ops') {
        const o = await api.get('/automation/ops');
        setOps(o.data);
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load automation data');
    } finally {
      setLoading(false);
    }
  }, [tab, queue]);

  useEffect(() => { load(); }, [load]);

  async function runSweep() {
    setBusy(true);
    setError('');
    try {
      await api.post('/automation/runs/sweep', {});
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function acknowledgeEscalation(id) {
    setBusy(true);
    try {
      await api.post(`/automation/escalations/${id}/acknowledge`, {});
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveEscalation(id) {
    setBusy(true);
    try {
      await api.post(`/automation/escalations/${id}/resolve`, { resolutionNotes: 'Resolved from automation work queue' });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function acknowledgeAlert(id) {
    setBusy(true);
    try {
      await api.post(`/automation/alerts/${id}/acknowledge`, {});
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePolicy(row) {
    setBusy(true);
    try {
      await api.patch(`/automation/policies/${row.id}`, { enabled: !row.enabled });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(e) {
    e.preventDefault();
    if (!policyForm) return;
    setBusy(true);
    setError('');
    try {
      let config;
      try {
        config = JSON.parse(policyForm.configText);
      } catch {
        setError('Policy config must be valid JSON');
        setBusy(false);
        return;
      }
      await api.post('/automation/policies', {
        id: policyForm.id || undefined,
        kind: policyForm.kind,
        name: policyForm.name,
        description: policyForm.description || null,
        enabled: policyForm.enabled !== false,
        config
      });
      setPolicyForm(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  }

  const kpiCards = kpis ? [
    ['Pending follow-ups', kpis.pendingFollowUps, 'pendingFollowUps'],
    ['Follow-ups due today', kpis.followUpsDueToday, 'followUpsDueToday'],
    ['Overdue follow-ups', kpis.overdueFollowUps, 'overdueFollowUps'],
    ['Applications at risk', kpis.applicationsAtRisk, 'applicationsAtRisk'],
    ['Overdue applications', kpis.overdueApplications, 'overdueApplications'],
    ['Upcoming expirations', kpis.upcomingCredentialExpirations, 'upcomingCredentialExpirations'],
    ['Expired credentials', kpis.expiredCredentials, 'expiredCredentials'],
    ['Pending revalidations', kpis.pendingRevalidations, 'pendingRevalidations'],
    ['Open escalations', kpis.openEscalations, 'openEscalations'],
    ['Overdue tasks', kpis.overdueTasks, 'overdueTasks'],
    ['SLA compliance %', kpis.slaCompliancePct ?? '—', 'applicationsAtRisk'],
    ['Avg turnaround (days)', kpis.averageTurnaroundDays ?? '—', 'applicationsAtRisk']
  ] : [];

  return (
    <div className="page">
      <PageHeader
        title="Workflow Automation"
        subtitle="Follow-ups, escalations, SLA tracking, expiry alerts, and automation policies — driven by live database records."
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {[
          ['dashboard', 'Dashboard'],
          ['queues', 'Work Queues'],
          ['policies', 'Automation Rules'],
          ['history', 'Execution History'],
          ['ops', 'Operations']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'primary' : 'secondary'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="secondary" onClick={() => nav('/automation/calendar')}>
          Expiration calendar
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={runSweep}>
          {busy ? 'Running…' : 'Run sweep now'}
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p>Loading…</p>}

      {!loading && tab === 'dashboard' && (
        <div className="org-stat-grid" style={{ marginBottom: 24 }}>
          {kpiCards.map(([label, value, key]) => (
            <button
              key={label}
              type="button"
              className="org-stat"
              onClick={() => setQueue(KPI_TO_QUEUE[key] || 'my-work')}
            >
              <span className="org-stat-label">{label}</span>
              <b>{value ?? 0}</b>
            </button>
          ))}
        </div>
      )}

      {!loading && tab === 'queues' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {QUEUES.map((q) => (
              <button
                key={q.key}
                type="button"
                className={queue === q.key ? 'primary' : 'secondary'}
                onClick={() => setQueue(q.key)}
              >
                {q.label}
              </button>
            ))}
          </div>
          {!queueData.items?.length && <p className="muted">No items in this queue.</p>}
          {!!queueData.items?.length && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th>Due / Level</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueData.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.title || item.reason || item.alertType || item.entityType || item.revalidationType || item.id}
                        {item.applicationNo ? ` · ${item.applicationNo}` : ''}
                      </td>
                      <td><StatusBadge value={item.status || item.slaStatus || 'OPEN'} /></td>
                      <td>
                        {item.dueAt ? new Date(item.dueAt).toLocaleString() : null}
                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : null}
                        {item.level != null ? `L${item.level}` : null}
                        {item.thresholdKey ? ` · ${item.thresholdKey}` : null}
                        {item.expectedCompletionAt ? new Date(item.expectedCompletionAt).toLocaleDateString() : null}
                      </td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.enrollmentId && (
                          <button type="button" className="secondary" onClick={() => nav(`/enrollments?id=${item.enrollmentId}`)}>Open</button>
                        )}
                        {queue === 'escalated' && item.status === 'OPEN' && (
                          <button type="button" className="secondary" disabled={busy} onClick={() => acknowledgeEscalation(item.id)}>Acknowledge</button>
                        )}
                        {queue === 'escalated' && item.status !== 'RESOLVED' && (
                          <button type="button" className="secondary" disabled={busy} onClick={() => resolveEscalation(item.id)}>Resolve</button>
                        )}
                        {queue === 'expiring-credentials' && item.status !== 'ACKNOWLEDGED' && (
                          <button type="button" className="secondary" disabled={busy} onClick={() => acknowledgeAlert(item.id)}>Acknowledge</button>
                        )}
                        {queue === 'my-work' || queue === 'overdue' || queue === 'pending-follow-ups' ? (
                          <button type="button" className="secondary" onClick={() => nav('/tasks')}>Tasks</button>
                        ) : null}
                        {queue === 'revalidation-due' && (
                          <button type="button" className="secondary" onClick={() => nav('/revalidation-ops')}>Revalidation</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'policies' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="primary"
              onClick={() => setPolicyForm({
                kind: 'FOLLOW_UP_INTERVAL',
                name: '',
                description: '',
                enabled: true,
                configText: JSON.stringify({ defaultIntervalDays: 7, intervalsDays: [3, 7, 14] }, null, 2)
              })}
            >
              New policy
            </button>
          </div>
          {policyForm && (
            <form className="panel" onSubmit={savePolicy} style={{ marginBottom: 16, padding: 16 }}>
              <h3>{policyForm.id ? 'Edit policy' : 'Create policy'}</h3>
              <label>
                Kind
                <select
                  value={policyForm.kind}
                  onChange={(e) => setPolicyForm({ ...policyForm, kind: e.target.value })}
                  disabled={!!policyForm.id}
                >
                  {POLICY_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label>
                Name
                <input
                  value={policyForm.name}
                  onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Description
                <input
                  value={policyForm.description || ''}
                  onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })}
                />
              </label>
              <label>
                Config (JSON)
                <textarea
                  rows={8}
                  value={policyForm.configText}
                  onChange={(e) => setPolicyForm({ ...policyForm, configText: e.target.value })}
                  required
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="primary" disabled={busy}>Save</button>
                <button type="button" className="secondary" onClick={() => setPolicyForm(null)}>Cancel</button>
              </div>
            </form>
          )}
          {!policies.length && <p className="muted">No policies yet. Defaults are created on first load.</p>}
          {!!policies.length && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Name</th>
                    <th>Enabled</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((row) => (
                    <tr key={row.id}>
                      <td>{row.kind}</td>
                      <td>{row.name}</td>
                      <td><StatusBadge value={row.enabled ? 'ACTIVE' : 'INACTIVE'} /></td>
                      <td>{new Date(row.updatedAt).toLocaleString()}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setPolicyForm({
                            id: row.id,
                            kind: row.kind,
                            name: row.name,
                            description: row.description || '',
                            enabled: row.enabled,
                            configText: JSON.stringify(row.config || {}, null, 2)
                          })}
                        >
                          Edit
                        </button>
                        <button type="button" className="secondary" disabled={busy} onClick={() => togglePolicy(row)}>
                          {row.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'history' && (
        <>
          {!runs.length && <p className="muted">No automation runs recorded yet.</p>}
          {!!runs.length && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Triggered by</th>
                    <th>Started</th>
                    <th>Finished</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>{r.jobType}</td>
                      <td><StatusBadge value={r.status} /></td>
                      <td>{r.triggeredBy}</td>
                      <td>{new Date(r.startedAt).toLocaleString()}</td>
                      <td>{r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}</td>
                      <td>{r.errorMessage || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'ops' && ops && (
        <>
          <section className="panel" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Scheduler</h3>
            <p className="muted">{ops.scheduler?.note}</p>
            <div className="org-stat-grid">
              <div className="org-stat"><span className="org-stat-label">Enabled</span><b>{ops.scheduler?.enabled ? 'Yes' : 'No'}</b></div>
              <div className="org-stat"><span className="org-stat-label">Interval (ms)</span><b>{ops.scheduler?.intervalMs ?? '—'}</b></div>
              <div className="org-stat"><span className="org-stat-label">Last run</span><b>{ops.scheduler?.lastExecutionAt ? new Date(ops.scheduler.lastExecutionAt).toLocaleString() : '—'}</b></div>
              <div className="org-stat"><span className="org-stat-label">Next expected</span><b>{ops.scheduler?.nextExpectedAt ? new Date(ops.scheduler.nextExpectedAt).toLocaleString() : '—'}</b></div>
            </div>
          </section>
          <div className="org-stat-grid" style={{ marginBottom: 16 }}>
            {[
              ['Successful runs', ops.counts?.successfulJobRuns],
              ['Failed runs', ops.counts?.failedJobRuns],
              ['Active locks', ops.counts?.activeLocks],
              ['Failed email deliveries', ops.counts?.failedNotificationDeliveries],
              ['Pending email retries', ops.counts?.pendingEmailRetries],
              ['Follow-ups (7d)', ops.counts?.followUpsGenerated7d],
              ['Escalations (7d)', ops.counts?.escalationsGenerated7d],
              ['Expiry alerts (7d)', ops.counts?.expiryAlertsGenerated7d],
              ['SLA refreshes (7d)', ops.counts?.slaRecordsRefreshed7d]
            ].map(([label, value]) => (
              <div className="org-stat" key={label}>
                <span className="org-stat-label">{label}</span>
                <b>{value ?? 0}</b>
              </div>
            ))}
          </div>
          {!!ops.failedDeliveries?.length && (
            <section className="panel" style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>Failed / retrying email deliveries</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Updated</th><th>Status</th><th>Attempts</th><th>Summary</th><th>Error</th></tr>
                  </thead>
                  <tbody>
                    {ops.failedDeliveries.map((d) => (
                      <tr key={d.id}>
                        <td>{new Date(d.updatedAt).toLocaleString()}</td>
                        <td>{d.status}</td>
                        <td>{d.attemptCount}</td>
                        <td>{d.payloadSummary || '—'}</td>
                        <td>{d.lastError || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
