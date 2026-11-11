import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  X
} from 'lucide-react';
import api from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';
import { fmt } from '../../utils/format';
import { ENROLLMENT_STATUS_ORDER, labelForEnrollmentStatus } from './enrollmentLabels';

const WRITE_ROLES = new Set([
  'ADMIN',
  'CREDENTIALING_MANAGER',
  'CREDENTIALING_SPECIALIST',
  'ENROLLMENT_SPECIALIST',
  'APPROVER'
]);

const APPROVAL_VISIBLE = new Set([
  'PAYER_REVIEW',
  'ADDITIONAL_INFORMATION_NEEDED',
  'APPROVED',
  'DENIED'
]);

function dateInputValue(value) {
  if (!value) return '';
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : '';
}

function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function activityTypeLabel(type) {
  switch (type) {
    case 'FOLLOW_UP_COMPLETED': return 'Follow-up completed';
    case 'FOLLOW_UP_SCHEDULED': return 'Follow-up scheduled';
    case 'STATUS_CHANGE': return 'Status change';
    case 'APPROVAL_UPDATE': return 'Approval';
    case 'ASSIGNMENT': return 'Assignment';
    case 'SYSTEM': return 'System';
    default: return 'Message';
  }
}

function emptyApprovalForm(details) {
  return {
    payerEnrollmentId: details?.payerEnrollmentId || '',
    effectiveAt: dateInputValue(details?.effectiveAt),
    revalidationAt: dateInputValue(details?.revalidationAt),
    notes: details?.notes || ''
  };
}

