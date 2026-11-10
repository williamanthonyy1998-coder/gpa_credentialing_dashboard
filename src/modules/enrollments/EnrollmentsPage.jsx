import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, FileText, RefreshCw, Search, UserCheck, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { fmt } from '../../utils/format';
import { currentListPath, LIST_KEYS, saveListReturn } from '../../navigation/listReturn';
import { ENROLLMENT_STATUS_ORDER, labelForEnrollmentStatus } from './enrollmentLabels';

const BULK_ASSIGN_ROLES = new Set(['ADMIN', 'CREDENTIALING_MANAGER', 'ENROLLMENT_SPECIALIST']);
const FINAL_STATUSES = new Set(['APPROVED', 'DENIED', 'WITHDRAWN']);
const PAGE_SIZE = 25;

function subjectLabel(row) {
  if (row.provider) {
    return `${row.provider.firstName || ''} ${row.provider.lastName || ''}`.trim() || row.provider.npi || 'Provider';
  }
  if (row.organization) return row.organization.legalName || row.organization.dba || 'Organization';
  return '—';
}

function daysConsumed(row) {
  const start = row.submittedAt || row.createdAt;
  if (!start) return '—';
  const ms = Date.now() - new Date(start).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function parseListResponse(payload) {
  if (Array.isArray(payload)) return { data: payload, total: payload.length, page: 1, pageSize: payload.length };
  return {
    data: payload?.data ?? [],
    total: payload?.total ?? (payload?.data?.length ?? 0),
    page: payload?.page ?? 1,
    pageSize: payload?.pageSize ?? PAGE_SIZE
  };
}

function computeSummaryFromRows(rows, user) {
  const byStatus = Object.fromEntries(ENROLLMENT_STATUS_ORDER.map(s => [s, 0]));
  let overdueFollowUps = 0;
  let myCount = 0;
  const now = Date.now();
  const userEmail = user?.email || '';
  const userId = user?.id || '';

  rows.forEach(r => {
    if (byStatus[r.status] !== undefined) byStatus[r.status] += 1;
    else byStatus[r.status] = 1;
    if (r.nextFollowUpAt && new Date(r.nextFollowUpAt).getTime() < now && !FINAL_STATUSES.has(r.status)) {
      overdueFollowUps += 1;
    }
    if (
      (userEmail && r.assignedTo === userEmail)
      || (userId && (r.assignedToId === userId || r.assignedToUser?.id === userId))
    ) myCount += 1;
  });
  return { byStatus, overdueFollowUps, myCount, total: rows.length };
}

export default function EnrollmentsPage() {
  const user = useMemo(() => JSON.parse(localStorage.getItem('credentialing_user') || '{}'), []);
  const canBulkAssign = BULK_ASSIGN_ROLES.has(user.role);
  const [searchParams, setSearchParams] = useSearchParams();

  const mine = searchParams.get('mine') === '1';
  const overdue = searchParams.get('overdue') === '1';
  const view = overdue ? 'overdue' : (mine ? 'mine' : 'all');
  const q = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || '';
  const payerId = searchParams.get('payerId') || '';
  const planId = searchParams.get('planId') || '';
  const providerId = searchParams.get('providerId') || '';
  const organizationId = searchParams.get('organizationId') || '';
  const practiceId = searchParams.get('practiceId') || '';
  const facilityId = searchParams.get('facilityId') || '';
  const assignedTo = searchParams.get('assignedTo') || '';
  const submittedFrom = searchParams.get('submittedFrom') || '';
  const submittedTo = searchParams.get('submittedTo') || '';
  const followUpFrom = searchParams.get('followUpFrom') || '';
  const followUpTo = searchParams.get('followUpTo') || '';
  const page = Number(searchParams.get('page') || '1') || 1;

  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refs, setRefs] = useState({
    payers: [], plans: [], providers: [], organizations: [], practices: [], facilities: [], employees: []
  });
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [localQ, setLocalQ] = useState(q);

  const patchParams = useCallback((updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const path = currentListPath('/enrollments', window.location.search);
    saveListReturn(LIST_KEYS.enrollments, path);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (localQ !== q) patchParams({ q: localQ || null, page: '1' });
    }, 300);
    return () => clearTimeout(t);
  }, [localQ, q, patchParams]);

  async function loadRefs() {
    try {
      const [payers, plans, providers, organizations, practices, facilities, employees] = await Promise.all([
        api.get('/payers', { params: { limit: 200 } }),
        api.get('/plans', { params: { limit: 500 } }),
        api.get('/providers', { params: { limit: 200 } }),
        api.get('/organizations', { params: { limit: 200 } }),
        api.get('/practices', { params: { limit: 200 } }),
        api.get('/facilities', { params: { limit: 200 } }),
        api.get('/employees', { params: { limit: 200 } })
      ]);
      setRefs({
        payers: payers.data,
        plans: plans.data,
        providers: providers.data,
        organizations: organizations.data,
        practices: practices.data,
        facilities: facilities.data,
        employees: employees.data
      });
    } catch {
      /* filters degrade gracefully */
    }
  }

  async function loadSummary() {
    try {
      const r = await api.get('/enrollments/summary');
      setSummary(r.data);
    } catch (e) {
      if (e.response?.status !== 404) throw e;
      const fallback = await api.get('/enrollments', { params: { limit: 100 } });
      const list = Array.isArray(fallback.data) ? fallback.data : (fallback.data?.data ?? []);
      setSummary(computeSummaryFromRows(list, user));
    }
  }

  const listParams = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    status: statusFilter || undefined,
    payerId: payerId || undefined,
    payerPlanId: planId || undefined,
    providerId: providerId || undefined,
    organizationId: organizationId || undefined,
    practiceId: practiceId || undefined,
    facilityId: facilityId || undefined,
    assignedTo: assignedTo || undefined,
    submittedFrom: submittedFrom || undefined,
    submittedTo: submittedTo || undefined,
    followUpFrom: followUpFrom || undefined,
    followUpTo: followUpTo || undefined,
    ...(mine ? { mine: 1 } : {}),
    ...(overdue ? { overdue: 1 } : {})
  }), [
    page, q, statusFilter, payerId, planId, providerId, organizationId, practiceId,
    facilityId, assignedTo, submittedFrom, submittedTo, followUpFrom, followUpTo, mine, overdue
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        loadSummary().catch(() => {}),
        (async () => {
          const r = await api.get('/enrollments', { params: listParams });
          const parsed = parseListResponse(r.data);
          setRows(parsed.data);
          setTotal(parsed.total);
        })()
      ]);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load enrollments.');
    } finally {
      setLoading(false);
    }
  }, [listParams, user]);

  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { load(); }, [load]);

  const filteredPlans = useMemo(
    () => (payerId ? refs.plans.filter(p => p.payerId === payerId) : refs.plans),
    [refs.plans, payerId]
  );

  function setView(next) {
    if (next === 'mine') patchParams({ mine: '1', overdue: null, page: '1' });
    else if (next === 'overdue') patchParams({ overdue: '1', mine: null, page: '1' });
    else patchParams({ mine: null, overdue: null, page: '1' });
  }

  function toggleStatusCard(status) {
    patchParams({
      status: statusFilter === status ? null : status,
      page: '1'
    });
  }

  function toggleRow(id) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll(checked) {
    if (checked) setSelected(new Set(rows.map(r => r.id)));
    else setSelected(new Set());
  }

  async function openDetail(id) {
    setDetailLoading(true);
    setDetail({ id });
    try {
      const r = await api.get(`/enrollments/${id}`);
      setDetail(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load enrollment detail.');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveDetail(e) {
    e.preventDefault();
    if (!detail?.id) return;
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const body = { notes: fd.get('notes') || '' };
    const nextStatus = fd.get('status');
    if (nextStatus && nextStatus !== detail.status) body.status = nextStatus;
    try {
      const r = await api.patch(`/enrollments/${detail.id}`, body);
      setDetail(d => ({ ...d, ...r.data }));
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save enrollment.');
    } finally {
      setSaving(false);
    }
  }

  async function bulkAssign() {
    if (!selected.size || !bulkAssignee) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/enrollments/bulk-assign', {
        ids: [...selected],
        assignedTo: bulkAssignee
      });
      setSelected(new Set());
      setBulkAssignee('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Bulk assign failed.');
    } finally {
      setSaving(false);
    }
  }

  const statusCounts = summary?.byStatus || summary?.counts || {};
  const overdueCount = summary?.overdueFollowUps ?? summary?.overdue ?? 0;
  const myCount = summary?.myCount ?? 0;

  const allowedStatuses = detail?.allowedTransitions?.length
    ? detail.allowedTransitions
    : ENROLLMENT_STATUS_ORDER;

  return (
    <div className="page enr-page">
      <PageHeader
        eyebrow="PAYER ENROLLMENT"
        title="Credentialing Enrollments"
        description="Track payer enrollment applications, follow-ups, and assignments across your directory."
        breadcrumbs={[
          { label: 'Workspace', to: '/' },
          { label: 'Enrollments' }
        ]}
        back={{ label: 'Back', fallbackHref: null, autoLabel: true, hideIfNoTarget: true, listKey: 'enrollments' }}
        actions={(
          <button type="button" className="secondary" onClick={load}>
            <RefreshCw size={15} /> Refresh
          </button>
        )}
      />

      {error && <div className="error banner">{error}</div>}

      <div className="tab-row enr-view-tabs" role="tablist" aria-label="Enrollment views">
        <button
          type="button"
          className={`tab-btn ${view === 'all' ? 'active' : ''}`}
          onClick={() => setView('all')}
        >
          All Enrollments
        </button>
        <button
          type="button"
          className={`tab-btn ${view === 'mine' ? 'active' : ''}`}
          onClick={() => setView('mine')}
        >
          My Enrollments {myCount ? `(${myCount})` : ''}
        </button>
        <button
          type="button"
          className={`tab-btn ${view === 'overdue' ? 'active' : ''}`}
          onClick={() => setView('overdue')}
        >
          Overdue follow-ups {overdueCount ? `(${overdueCount})` : ''}
        </button>
      </div>

      <div className="metric-grid enr-summary-grid">
        {ENROLLMENT_STATUS_ORDER.map(status => (
          <button
            key={status}
            type="button"
            className={`metric-card enr-stat-card ${statusFilter === status ? 'active' : ''}`}
            onClick={() => toggleStatusCard(status)}
            title={`Filter by ${labelForEnrollmentStatus(status)}`}
          >
            <div className="metric-icon tone-navy">
              <CreditCard size={17} />
            </div>
            <span>{labelForEnrollmentStatus(status)}</span>
            <strong>{loading && !summary ? '—' : (statusCounts[status] ?? 0)}</strong>
            <small>{statusFilter === status ? 'Clear filter' : 'Click to filter'}</small>
          </button>
        ))}
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar cred-toolbar enr-filter-toolbar">
          <div className="cred-filters enr-filters">
            <div className="search-box">
              <Search size={16} />
              <input
                placeholder="Search application or reference"
                value={localQ}
                onChange={e => setLocalQ(e.target.value)}
                aria-label="Search enrollments"
              />
            </div>
            <select value={payerId} onChange={e => patchParams({ payerId: e.target.value || null, planId: null, page: '1' })}>
              <option value="">All payers</option>
              {refs.payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={planId} onChange={e => patchParams({ planId: e.target.value || null, page: '1' })}>
              <option value="">All plans</option>
              {filteredPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={providerId} onChange={e => patchParams({ providerId: e.target.value || null, page: '1' })}>
              <option value="">All providers</option>
              {refs.providers.map(p => (
                <option key={p.id} value={p.id}>{`${p.firstName || ''} ${p.lastName || ''}`.trim()}</option>
              ))}
            </select>
            <select value={organizationId} onChange={e => patchParams({ organizationId: e.target.value || null, page: '1' })}>
              <option value="">All organizations</option>
              {refs.organizations.map(o => <option key={o.id} value={o.id}>{o.legalName}</option>)}
            </select>
            <select value={practiceId} onChange={e => patchParams({ practiceId: e.target.value || null, page: '1' })}>
              <option value="">All practices</option>
              {refs.practices.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={facilityId} onChange={e => patchParams({ facilityId: e.target.value || null, page: '1' })}>
              <option value="">All facilities</option>
              {refs.facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={assignedTo} onChange={e => patchParams({ assignedTo: e.target.value || null, page: '1' })}>
              <option value="">Any assignee</option>
              {refs.employees.map(emp => (
                <option key={emp.id} value={emp.email || emp.id}>{emp.name}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={e => patchParams({ status: e.target.value || null, page: '1' })}>
              <option value="">Any status</option>
              {ENROLLMENT_STATUS_ORDER.map(s => (
                <option key={s} value={s}>{labelForEnrollmentStatus(s)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="enr-date-filters cred-filters">
          <label>
            Submitted from
            <input type="date" value={submittedFrom} onChange={e => patchParams({ submittedFrom: e.target.value || null, page: '1' })} />
          </label>
          <label>
            Submitted to
            <input type="date" value={submittedTo} onChange={e => patchParams({ submittedTo: e.target.value || null, page: '1' })} />
          </label>
          <label>
            Follow-up from
            <input type="date" value={followUpFrom} onChange={e => patchParams({ followUpFrom: e.target.value || null, page: '1' })} />
          </label>
          <label>
            Follow-up to
            <input type="date" value={followUpTo} onChange={e => patchParams({ followUpTo: e.target.value || null, page: '1' })} />
          </label>
        </div>

        {canBulkAssign && selected.size > 0 && (
          <div className="enr-bulk-bar">
            <UserCheck size={16} />
            <span>{selected.size} selected</span>
            <select value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)}>
              <option value="">Assign to…</option>
              {refs.employees.map(emp => (
                <option key={emp.id} value={emp.email || emp.id}>{emp.name}</option>
              ))}
            </select>
            <button type="button" className="primary" disabled={!bulkAssignee || saving} onClick={bulkAssign}>
              Bulk assign
            </button>
            <button type="button" className="small-action" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {canBulkAssign && (
                  <th className="enr-check-col">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={e => toggleAll(e.target.checked)}
                    />
                  </th>
                )}
                <th>Application #</th>
                <th>Subject</th>
                <th>Payer / Plan</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th>Submitted</th>
                <th>Next follow-up</th>
                <th>Days</th>
                <th className="action-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canBulkAssign ? 10 : 9} className="table-empty">Loading enrollments…</td></tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={canBulkAssign ? 10 : 9} className="table-empty">
                    <div className="empty-inline">
                      <FileText size={25} />
                      <b>No enrollments found</b>
                      <span>Adjust filters or open the dashboard to add applications.</span>
                    </div>
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.id}>
                  {canBulkAssign && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.applicationNo}`}
                      />
                    </td>
                  )}
                  <td><span className="cell-strong">{row.applicationNo || '—'}</span></td>
                  <td>{subjectLabel(row)}</td>
                  <td>
                    <span className="cell-strong">{row.payerPlan?.payer?.name || nestedPayer(row)}</span>
                    <div className="muted" style={{ fontSize: 9, marginTop: 3 }}>{row.payerPlan?.name || '—'}</div>
                  </td>
                  <td><StatusBadge value={row.status} /></td>
                  <td>{row.assignedToUser?.name || row.assignedTo || '—'}</td>
                  <td>{fmt(row.submittedAt)}</td>
                  <td>{fmt(row.nextFollowUpAt)}</td>
                  <td>{daysConsumed(row)}</td>
                  <td>
                    <button type="button" className="small-action" onClick={() => openDetail(row.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="enr-pager">
          <span className="record-count">{total} total · page {page}</span>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={p => patchParams({ page: String(p) })} />
        </div>
      </section>

      {detail && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDetail(null)}>
          <form className="record-modal enr-detail-modal" onSubmit={saveDetail}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">ENROLLMENT DETAIL</span>
                <h2>{detail.applicationNo || detailLoading ? 'Loading…' : 'Enrollment'}</h2>
                {detail.status && <StatusBadge value={detail.status} />}
              </div>
              <button type="button" className="icon-button" onClick={() => setDetail(null)}><X size={20} /></button>
            </div>
            {detailLoading ? (
              <p className="muted" style={{ padding: '20px 24px' }}>Loading enrollment…</p>
            ) : (
              <>
                <div className="enr-detail-grid">
                  <div>
                    <b>Subject</b>
                    <span>{subjectLabel(detail)}</span>
                  </div>
                  <div>
                    <b>Payer / Plan</b>
                    <span>{detail.payerPlan?.payer?.name} · {detail.payerPlan?.name || '—'}</span>
                  </div>
                  <div>
                    <b>Submitted</b>
                    <span>{fmt(detail.submittedAt)}</span>
                  </div>
                  <div>
                    <b>Next follow-up</b>
                    <span>{fmt(detail.nextFollowUpAt)}</span>
                  </div>
                </div>
                <div className="form-grid" style={{ padding: '0 24px 12px' }}>
                  <label className="span-2">
                    Notes
                    <textarea name="notes" rows="4" defaultValue={detail.notes || ''} />
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue={detail.status}>
                      {[detail.status, ...allowedStatuses.filter(s => s !== detail.status)].filter(Boolean).map(s => (
                        <option key={s} value={s}>{labelForEnrollmentStatus(s)}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {detail.statusHistory?.length > 0 && (
                  <div className="enr-history">
                    <b>Status history</b>
                    <ul>
                      {detail.statusHistory.map(h => (
                        <li key={h.id}>
                          <StatusBadge value={h.toStatus} />
                          <span className="muted">{new Date(h.createdAt).toLocaleString()}</span>
                          {h.fromStatus && <span className="muted">from {labelForEnrollmentStatus(h.fromStatus)}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="modal-footer">
                  <span className="muted">Status changes respect allowed transitions when provided by the API.</span>
                  <button type="button" className="secondary" onClick={() => setDetail(null)}>Close</button>
                  <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

function nestedPayer(row) {
  return row.payerPlan?.payer?.name || '—';
}

function Pager({ page, total, pageSize, onPage }) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
  return (
    <div className="row-actions">
      <button type="button" className="small-action" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <button type="button" className="small-action" disabled={page >= maxPage} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}
