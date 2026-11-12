import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CreditCard, FileText, Flag, MessageSquare, Pencil, Plus, RefreshCw, Search, UserCheck, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import IconButton, { RowActions } from '../../components/common/IconButton';
import CellText from '../../components/common/CellText';
import { fmt } from '../../utils/format';
import { currentListPath, LIST_KEYS, saveListReturn } from '../../navigation/listReturn';
import { ENROLLMENT_STATUS_ORDER, enrollmentStatusTone, labelForEnrollmentStatus } from './enrollmentLabels';
import EnrollmentActivityDrawer from './EnrollmentActivityDrawer';
import EnrollmentPacketPanel from './EnrollmentPacketPanel';
import EnrollmentSubmissionPanel from './EnrollmentSubmissionPanel';
import IntegrationPanel from '../integrations/IntegrationPanel';
import EnrollmentRevalidationPanel from './EnrollmentRevalidationPanel';

const BULK_ASSIGN_ROLES = new Set(['ADMIN', 'CREDENTIALING_MANAGER', 'ENROLLMENT_SPECIALIST']);
const CREATE_ROLES = new Set([
  'ADMIN',
  'CREDENTIALING_MANAGER',
  'CREDENTIALING_SPECIALIST',
  'ENROLLMENT_SPECIALIST',
  'APPROVER'
]);
const EDIT_ROLES = CREATE_ROLES;
const PACKET_WAIVE_ROLES = new Set(['ADMIN', 'CREDENTIALING_MANAGER', 'APPROVER']);
const PACKET_OVERRIDE_ROLES = new Set(['ADMIN', 'CREDENTIALING_MANAGER']);
const FINAL_STATUSES = new Set(['DENIED', 'WITHDRAWN', 'TERMINATED', 'CLOSED']);
const PAGE_SIZE = 25;

function dateInputValue(value) {
  if (!value) return '';
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : '';
}

function assigneeLabel(row) {
  return row?.assigneeName || row?.assignedToUser?.name || row?.assignedTo || '—';
}

const EMPTY_CREATE = {
  payerId: '',
  payerPlanId: '',
  practiceId: '',
  facilityId: '',
  providerId: '',
  subject: '',
  assignedTo: '',
  status: 'NOT_STARTED',
  submittedAt: '',
  nextFollowUpAt: '',
  notes: '',
  payerSearch: '',
  planSearch: ''
};

function providerName(row) {
  if (row?.providerName) return row.providerName;
  if (row?.provider) {
    const name = `${row.provider.firstName || ''} ${row.provider.lastName || ''}`.trim();
    if (name) return name;
    if (row.provider.npi) return row.provider.npi;
  }
  if (row?.facility?.name) return row.facility.name;
  if (row?.facilityName) return row.facilityName;
  if (row?.practice?.name) return row.practice.name;
  return '—';
}

function facilityName(row) {
  return row?.facilityName || row?.facility?.name || row?.practice?.name || '—';
}

function payerName(row) {
  return row?.payerName || row?.payerPlan?.payer?.name || '—';
}

function subjectLabel(row) {
  if (row?.subjectDisplay) return row.subjectDisplay;
  if (row?.subject && String(row.subject).trim()) return String(row.subject).trim();
  if (row?.provider) {
    return `${row.provider.firstName || ''} ${row.provider.lastName || ''}`.trim() || row.provider.npi || 'Provider';
  }
  if (row?.facility?.name) return row.facility.name;
  if (row?.organization) return row.organization.legalName || row.organization.dba || 'Organization';
  return '—';
}