export default function EnrollmentActivityDrawer({
  enrollmentId,
  user,
  employees = [],
  onClose,
  onEnrollmentUpdated
}) {
  const canWrite = WRITE_ROLES.has(user?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrollment, setEnrollment] = useState(null);
  const [activities, setActivities] = useState([]);
  const [message, setMessage] = useState('');
  const [composerMode, setComposerMode] = useState('MESSAGE');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [completedAt, setCompletedAt] = useState(dateInputValue(new Date().toISOString()));
  const [sending, setSending] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [approval, setApproval] = useState(null);
  const [approvalForm, setApprovalForm] = useState(emptyApprovalForm());
  const [approvalDocs, setApprovalDocs] = useState([]);
  const [savingApproval, setSavingApproval] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const bodyRef = useRef(null);
  const drawerRef = useRef(null);
  const previouslyFocused = useRef(null);

  const allowedStatuses = useMemo(() => {
    if (enrollment?.allowedTransitions?.length) return enrollment.allowedTransitions;
    return ENROLLMENT_STATUS_ORDER;
  }, [enrollment]);

  const loadAll = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    setError('');
    try {
      const [detailRes, activityRes, approvalRes] = await Promise.all([
        api.get(`/enrollments/${enrollmentId}`),
        api.get(`/enrollments/${enrollmentId}/activities`),
        api.get(`/enrollments/${enrollmentId}/approval`)
      ]);
      setEnrollment(detailRes.data);
      setStatusDraft(detailRes.data.status);
      setActivities(activityRes.data?.data || []);
      setApproval(approvalRes.data?.details || null);
      setApprovalForm(emptyApprovalForm(approvalRes.data?.details));
      setApprovalDocs(approvalRes.data?.documents || []);
      setShowApproval(APPROVAL_VISIBLE.has(detailRes.data.status) || Boolean(approvalRes.data?.details?.id));
      await api.post(`/enrollments/${enrollmentId}/activities/read`).catch(() => {});
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load enrollment activity.');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => Array.from(
      drawerRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []
    );
    const first = focusables()[0];
    first?.focus?.();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const items = focusables();
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    const body = bodyRef.current;
    if (loading || !body) return;
    const lastItem = body.querySelector('.enr-activity-item:last-of-type');
    if (!lastItem) return;
    const bodyRect = body.getBoundingClientRect();
    const itemRect = lastItem.getBoundingClientRect();
    const overflowBottom = itemRect.bottom - (bodyRect.top + body.clientHeight) + 12;
    if (overflowBottom > 0) body.scrollTop += overflowBottom;
  }, [activities, loading]);

  async function refreshEnrollmentSideEffects(updated) {
    if (updated) setEnrollment(prev => ({ ...prev, ...updated }));
    onEnrollmentUpdated?.(updated || enrollment);
  }

  async function sendActivity(e) {
    e.preventDefault();
    if (!canWrite || !message.trim() || sending) return;
    setSending(true);
    setError('');
    const body = {
      body: message.trim(),
      activityType: composerMode
    };
    if (composerMode === 'FOLLOW_UP_COMPLETED') {
      body.completedAt = completedAt || new Date().toISOString().slice(0, 10);
    }
    if (composerMode === 'FOLLOW_UP_SCHEDULED') {
      if (!nextFollowUpAt) {
        setError('Choose a next follow-up date.');
        setSending(false);
        return;
      }
      body.nextFollowUpAt = nextFollowUpAt;
    }
    try {
      const r = await api.post(`/enrollments/${enrollmentId}/activities`, body);
      setActivities(prev => [...prev, r.data]);
      setMessage('');
      const detail = await api.get(`/enrollments/${enrollmentId}`);
      setEnrollment(detail.data);
      refreshEnrollmentSideEffects(detail.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not post activity.');
    } finally {
      setSending(false);
    }
  }

  async function deleteActivity(activity) {
    if (!activity?.canDelete || !window.confirm('Delete this activity message?')) return;
    try {
      await api.delete(`/enrollments/${enrollmentId}/activities/${activity.id}`);
      setActivities(prev => prev.filter(a => a.id !== activity.id));
      const r = await api.get(`/enrollments/${enrollmentId}/activities`);
      setActivities(r.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete activity.');
    }
  }

  async function saveStatus() {
    if (!canWrite || !enrollment || !statusDraft || statusDraft === enrollment.status) return;
    setSavingStatus(true);
    setError('');
    try {
      const r = await api.patch(`/enrollments/${enrollmentId}`, { status: statusDraft });
      setEnrollment(prev => ({ ...prev, ...r.data }));
      setShowApproval(APPROVAL_VISIBLE.has(r.data.status) || showApproval);
      const activityRes = await api.get(`/enrollments/${enrollmentId}/activities`);
      setActivities(activityRes.data?.data || []);
      refreshEnrollmentSideEffects(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update status.');
      setStatusDraft(enrollment.status);
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveApproval(e) {
    e.preventDefault();
    if (!canWrite) return;
    if (!approvalForm.payerEnrollmentId.trim()) {
      setError('Payer Enrollment ID is required.');
      return;
    }
    if (!approvalForm.effectiveAt) {
      setError('Effective Date is required.');
      return;
    }
    setSavingApproval(true);
    setError('');
    try {
      const r = await api.put(`/enrollments/${enrollmentId}/approval`, {
        payerEnrollmentId: approvalForm.payerEnrollmentId.trim(),
        effectiveAt: approvalForm.effectiveAt,
        revalidationAt: approvalForm.revalidationAt || null,
        notes: approvalForm.notes || null
      });
      setApproval(r.data.details);
      setApprovalForm(emptyApprovalForm(r.data.details));
      const [detail, activityRes] = await Promise.all([
        api.get(`/enrollments/${enrollmentId}`),
        api.get(`/enrollments/${enrollmentId}/activities`)
      ]);
      setEnrollment(detail.data);
      setActivities(activityRes.data?.data || []);
      refreshEnrollmentSideEffects(detail.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save approval details.');
    } finally {
      setSavingApproval(false);
    }
  }

  async function uploadApprovalDoc(file) {
    if (!file || !canWrite) return;
    setUploadingDoc(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name);
      form.append('type', 'APPROVAL_LETTER');
      const r = await api.post(`/enrollments/${enrollmentId}/approval/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setApprovalDocs(prev => [r.data, ...prev]);
      const activityRes = await api.get(`/enrollments/${enrollmentId}/activities`);
      setActivities(activityRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not upload document.');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function openDocument(doc) {
    if (!doc?.id) return;
    try {
      const r = await api.get(`/documents/${doc.id}/file`, {
        params: { inline: 1 },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(r.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open document.');
    }
  }

  const days = enrollment?.daysConsumed ?? '—';

  return (
    <div className="enr-drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <aside
        ref={drawerRef}
        className="enr-activity-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Enrollment activity"
        tabIndex={-1}
      >
        <header className="enr-drawer-header">
          <div>
            <span className="eyebrow">ENROLLMENT ACTIVITY</span>
            <h2>{enrollment?.applicationNo || 'Loading…'}</h2>
            <p className="muted enr-drawer-sub">
              Permanent Enrollment ID · conversation is unique to this enrollment
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        {error && <div className="error banner enr-drawer-error">{error}</div>}

        {loading || !enrollment ? (
          <div className="enr-drawer-loading">Loading enrollment conversation…</div>
        ) : (
          <>
            <div className="enr-drawer-body" ref={bodyRef}>
              <section className="enr-drawer-summary">
                <div className="enr-summary-grid-compact">
                  <div><b>Payer</b><span>{enrollment.payerName || enrollment.payerPlan?.payer?.name || '—'}</span></div>
                  <div><b>Facility</b><span>{enrollment.facilityName || enrollment.facility?.name || '—'}</span></div>
                  <div><b>Provider</b><span>{enrollment.providerName || '—'}</span></div>
                  <div><b>Assigned</b><span>{enrollment.assigneeName || enrollment.assignedTo || '—'}</span></div>
                  <div><b>Status</b><span><StatusBadge value={enrollment.status} /></span></div>
                  <div><b>Days consumed</b><span>{days}</span></div>
                  <div><b>Last follow-up</b><span>{fmt(enrollment.lastFollowUpAt)}</span></div>
                  <div><b>Next follow-up</b><span>{fmt(enrollment.nextFollowUpAt)}</span></div>
                </div>

                {canWrite && (
                  <div className="enr-status-row">
                    <label>
                      Change status
                      <select
                        value={statusDraft}
                        onChange={e => setStatusDraft(e.target.value)}
                      >
                        {[enrollment.status, ...allowedStatuses.filter(s => s !== enrollment.status)]
                          .filter(Boolean)
                          .map(s => (
                            <option key={s} value={s}>{labelForEnrollmentStatus(s)}</option>
                          ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      disabled={savingStatus || statusDraft === enrollment.status}
                      onClick={saveStatus}
                    >
                      Update status
                    </button>
                    <button
                      type="button"
                      className="small-action"
                      onClick={() => setShowApproval(v => !v)}
                    >
                      {showApproval ? 'Hide approval' : 'Approval details'}
                    </button>
                  </div>
                )}
              </section>

              {showApproval && (
                <section className="enr-approval-panel">
                  <div className="enr-approval-head">
                    <h3>Approval details</h3>
                    <p className="muted">
                      Saving these fields does not change enrollment status. Use Update status separately.
                    </p>
                  </div>
                  <form className="enr-approval-form" onSubmit={saveApproval}>
                    <label>
                      Enrollment ID
                      <input value={enrollment.applicationNo} readOnly />
                    </label>
                    <label>
                      Payer Enrollment ID <span className="req">*</span>
                      <input
                        value={approvalForm.payerEnrollmentId}
                        onChange={e => setApprovalForm(f => ({ ...f, payerEnrollmentId: e.target.value }))}
                        placeholder="Payer reference / approval number"
                        disabled={!canWrite}
                        required
                      />
                    </label>
                    <label>
                      Effective Date <span className="req">*</span>
                      <input
                        type="date"
                        value={approvalForm.effectiveAt}
                        onChange={e => setApprovalForm(f => ({ ...f, effectiveAt: e.target.value }))}
                        disabled={!canWrite}
                        required
                      />
                    </label>
                    <label>
                      Revalidation Date
                      <input
                        type="date"
                        value={approvalForm.revalidationAt}
                        onChange={e => setApprovalForm(f => ({ ...f, revalidationAt: e.target.value }))}
                        disabled={!canWrite}
                      />
                    </label>
                    <label className="enr-approval-notes">
                      Approval Notes
                      <textarea
                        rows={3}
                        value={approvalForm.notes}
                        onChange={e => setApprovalForm(f => ({ ...f, notes: e.target.value }))}
                        disabled={!canWrite}
                        placeholder="Approval details and payer communication"
                      />
                    </label>
                    {canWrite && (
                      <div className="enr-approval-actions">
                        <button type="submit" className="primary" disabled={savingApproval}>
                          {savingApproval ? 'Saving…' : 'Save approval details'}
                        </button>
                        <label className="small-action enr-upload-btn">
                          <Paperclip size={14} />
                          {uploadingDoc ? 'Uploading…' : 'Upload supporting doc'}
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
                            hidden
                            disabled={uploadingDoc}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) uploadApprovalDoc(file);
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </form>
                  {!!approvalDocs.length && (
                    <ul className="enr-doc-list">
                      {approvalDocs.map(doc => (
                        <li key={doc.id}>
                          <button type="button" className="linkish" onClick={() => openDocument(doc)}>
                            <FileText size={14} /> {doc.title || doc.originalName || 'Document'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(approval?.updatedBy || approval?.createdBy) && (
                    <p className="muted enr-approval-meta">
                      Last updated by {approval.updatedBy?.name || approval.createdBy?.name || '—'}
                      {approval.updatedAt ? ` · ${fmtDateTime(approval.updatedAt)}` : ''}
                    </p>
                  )}
                </section>
              )}

              <section className="enr-timeline-wrap">
                <div className="enr-timeline-head">
                  <MessageSquare size={15} />
                  <h3>Activity timeline</h3>
                </div>
                <div className="enr-timeline">
                  {!activities.length ? (
                    <div className="enr-timeline-empty">No activity yet. Document calls, submissions, and follow-ups here.</div>
                  ) : activities.map(item => (
                    <article key={item.id} className={`enr-activity-item type-${(item.activityType || 'MESSAGE').toLowerCase()}`}>
                      <div className="enr-activity-meta">
                        <div className="enr-activity-meta-main">
                          <strong>{item.author?.name || 'System'}</strong>
                          <span>{activityTypeLabel(item.activityType)}</span>
                          <time dateTime={item.createdAt}>{fmtDateTime(item.createdAt)}</time>
                        </div>
                        {item.canDelete && (
                          <button
                            type="button"
                            className="icon-button enr-activity-delete"
                            title="Delete activity"
                            onClick={() => deleteActivity(item)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p>{item.body}</p>
                      {!!item.attachments?.length && (
                        <div className="enr-activity-attachments">
                          {item.attachments.map(att => (
                            <button
                              key={att.id}
                              type="button"
                              className="linkish"
                              onClick={() => openDocument(att.document)}
                            >
                              <Paperclip size={12} /> {att.document?.title || att.document?.originalName || 'Attachment'}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              {enrollment.statusHistory?.length > 0 && (
                <section className="enr-status-history-mini">
                  <h3>Status history</h3>
                  <ul>
                    {enrollment.statusHistory.slice(0, 8).map(h => (
                      <li key={h.id}>
                        <StatusBadge value={h.toStatus} />
                        <span className="muted">
                          {h.fromStatus ? `${h.fromStatus} → ` : ''}{fmtDateTime(h.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {canWrite && (
              <form className="enr-composer" onSubmit={sendActivity}>
                <div className="enr-composer-modes">
                  <button
                    type="button"
                    className={composerMode === 'MESSAGE' ? 'active' : ''}
                    onClick={() => setComposerMode('MESSAGE')}
                  >
                    <MessageSquare size={13} /> Note
                  </button>
                  <button
                    type="button"
                    className={composerMode === 'FOLLOW_UP_COMPLETED' ? 'active' : ''}
                    onClick={() => setComposerMode('FOLLOW_UP_COMPLETED')}
                  >
                    <CheckCircle2 size={13} /> Complete follow-up
                  </button>
                  <button
                    type="button"
                    className={composerMode === 'FOLLOW_UP_SCHEDULED' ? 'active' : ''}
                    onClick={() => setComposerMode('FOLLOW_UP_SCHEDULED')}
                  >
                    <Clock3 size={13} /> Schedule follow-up
                  </button>
                </div>
                {composerMode === 'FOLLOW_UP_COMPLETED' && (
                  <label className="enr-composer-field">
                    Completed on
                    <input type="date" value={completedAt} onChange={e => setCompletedAt(e.target.value)} />
                  </label>
                )}
                {composerMode === 'FOLLOW_UP_SCHEDULED' && (
                  <label className="enr-composer-field">
                    Next follow-up
                    <input type="date" value={nextFollowUpAt} onChange={e => setNextFollowUpAt(e.target.value)} required />
                  </label>
                )}
                <label className="enr-composer-field">
                  Activity note
                  <textarea
                    rows={3}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Called payer / documents sent / waiting for response…"
                    required
                  />
                </label>
                <div className="enr-composer-actions">
                  <span className="muted">
                    {employees.length ? 'Visible to authorized enrollment users' : 'Persisted in database'}
                  </span>
                  <button type="submit" className="primary" disabled={sending || !message.trim()}>
                    <Send size={14} /> {sending ? 'Sending…' : 'Post activity'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
