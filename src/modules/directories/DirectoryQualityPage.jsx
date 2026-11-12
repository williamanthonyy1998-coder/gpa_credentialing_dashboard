import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitMerge, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import IconButton, { RowActions } from '../../components/common/IconButton';
import CellText from '../../components/common/CellText';

const DIRECTORY_FILTERS = [
  '',
  'specialties',
  'usStates',
  'licenseTypes',
  'payers',
  'plans',
  'billingEntities',
  'credentialCategories',
  'providers',
  'licenses',
  'documents',
  'enrollments'
];

const STATUS_FILTERS = ['', 'OPEN', 'UNDER_REVIEW', 'REOPENED', 'RESOLVED', 'ACCEPTED_LEGITIMATE'];

export default function DirectoryQualityPage() {
  const [summary, setSummary] = useState(null);
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [directoryType, setDirectoryType] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [issueType, setIssueType] = useState('');
  const [mergeModal, setMergeModal] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');

  const loadSummary = useCallback(async () => {
    const r = await api.get('/directory-quality/summary', {
      params: directoryType ? { directoryType } : undefined
    });
    setSummary(r.data);
  }, [directoryType]);

  const loadIssues = useCallback(async () => {
    const r = await api.get('/directory-quality/issues', {
      params: {
        page: 1,
        pageSize: 50,
        ...(status ? { status } : {}),
        ...(directoryType ? { directoryType } : {}),
        ...(issueType ? { issueType } : {})
      }
    });
    setIssues(r.data?.data || []);
    setTotal(r.data?.total || 0);
  }, [status, directoryType, issueType]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadSummary(), loadIssues()]);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load directory quality data.');
    } finally {
      setLoading(false);
    }
  }, [loadSummary, loadIssues]);

  useEffect(() => { load(); }, [load]);

  async function runScan(persist) {
    setScanning(true);
    setError('');
    try {
      await api.post('/directory-quality/scan', {
        persist,
        directoryType: directoryType || undefined
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Quality scan failed.');
    } finally {
      setScanning(false);
    }
  }

  async function updateIssue(id, nextStatus, notes) {
    setBusy(id);
    setError('');
    try {
      await api.patch(`/directory-quality/issues/${id}`, {
        status: nextStatus,
        resolutionNotes: notes || undefined
      });
      await loadIssues();
      await loadSummary();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not update issue.');
    } finally {
      setBusy('');
    }
  }

  async function markDistinct(issue) {
    if (!issue.recordId || !issue.relatedRecordId) return;
    setBusy(issue.id);
    try {
      await api.post('/directory-quality/duplicates/mark-distinct', {
        directoryType: issue.directoryType,
        leftId: issue.recordId,
        rightId: issue.relatedRecordId,
        notes: 'Marked as distinct legitimate records'
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not mark distinct.');
    } finally {
      setBusy('');
    }
  }

  async function openMerge(issue) {
    setMergeModal(issue);
    setPreview(null);
    setError('');
    try {
      const r = await api.post('/directory-quality/merge/preview', {
        directoryType: issue.directoryType,
        survivorId: issue.recordId,
        retiredId: issue.relatedRecordId
      });
      setPreview(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Merge preview unavailable for this directory.');
      setMergeModal(null);
    }
  }

  async function commitMerge() {
    if (!mergeModal || !preview) return;
    const ok = window.confirm(
      `Merge and deactivate ${preview.retiredId} into survivor ${preview.survivorId}? This cannot be undone automatically.`
    );
    if (!ok) return;
    setBusy('merge');
    try {
      await api.post('/directory-quality/merge/commit', {
        directoryType: preview.directoryType,
        survivorId: preview.survivorId,
        retiredId: preview.retiredId,
        confirm: true
      });
      setMergeModal(null);
      setPreview(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Merge failed.');
    } finally {
      setBusy('');
    }
  }

  const finding = summary?.findings;
  const counts = summary?.counts;

  const duplicateIssues = useMemo(
    () => issues.filter((i) => String(i.issueType || '').startsWith('DUPLICATE_')),
    [issues]
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="REFERENCE DATA"
        title="Directory Quality"
        description="Audit master directories, review duplicate candidates, and resolve data integrity issues without automatic merges."
        breadcrumbs={[
          { label: 'Reference Data', to: '/directories' },
          { label: 'Quality' }
        ]}
        actions={(
          <>
            <button type="button" className="secondary" onClick={load} disabled={loading}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button type="button" className="secondary" onClick={() => runScan(false)} disabled={scanning}>
              Preview scan
            </button>
            <button type="button" className="primary" onClick={() => runScan(true)} disabled={scanning}>
              {scanning ? 'Scanning…' : 'Scan & track issues'}
            </button>
          </>
        )}
      />

      {error && <div className="error banner">{error}</div>}

      <div className="metric-grid">
        <StatCard label="Findings (live)" value={loading ? '—' : (finding?.total ?? 0)} icon={AlertTriangle} tone="warning" />
        <StatCard label="Duplicates" value={loading ? '—' : (finding?.duplicates ?? 0)} icon={GitMerge} tone="navy" />
        <StatCard label="Broken links" value={loading ? '—' : (finding?.brokenRelationships ?? 0)} icon={ShieldAlert} tone="danger" />
        <StatCard label="Tracked open" value={loading ? '—' : (summary?.openTrackedIssues ?? 0)} icon={CheckCircle2} tone="blue" />
      </div>

      {counts && (
        <section className="panel" style={{ marginBottom: 16, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Reference inventory</h3>
          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Directory</th>
                  <th>Total</th>
                  <th>Active</th>
                  <th>Inactive / other</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(counts).map(([key, c]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{c.total}</td>
                    <td>{c.active}</td>
                    <td>{c.inactive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel table-panel">
        <div className="table-toolbar" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="filter-inline">
            <span className="muted">Directory</span>
            <select value={directoryType} onChange={(e) => setDirectoryType(e.target.value)}>
              <option value="">All</option>
              {DIRECTORY_FILTERS.filter(Boolean).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="filter-inline">
            <span className="muted">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {STATUS_FILTERS.filter(Boolean).map((s) => (
                <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label className="filter-inline">
            <span className="muted">Issue type</span>
            <input
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              placeholder="e.g. DUPLICATE_EXACT"
            />
          </label>
          <span className="record-count">{loading ? 'Loading…' : `${total} issues`}</span>
        </div>

        <div className="table-scroll table-cards">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th className="col-narrow">Directory</th>
                <th className="col-narrow">Type</th>
                <th className="col-status">Severity</th>
                <th className="col-status">Status</th>
                <th className="action-head col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="table-empty">Loading issues…</td></tr>
              ) : !issues.length ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    <Search size={22} />
                    <h3>No tracked issues</h3>
                    <p>Run Scan &amp; track issues to persist findings from the live audit.</p>
                  </td>
                </tr>
              ) : issues.map((issue) => (
                <tr key={issue.id}>
                  <td data-label="Issue">
                    <CellText strong title={issue.title}>{issue.title}</CellText>
                    {issue.description ? <div className="muted" style={{ fontSize: 11 }}>{issue.description}</div> : null}
                  </td>
                  <td className="col-narrow" data-label="Directory">{issue.directoryType}</td>
                  <td className="col-narrow" data-label="Type">{String(issue.issueType || '').replaceAll('_', ' ')}</td>
                  <td className="col-status" data-label="Severity"><StatusBadge value={issue.severity} /></td>
                  <td className="col-status" data-label="Status"><StatusBadge value={issue.status} /></td>
                  <td className="col-actions" data-label="Actions">
                    <RowActions>
                      {String(issue.issueType || '').startsWith('DUPLICATE_') && issue.relatedRecordId ? (
                        <>
                          <IconButton
                            icon={GitMerge}
                            label="Preview merge"
                            tone="edit"
                            disabled={!!busy}
                            onClick={() => openMerge(issue)}
                          />
                          <IconButton
                            icon={CheckCircle2}
                            label="Mark distinct"
                            tone="activate"
                            disabled={!!busy}
                            onClick={() => markDistinct(issue)}
                          />
                        </>
                      ) : null}
                      {['OPEN', 'UNDER_REVIEW', 'REOPENED'].includes(issue.status) ? (
                        <IconButton
                          icon={CheckCircle2}
                          label="Resolve"
                          tone="view"
                          disabled={!!busy}
                          onClick={() => updateIssue(issue.id, 'RESOLVED', 'Resolved after review')}
                        />
                      ) : null}
                      {issue.status === 'RESOLVED' ? (
                        <IconButton
                          icon={RefreshCw}
                          label="Reopen"
                          tone="history"
                          disabled={!!busy}
                          onClick={() => updateIssue(issue.id, 'REOPENED')}
                        />
                      ) : null}
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {duplicateIssues.length ? (
          <p className="muted" style={{ padding: '8px 16px' }}>
            {duplicateIssues.length} duplicate-related issue(s) in the current filter. Merges require explicit confirmation and never hard-delete records.
          </p>
        ) : null}
      </section>

      {mergeModal && preview && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setMergeModal(null)}>
          <div className="record-modal" style={{ maxWidth: 720 }}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">MERGE PREVIEW</span>
                <h2>{preview.directoryType}</h2>
                <p className="muted">Survivor keeps its ID. Retired record is deactivated after relationships move.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setMergeModal(null)}>×</button>
            </div>
            <div className="form-grid" style={{ padding: '0 24px 12px' }}>
              <div className="span-2">
                <b>Survivor:</b> {preview.survivorId}
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(preview.survivor, null, 2)}</pre>
              </div>
              <div className="span-2">
                <b>Retired:</b> {preview.retiredId}
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(preview.retired, null, 2)}</pre>
              </div>
              <div className="span-2">
                <b>Relationship counts</b>
                <pre style={{ fontSize: 12 }}>{JSON.stringify(preview.relationshipCounts, null, 2)}</pre>
              </div>
              <div className="span-2">
                <b>Actions</b>
                <ul>{preview.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                {preview.blockers?.length ? (
                  <div className="error banner">Blocked: {preview.blockers.join('; ')}</div>
                ) : null}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => setMergeModal(null)}>Cancel</button>
              <button
                type="button"
                className="primary"
                disabled={busy === 'merge' || preview.blockers?.length}
                onClick={commitMerge}
              >
                {busy === 'merge' ? 'Merging…' : 'Confirm merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