function daysConsumed(row) {
  if (row?.daysConsumed !== undefined && row?.daysConsumed !== null) return row.daysConsumed;
  const start = row?.submittedAt || row?.createdAt;
  if (!start) return '—';
  const ms = Date.now() - new Date(start).getTime();
  if (Number.isNaN(ms)) return '—';
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

function personLabel(p) {
  if (!p) return '—';
  return `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.npi || p.id;
}

export default function EnrollmentsPage({ organizationId: scopedOrganizationId } = {}) {
  const user = useMemo(() => JSON.parse(localStorage.getItem('credentialing_user') || '{}'), []);
  const canBulkAssign = BULK_ASSIGN_ROLES.has(user.role);
  const canCreate = CREATE_ROLES.has(user.role);
  const canEdit = EDIT_ROLES.has(user.role);
  const [searchParams, setSearchParams] = useSearchParams();

  const mine = searchParams.get('mine') === '1';
  const overdue = searchParams.get('overdue') === '1';
  const view = overdue ? 'overdue' : (mine ? 'mine' : 'all');
  const q = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || '';
  const payerId = searchParams.get('payerId') || '';
  const planId = searchParams.get('planId') || '';
  const providerId = searchParams.get('providerId') || '';
  const organizationId = scopedOrganizationId || searchParams.get('organizationId') || '';
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
  const [editForm, setEditForm] = useState(null);
  const [editProviders, setEditProviders] = useState([]);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [highlightingId, setHighlightingId] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [localQ, setLocalQ] = useState(q);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createProviders, setCreateProviders] = useState([]);
  const [createError, setCreateError] = useState('');
  const [activityEnrollmentId, setActivityEnrollmentId] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(() => Boolean(
    planId || practiceId || organizationId || assignedTo || submittedFrom || submittedTo || followUpFrom || followUpTo
  ));

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

  useEffect(() => {
    const editId = searchParams.get('edit');
    const activityId = searchParams.get('activity');
    if (activityId) {
      setActivityEnrollmentId(activityId);
      patchParams({ activity: null });
    } else if (editId) {
      openDetail(editId);
      patchParams({ edit: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from deep-link
  }, []);

  function openActivity(id) {
    if (!id) return;
    setDetail(null);
    setEditForm(null);
    setCreateOpen(false);
    setActivityEnrollmentId(id);
  }

  function closeActivity() {
    setActivityEnrollmentId(null);
    load();
  }

  function onActivityEnrollmentUpdated(updated) {
    if (!updated?.id) return;
    setRows(prev => prev.map(r => (r.id === updated.id ? { ...r, ...updated, unreadActivityCount: 0 } : r)));
    if (detail?.id === updated.id) {
      setDetail(d => ({ ...d, ...updated }));
      setEditForm(detailToEditForm({ ...detail, ...updated }));
    }
  }

  const filteredPlans = useMemo(
    () => (payerId ? refs.plans.filter(p => p.payerId === payerId) : refs.plans),
    [refs.plans, payerId]
  );

  const filterFacilities = useMemo(
    () => (practiceId ? refs.facilities.filter(f => f.practiceId === practiceId) : refs.facilities),
    [refs.facilities, practiceId]
  );

  const filterProviders = useMemo(() => {
    if (!facilityId) return refs.providers;
    return refs.providers.filter(p =>
      (p.facilities || []).some(f => (f.facilityId || f.id || f.facility?.id) === facilityId)
      || p.facilityId === facilityId
    );
  }, [refs.providers, facilityId]);

  const createPlanOptions = useMemo(() => {
    const plans = createForm.payerId
      ? refs.plans.filter(p => p.payerId === createForm.payerId && (!p.status || p.status === 'ACTIVE'))
      : [];
    const qPlan = createForm.planSearch.trim().toLowerCase();
    if (!qPlan) return plans;
    return plans.filter(p => String(p.name || '').toLowerCase().includes(qPlan));
  }, [refs.plans, createForm.payerId, createForm.planSearch]);

  const createPayerOptions = useMemo(() => {
    const active = refs.payers.filter(p => !p.status || p.status === 'ACTIVE');
    const qPayer = createForm.payerSearch.trim().toLowerCase();
    if (!qPayer) return active;
    return active.filter(p => String(p.name || '').toLowerCase().includes(qPayer));
  }, [refs.payers, createForm.payerSearch]);

  const createFacilityOptions = useMemo(() => {
    let list = refs.facilities;
    if (organizationId) {
      list = list.filter(f => f.organizationId === organizationId
        || refs.practices.some(p => p.id === f.practiceId && p.organizationId === organizationId));
    }
    if (createForm.practiceId) list = list.filter(f => f.practiceId === createForm.practiceId);
    return list;
  }, [refs.facilities, refs.practices, createForm.practiceId, organizationId]);

  useEffect(() => {
    let cancelled = false;
    async function loadFacilityProviders() {
      if (!createForm.facilityId) {
        setCreateProviders([]);
        return;
      }
      try {
        const r = await api.get(`/directory/facilities/${createForm.facilityId}/providers`);
        if (cancelled) return;
        const list = Array.isArray(r.data) ? r.data : [];
        setCreateProviders(list.map(row => row.provider || row).filter(Boolean));
      } catch {
        if (!cancelled) setCreateProviders([]);
      }
    }
    loadFacilityProviders();
    return () => { cancelled = true; };
  }, [createForm.facilityId]);

  useEffect(() => {
    let cancelled = false;
    async function loadEditFacilityProviders() {
      if (!editForm?.facilityId) {
        setEditProviders([]);
        return;
      }
      try {
        const r = await api.get(`/directory/facilities/${editForm.facilityId}/providers`);
        if (cancelled) return;
        const list = Array.isArray(r.data) ? r.data : [];
        setEditProviders(list.map(row => row.provider || row).filter(Boolean));
      } catch {
        if (!cancelled) setEditProviders([]);
      }
    }
    loadEditFacilityProviders();
    return () => { cancelled = true; };
  }, [editForm?.facilityId]);

  const editPlanOptions = useMemo(() => {
    if (!editForm?.payerId) return [];
    return refs.plans.filter(p => {
      if (p.payerId !== editForm.payerId) return false;
      if (!p.status || p.status === 'ACTIVE') return true;
      return p.id === editForm.payerPlanId;
    });
  }, [refs.plans, editForm?.payerId, editForm?.payerPlanId]);

  const editFacilityOptions = useMemo(
    () => (editForm?.practiceId
      ? refs.facilities.filter(f => f.practiceId === editForm.practiceId)
      : refs.facilities),
    [refs.facilities, editForm?.practiceId]
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

  function openCreate() {
    setCreateError('');
    setCreateForm({
      ...EMPTY_CREATE,
      assignedTo: user.email || '',
      organizationId: organizationId || ''
    });
    setCreateProviders([]);
    setCreateOpen(true);
  }

  function updateCreate(patch) {
    setCreateForm(prev => ({ ...prev, ...patch }));
  }

  async function submitCreate(e) {
    e.preventDefault();
    setCreateError('');
    if (!createForm.payerId) {
      setCreateError('Payer is required.');
      return;
    }
    if (!createForm.payerPlanId) {
      setCreateError('Payer plan is required.');
      return;
    }
    if (!createForm.facilityId) {
      setCreateError('Facility is required.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        payerId: createForm.payerId,
        payerPlanId: createForm.payerPlanId,
        organizationId: createForm.organizationId || organizationId || null,
        practiceId: createForm.practiceId || null,
        facilityId: createForm.facilityId,
        providerId: createForm.providerId || null,
        subject: createForm.subject || null,
        assignedTo: createForm.assignedTo || null,
        status: createForm.status || 'NOT_STARTED',
        submittedAt: createForm.submittedAt || null,
        nextFollowUpAt: createForm.nextFollowUpAt || null,
        notes: createForm.notes || null
      };
      await api.post('/enrollments', body);
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      await load();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Could not create enrollment.');
    } finally {
      setSaving(false);
    }
  }

  function detailToEditForm(row) {
    return {
      payerId: row?.payerPlan?.payerId || row?.payerPlan?.payer?.id || '',
      payerPlanId: row?.payerPlanId || row?.payerPlan?.id || '',
      practiceId: row?.practiceId || row?.practice?.id || '',
      facilityId: row?.facilityId || row?.facility?.id || '',
      providerId: row?.providerId || row?.provider?.id || '',
      subject: row?.subject || '',
      assignedTo: row?.assignedTo || '',
      status: row?.status || 'NOT_STARTED',
      submittedAt: dateInputValue(row?.submittedAt),
      lastFollowUpAt: dateInputValue(row?.lastFollowUpAt),
      nextFollowUpAt: dateInputValue(row?.nextFollowUpAt),
      notes: row?.notes || ''
    };
  }

  async function openDetail(id) {
    setActivityEnrollmentId(null);
    setCreateOpen(false);
    setDetailLoading(true);
    setEditError('');
    setDetail({ id });
    setEditForm(null);
    try {
      const r = await api.get(`/enrollments/${id}`);
      setDetail(r.data);
      setEditForm(detailToEditForm(r.data));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load enrollment detail.');
      setDetail(null);
      setEditForm(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function updateEdit(patch) {
    setEditForm(prev => (prev ? { ...prev, ...patch } : prev));
  }

  async function saveDetail(e) {
    e.preventDefault();
    if (!detail?.id || !editForm) return;
    setSaving(true);
    setEditError('');
    setError('');
    if (!editForm.payerPlanId) {
      setEditError('Payer plan is required.');
      setSaving(false);
      return;
    }
    if (!editForm.facilityId) {
      setEditError('Facility is required.');
      setSaving(false);
      return;
    }
    const body = {
      notes: editForm.notes || '',
      subject: editForm.subject || null,
      assignedTo: editForm.assignedTo || null,
      lastFollowUpAt: editForm.lastFollowUpAt || null,
      nextFollowUpAt: editForm.nextFollowUpAt || null,
      payerId: editForm.payerId || null,
      payerPlanId: editForm.payerPlanId,
      practiceId: editForm.practiceId || null,
      facilityId: editForm.facilityId,
      providerId: editForm.providerId || null
    };
    try {
      let latest = detail;
      const r = await api.patch(`/enrollments/${detail.id}`, body);
      latest = r.data;
      // Lifecycle transitions use dedicated endpoints — not unrestricted status PATCH.
      if (editForm.status && editForm.status !== detail.status) {
        const map = {
          PREPARING: 'prepare',
          READY_TO_SUBMIT: 'ready',
          SUBMITTED: 'submit',
          ACKNOWLEDGED: 'acknowledge',
          PAYER_REVIEW: 'payer-review',
          ADDITIONAL_INFORMATION_NEEDED: 'request-information',
          APPROVED: 'approve',
          EFFECTIVE: 'effective',
          DENIED: 'reject',
          TERMINATED: 'terminate'
        };
        const action = map[editForm.status];
        if (!action) throw new Error(`Unsupported transition to ${editForm.status}`);
        const payload = {};
        if (action === 'submit') {
          payload.submittedAt = editForm.submittedAt || new Date().toISOString();
          payload.notes = 'Submission recorded from enrollment detail';
        }
        if (action === 'request-information') {
          payload.reason = editForm.notes || 'Additional information requested';
        }
        if (action === 'reject' || action === 'terminate') {
          payload.reason = editForm.notes || `${editForm.status} recorded`;
        }
        if (action === 'effective') {
          payload.effectiveAt = editForm.submittedAt || new Date().toISOString().slice(0, 10);
        }
        if (action === 'approve') {
          payload.notes = editForm.notes || 'Approval recorded';
        }
        const tr = await api.post(`/enrollments/${detail.id}/${action}`, payload);
        latest = tr.data;
      }
      setDetail(d => ({ ...d, ...latest }));
      setEditForm(detailToEditForm(latest));
      await load();
    } catch (err) {
      setEditError(err.response?.data?.error || err.message || 'Could not save enrollment.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleHighlight(row) {
    if (!canEdit || !row?.id || highlightingId) return;
    const next = !row.highlighted;
    setHighlightingId(row.id);
    setError('');
    setRows(prev => prev.map(r => (r.id === row.id ? { ...r, highlighted: next } : r)));
    try {
      const r = await api.patch(`/enrollments/${row.id}`, { highlighted: next });
      setRows(prev => prev.map(item => (item.id === row.id ? { ...item, ...r.data, highlighted: Boolean(r.data.highlighted) } : item)));
      if (detail?.id === row.id) {
        setDetail(d => ({ ...d, ...r.data, highlighted: Boolean(r.data.highlighted) }));
      }
    } catch (err) {
      setRows(prev => prev.map(item => (item.id === row.id ? { ...item, highlighted: row.highlighted } : item)));
      setError(err.response?.data?.error || 'Could not update highlight.');
    } finally {
      setHighlightingId('');
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

  const colSpan = canBulkAssign ? 9 : 8;
  const hasAdvancedFilters = Boolean(
    planId || practiceId || organizationId || assignedTo || submittedFrom || submittedTo || followUpFrom || followUpTo
  );

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
          <>
            {canCreate && (
              <button type="button" className="primary" onClick={openCreate}>
                <Plus size={15} /> Add Enrollment
              </button>
            )}
            <button type="button" className="secondary" onClick={load}>
              <RefreshCw size={15} /> Refresh
            </button>
          </>
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
        {ENROLLMENT_STATUS_ORDER.map(status => {
          const tone = enrollmentStatusTone[status] || 'neutral';
          return (
            <button
              key={status}
              type="button"
              className={`metric-card enr-stat-card tone-${tone} ${statusFilter === status ? 'active' : ''}`}
              onClick={() => toggleStatusCard(status)}
              title={`Filter by ${labelForEnrollmentStatus(status)}`}
            >
              <div className={`metric-icon tone-${tone === 'success' ? 'green' : tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'info' ? 'blue' : 'navy'}`}>
                <CreditCard size={17} />
              </div>
              <span>{labelForEnrollmentStatus(status)}</span>
              <strong>{loading && !summary ? '—' : (statusCounts[status] ?? 0)}</strong>
              <small>{statusFilter === status ? 'Clear filter' : 'Click to filter'}</small>
            </button>
          );
        })}
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar cred-toolbar enr-filter-toolbar">
          <div className="cred-filters enr-filters">
            <div className="search-box">
              <Search size={16} />
              <input
                placeholder="Search subject, payer, facility, or reference"
                value={localQ}
                onChange={e => setLocalQ(e.target.value)}
                aria-label="Search enrollments"
              />
            </div>
            <select value={payerId} onChange={e => patchParams({ payerId: e.target.value || null, planId: null, page: '1' })} aria-label="Payer">
              <option value="">All payers</option>
              {refs.payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={facilityId}
              onChange={e => patchParams({ facilityId: e.target.value || null, providerId: null, page: '1' })}
              aria-label="Facility"
            >
              <option value="">All facilities</option>
              {filterFacilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={providerId} onChange={e => patchParams({ providerId: e.target.value || null, page: '1' })} aria-label="Provider">
              <option value="">All providers</option>
              {(facilityId ? filterProviders : refs.providers).map(p => (
                <option key={p.id} value={p.id}>{personLabel(p)}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={e => patchParams({ status: e.target.value || null, page: '1' })} aria-label="Status">
              <option value="">Any status</option>
              {ENROLLMENT_STATUS_ORDER.map(s => (
                <option key={s} value={s}>{labelForEnrollmentStatus(s)}</option>
              ))}
            </select>
            <button
              type="button"
              className="enr-advanced-toggle"
              onClick={() => setShowAdvancedFilters(v => !v)}
              aria-expanded={showAdvancedFilters || hasAdvancedFilters}
            >
              {(showAdvancedFilters || hasAdvancedFilters) ? 'Hide advanced filters' : 'Advanced filters'}
            </button>
            {(showAdvancedFilters || hasAdvancedFilters) && (
              <div className="enr-filters-advanced">
                <select value={planId} onChange={e => patchParams({ planId: e.target.value || null, page: '1' })} aria-label="Plan">
                  <option value="">All plans</option>
                  {filteredPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                  value={practiceId}
                  onChange={e => patchParams({
                    practiceId: e.target.value || null,
                    facilityId: null,
                    providerId: null,
                    page: '1'
                  })}
                  aria-label="Practice"
                >
                  <option value="">All practices</option>
                  {refs.practices.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                  value={organizationId}
                  disabled={Boolean(scopedOrganizationId)}
                  onChange={e => patchParams({ organizationId: e.target.value || null, page: '1' })}
                  aria-label="Organization"
                >
                  <option value="">All organizations</option>
                  {refs.organizations.map(o => <option key={o.id} value={o.id}>{o.legalName}</option>)}
                </select>
                <select value={assignedTo} onChange={e => patchParams({ assignedTo: e.target.value || null, page: '1' })} aria-label="Assignee">
                  <option value="">Any assignee</option>
                  {refs.employees.map(emp => (
                    <option key={emp.id} value={emp.email || emp.id}>{emp.name}</option>
                  ))}
                </select>
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
            )}
          </div>
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

        <div className="table-scroll table-cards">
          <table className="enr-table">
            <thead>
              <tr>
                {canBulkAssign && (
                  <th className="enr-check-col col-check">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={e => toggleAll(e.target.checked)}
                    />
                  </th>
                )}
                <th className="col-payer">Payer</th>
                <th className="col-facility">Facility</th>
                <th className="col-provider">Provider</th>
                <th className="col-status">Status</th>
                <th className="col-followups">Follow-ups</th>
                <th className="col-days">Days</th>
                <th className="col-assignee">Assignee</th>
                <th className="action-head col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan} className="table-empty">Loading enrollments…</td></tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={colSpan} className="table-empty">
                    <div className="empty-inline">
                      <FileText size={25} />
                      <b>No enrollments found</b>
                      <span>Adjust filters or add a new enrollment application.</span>
                    </div>
                  </td>
                </tr>
              ) : rows.map(row => {
                const payer = payerName(row);
                const facility = facilityName(row);
                const provider = providerName(row);
                const assignee = assigneeLabel(row);
                const days = daysConsumed(row);
                const lastFu = fmt(row.lastFollowUpAt);
                const nextFu = fmt(row.nextFollowUpAt);
                return (
                <tr
                  key={row.id}
                  className={`enr-row-clickable ${row.highlighted ? 'enr-row-highlighted' : ''}`}
                  onClick={e => {
                    if (e.target.closest('input, button, a, label')) return;
                    openActivity(row.id);
                  }}
                >
                  {canBulkAssign && (
                    <td className="col-check" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.applicationNo || row.id}`}
                      />
                    </td>
                  )}
                  <td className="col-payer" data-label="Payer">
                    <button type="button" className="enr-cell-link" onClick={() => openActivity(row.id)}>
                      <CellText strong title={payer}>{payer}</CellText>
                      {row.unreadActivityCount > 0 && (
                        <span className="enr-unread-dot" title={`${row.unreadActivityCount} unread`}>{row.unreadActivityCount}</span>
                      )}
                    </button>
                  </td>
                  <td className="col-facility" data-label="Facility">
                    <button type="button" className="enr-cell-link" onClick={() => openActivity(row.id)}>
                      <CellText title={facility}>{facility}</CellText>
                    </button>
                  </td>
                  <td className="col-provider" data-label="Provider">
                    <button type="button" className="enr-cell-link" onClick={() => openActivity(row.id)}>
                      <CellText title={provider}>{provider}</CellText>
                    </button>
                  </td>
                  <td className="col-status" data-label="Status">
                    <button type="button" className="enr-cell-link" onClick={() => openActivity(row.id)} aria-label={`Status ${labelForEnrollmentStatus(row.status)}`}>
                      <StatusBadge value={row.status} />
                    </button>
                  </td>
                  <td className="col-followups" data-label="Follow-ups">
                    <button
                      type="button"
                      className="enr-cell-link enr-followups"
                      onClick={() => openActivity(row.id)}
                      title={`Last ${lastFu} · Next ${nextFu}`}
                    >
                      <span className="enr-fu-line"><span className="enr-fu-k">Last</span><span className="enr-fu-v">{lastFu}</span></span>
                      <span className="enr-fu-line"><span className="enr-fu-k">Next</span><span className="enr-fu-v">{nextFu}</span></span>
                    </button>
                  </td>
                  <td className="col-days" data-label="Days">
                    <button type="button" className="enr-cell-link" onClick={() => openActivity(row.id)}>
                      <CellText title={String(days)}>{days}</CellText>
                    </button>
                  </td>
                  <td className="col-assignee" data-label="Assignee">
                    <button type="button" className="enr-cell-link" onClick={() => openActivity(row.id)}>
                      <CellText title={assignee}>{assignee}</CellText>
                    </button>
                  </td>
                  <td className="col-actions" data-label="Actions" onClick={e => e.stopPropagation()}>
                    <RowActions className="enr-row-actions">
                      <IconButton
                        icon={MessageSquare}
                        label={row.unreadActivityCount > 0 ? `Open activity (${row.unreadActivityCount} unread)` : 'Open activity'}
                        tone="history"
                        badge={row.unreadActivityCount}
                        onClick={() => openActivity(row.id)}
                      />
                      {canEdit && (
                        <IconButton
                          icon={row.highlighted ? Flag : AlertTriangle}
                          label={row.highlighted ? 'Remove highlight' : 'Highlight for attention'}
                          tone="alert"
                          active={!!row.highlighted}
                          disabled={highlightingId === row.id}
                          onClick={() => toggleHighlight(row)}
                        />
                      )}
                      <IconButton
                        icon={Pencil}
                        label="Edit enrollment"
                        tone="edit"
                        onClick={() => openDetail(row.id)}
                      />
                    </RowActions>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="enr-pager">
          <span className="record-count">{total} total · page {page}</span>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={p => patchParams({ page: String(p) })} />
        </div>
      </section>

      {createOpen && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setCreateOpen(false)}>
          <form className="record-modal enr-create-modal" onSubmit={submitCreate}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">NEW ENROLLMENT</span>
                <h2>Add Enrollment</h2>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  Application number is generated automatically after save.
                </p>
              </div>
              <button type="button" className="icon-button" onClick={() => setCreateOpen(false)}><X size={20} /></button>
            </div>
            {createError && <div className="error banner" style={{ margin: '0 24px 12px' }}>{createError}</div>}
            <div className="form-grid" style={{ padding: '0 24px 12px' }}>
              <label>
                Search payers
                <input
                  value={createForm.payerSearch}
                  onChange={e => updateCreate({ payerSearch: e.target.value })}
                  placeholder="Type to filter payers"
                />
              </label>
              <label>
                Payer <span className="req">*</span>
                <select
                  required
                  value={createForm.payerId}
                  onChange={e => updateCreate({
                    payerId: e.target.value,
                    payerPlanId: '',
                    planSearch: ''
                  })}
                >
                  <option value="">Select payer</option>
                  {createPayerOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Search plans
                <input
                  value={createForm.planSearch}
                  onChange={e => updateCreate({ planSearch: e.target.value })}
                  placeholder="Type to filter plans"
                  disabled={!createForm.payerId}
                />
              </label>
              <label>
                Payer Plan <span className="req">*</span>
                <select
                  required
                  value={createForm.payerPlanId}
                  onChange={e => updateCreate({ payerPlanId: e.target.value })}
                  disabled={!createForm.payerId}
                >
                  <option value="">Select plan</option>
                  {createPlanOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.planType ? ` (${p.planType})` : ''}</option>
                  ))}
                </select>
              </label>
              <label>
                Practice
                <select
                  value={createForm.practiceId}
                  onChange={e => updateCreate({
                    practiceId: e.target.value,
                    facilityId: '',
                    providerId: ''
                  })}
                >
                  <option value="">Select practice</option>
                  {refs.practices
                    .filter(p => !organizationId || p.organizationId === organizationId)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </label>
              <label>
                Facility <span className="req">*</span>
                <select
                  required
                  value={createForm.facilityId}
                  onChange={e => updateCreate({ facilityId: e.target.value, providerId: '' })}
                >
                  <option value="">Select facility</option>
                  {createFacilityOptions.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Provider <span className="muted">(optional)</span>
                <select
                  value={createForm.providerId}
                  onChange={e => updateCreate({ providerId: e.target.value })}
                  disabled={!createForm.facilityId}
                >
                  <option value="">Facility only (no provider)</option>
                  {createProviders.map(p => (
                    <option key={p.id} value={p.id}>{personLabel(p)}</option>
                  ))}
                </select>
              </label>
              <label>
                Subject / Application Name
                <input
                  value={createForm.subject}
                  onChange={e => updateCreate({ subject: e.target.value })}
                  placeholder="e.g. BCBS group enrollment"
                />
              </label>
              <label>
                Assigned To
                <select
                  value={createForm.assignedTo}
                  onChange={e => updateCreate({ assignedTo: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {refs.employees.map(emp => (
                    <option key={emp.id} value={emp.email || emp.id}>{emp.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={createForm.status}
                  onChange={e => updateCreate({ status: e.target.value })}
                >
                  {ENROLLMENT_STATUS_ORDER.map(s => (
                    <option key={s} value={s}>{labelForEnrollmentStatus(s)}</option>
                  ))}
                </select>
              </label>
              <label>
                Submitted Date
                <input
                  type="date"
                  value={createForm.submittedAt}
                  onChange={e => updateCreate({ submittedAt: e.target.value })}
                />
              </label>
              <label>
                Next Follow-up Date
                <input
                  type="date"
                  value={createForm.nextFollowUpAt}
                  onChange={e => updateCreate({ nextFollowUpAt: e.target.value })}
                />
              </label>
              <label className="span-2">
                Notes
                <textarea
                  rows="3"
                  value={createForm.notes}
                  onChange={e => updateCreate({ notes: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-footer">
              <span className="muted">
                {createForm.providerId
                  ? 'Enrollment will be linked to the selected provider and facility.'
                  : 'Without a provider, the facility remains the responsible entity.'}
              </span>
              <button type="button" className="secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Create enrollment'}</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDetail(null)}>
          <form className="record-modal enr-detail-modal" onSubmit={saveDetail}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">EDIT ENROLLMENT</span>
                <h2>{detailLoading ? 'Loading…' : (detail.applicationNo || 'Enrollment')}</h2>
                <div className="enr-detail-badges">
                  {detail.status && <StatusBadge value={detail.status} />}
                  {detail.highlighted && <span className="enr-highlight-chip">Highlighted</span>}
                </div>
              </div>
              <button type="button" className="icon-button" onClick={() => setDetail(null)}><X size={20} /></button>
            </div>
            {detailLoading || !editForm ? (
              <p className="muted" style={{ padding: '20px 24px' }}>Loading enrollment…</p>
            ) : (
              <>
                {editError && <div className="error banner" style={{ margin: '0 24px 12px' }}>{editError}</div>}
                <div className="enr-detail-grid">
                  <div>
                    <b>Application #</b>
                    <span>{detail.applicationNo || '—'}</span>
                  </div>
                  <div>
                    <b>Subject</b>
                    <span>{subjectLabel(detail)}</span>
                  </div>
                  <div>
                    <b>Days Consumed</b>
                    <span>{daysConsumed(detail)}</span>
                  </div>
                  <div>
                    <b>Assignee</b>
                    <span>{assigneeLabel(detail)}</span>
                  </div>
                </div>
                <div className="form-grid" style={{ padding: '0 24px 12px' }}>
                  <label>
                    Payer
                    <select
                      value={editForm.payerId}
                      onChange={e => updateEdit({
                        payerId: e.target.value,
                        payerPlanId: ''
                      })}
                      disabled={!canEdit}
                    >
                      <option value="">Select payer</option>
                      {refs.payers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Payer Plan <span className="req">*</span>
                    <select
                      required
                      value={editForm.payerPlanId}
                      onChange={e => updateEdit({ payerPlanId: e.target.value })}
                      disabled={!canEdit || !editForm.payerId}
                    >
                      <option value="">Select plan</option>
                      {editPlanOptions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.planType ? ` (${p.planType})` : ''}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Practice
                    <select
                      value={editForm.practiceId}
                      onChange={e => updateEdit({
                        practiceId: e.target.value,
                        facilityId: '',
                        providerId: ''
                      })}
                      disabled={!canEdit}
                    >
                      <option value="">Select practice</option>
                      {refs.practices.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Facility <span className="req">*</span>
                    <select
                      required
                      value={editForm.facilityId}
                      onChange={e => updateEdit({ facilityId: e.target.value, providerId: '' })}
                      disabled={!canEdit}
                    >
                      <option value="">Select facility</option>
                      {editFacilityOptions.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Provider <span className="muted">(optional)</span>
                    <select
                      value={editForm.providerId}
                      onChange={e => updateEdit({ providerId: e.target.value })}
                      disabled={!canEdit || !editForm.facilityId}
                    >
                      <option value="">Facility only (no provider)</option>
                      {editProviders.map(p => (
                        <option key={p.id} value={p.id}>{personLabel(p)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Assignee
                    <select
                      value={editForm.assignedTo}
                      onChange={e => updateEdit({ assignedTo: e.target.value })}
                      disabled={!canEdit}
                    >
                      <option value="">Unassigned</option>
                      {refs.employees.map(emp => (
                        <option key={emp.id} value={emp.email || emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="span-2">
                    Subject / Application Name
                    <input
                      value={editForm.subject}
                      onChange={e => updateEdit({ subject: e.target.value })}
                      disabled={!canEdit}
                    />
                  </label>
                  <label>
                    Next lifecycle status
                    <select
                      value={editForm.status}
                      onChange={e => updateEdit({ status: e.target.value })}
                      disabled={!canEdit}
                    >
                      {[detail.status, ...allowedStatuses.filter(s => s !== detail.status)].filter(Boolean).map(s => (
                        <option key={s} value={s}>{labelForEnrollmentStatus(s)}</option>
                      ))}
                    </select>
                    <span className="muted" style={{ fontSize: 12 }}>
                      Transitions use lifecycle APIs. Recording submission is not automated payer portal submit.
                      Attention: {detail.attention || '—'}
                    </span>
                  </label>
                  <label>
                    Submitted Date (for submit action)
                    <input
                      type="date"
                      value={editForm.submittedAt}
                      onChange={e => updateEdit({ submittedAt: e.target.value })}
                      disabled={!canEdit}
                    />
                  </label>
                  <label>
                    Last Follow-up
                    <input
                      type="date"
                      value={editForm.lastFollowUpAt}
                      onChange={e => updateEdit({ lastFollowUpAt: e.target.value })}
                      disabled={!canEdit}
                    />
                  </label>
                  <label>
                    Next Follow-up
                    <input
                      type="date"
                      value={editForm.nextFollowUpAt}
                      onChange={e => updateEdit({ nextFollowUpAt: e.target.value })}
                      disabled={!canEdit}
                    />
                  </label>
                  <label className="span-2">
                    Notes
                    <textarea
                      rows="4"
                      value={editForm.notes}
                      onChange={e => updateEdit({ notes: e.target.value })}
                      disabled={!canEdit}
                    />
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
                <EnrollmentPacketPanel
                  enrollmentId={detail.id}
                  canReview={canEdit}
                  canWaive={PACKET_WAIVE_ROLES.has(user.role)}
                />
                <EnrollmentSubmissionPanel
                  enrollmentId={detail.id}
                  canManage={canEdit}
                  canExceptionalOverride={PACKET_OVERRIDE_ROLES.has(user.role)}
                />
                <IntegrationPanel
                  enrollmentId={detail.id}
                  providerId={detail.providerId || null}
                  canConfigure={PACKET_OVERRIDE_ROLES.has(user.role)}
                  canManageAuth={canEdit}
                />
                <EnrollmentRevalidationPanel
                  enrollmentId={detail.id}
                  canManage={canEdit}
                />
                <div className="modal-footer">
                  <span className="muted">Application # is read-only. Highlighting does not change status.</span>
                  <button type="button" className="secondary" onClick={() => setDetail(null)}>Close</button>
                  {canEdit && (
                    <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  )}
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {activityEnrollmentId && (
        <EnrollmentActivityDrawer
          enrollmentId={activityEnrollmentId}
          user={user}
          employees={refs.employees}
          onClose={closeActivity}
          onEnrollmentUpdated={onActivityEnrollmentUpdated}
        />
      )}
    </div>
  );
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
