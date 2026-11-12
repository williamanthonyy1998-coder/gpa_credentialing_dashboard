import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';

const CHANNELS = ['PAYER_PORTAL_MANUAL', 'FAX', 'MAIL', 'EMAIL', 'PHONE', 'OTHER'];
const COMM_TYPES = [
  'SUBMISSION_CONFIRMATION',
  'RECEIPT_ACKNOWLEDGEMENT',
  'STATUS_INQUIRY',
  'ADDITIONAL_INFORMATION_REQUEST',
  'DOCUMENT_SENT',
  'APPROVAL_NOTIFICATION',
  'DENIAL_NOTIFICATION',
  'EFFECTIVE_DATE_CONFIRMATION',
  'TERMINATION_NOTICE',
  'OTHER'
];
const FOLLOW_TYPES = [
  'INITIAL_PAYER_CHECK',
  'RECEIPT_CONFIRMATION',
  'STATUS_CHECK',
  'ADDITIONAL_INFORMATION',
  'DOCUMENT_RESUBMISSION',
  'APPROVAL_CONFIRMATION',
  'EFFECTIVE_DATE_CONFIRMATION',
  'OTHER'
];

/**
 * Phase 4C — Submission tracking, communications, follow-ups, timeline.
 * Manual submission record ≠ automated payer portal integration.
 * Ordinary confirm ≠ exceptional packet override (ADMIN / CREDENTIALING_MANAGER only).
 */
export default function EnrollmentSubmissionPanel({
  enrollmentId,
  canManage = true,
  canExceptionalOverride = false
}) {
  const [submissions, setSubmissions] = useState([]);
  const [comms, setComms] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState('PAYER_PORTAL_MANUAL');
  const [channelExplanation, setChannelExplanation] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmedSent, setConfirmedSent] = useState(false);
  const [useExceptionalOverride, setUseExceptionalOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [commForm, setCommForm] = useState({
    communicationType: 'STATUS_INQUIRY',
    channel: 'PHONE',
    summary: '',
    channelExplanation: ''
  });
  const [followForm, setFollowForm] = useState({
    followUpType: 'STATUS_CHECK',
    dueAt: '',
    description: ''
  });

  const load = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    setError('');
    try {
      const [s, c, f, t] = await Promise.all([
        api.get(`/enrollments/${enrollmentId}/submissions`),
        api.get(`/enrollments/${enrollmentId}/communications`),
        api.get(`/enrollments/${enrollmentId}/follow-ups`),
        api.get(`/enrollments/${enrollmentId}/timeline`)
      ]);
      setSubmissions(s.data.items || []);
      setComms(c.data.items || []);
      setFollowUps(f.data.items || []);
      setTimeline(t.data.events || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load submission data');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => { load(); }, [load]);

  async function prepare() {
    try {
      await api.post(`/enrollments/${enrollmentId}/submissions/prepare`, {
        channel,
        channelExplanation: channelExplanation || null,
        referenceNo: referenceNo || null,
        notes: notes || null
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  async function confirm() {
    try {
      await api.post(`/enrollments/${enrollmentId}/submissions/confirm`, {
        channel,
        channelExplanation: channelExplanation || null,
        referenceNo: referenceNo || null,
        notes: notes || null,
        confirmedSent,
        overrideReason: useExceptionalOverride && canExceptionalOverride
          ? (overrideReason || null)
          : null
      });
      setConfirmedSent(false);
      setUseExceptionalOverride(false);
      setOverrideReason('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  async function addComm(e) {
    e.preventDefault();
    try {
      await api.post(`/enrollments/${enrollmentId}/communications`, {
        ...commForm,
        channelExplanation: commForm.channelExplanation || null
      });
      setCommForm((p) => ({ ...p, summary: '' }));
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  async function addFollow(e) {
    e.preventDefault();
    try {
      await api.post(`/enrollments/${enrollmentId}/follow-ups`, followForm);
      setFollowForm({ followUpType: 'STATUS_CHECK', dueAt: '', description: '' });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  async function completeFollow(id) {
    try {
      await api.post(`/enrollments/${enrollmentId}/follow-ups/${id}/complete`, {
        completionNotes: 'Completed'
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  const latest = submissions[0];
  const openFollowUps = followUps.filter((f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS');
  const completedFollowUps = followUps.filter((f) => f.status === 'COMPLETED');

  return (
    <section style={{ marginTop: 20 }}>
      <div className="section-head">
        <h3 style={{ margin: 0 }}>Submission, communications & follow-ups</h3>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Packet readiness is not submission. Confirming a submission records a manual send — it is not automated payer integration.
        </p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '12px 0' }}>
        <div>
          <b>Latest submission</b>
          {!latest && <div className="muted">None</div>}
          {latest && (
            <div className="muted">
              <div>Status <StatusBadge value={latest.confirmationStatus} /></div>
              <div>Channel {latest.channel}</div>
              <div>Ref {latest.referenceNo || '—'}</div>
              <div>Packet v{latest.packetVersion ?? '—'}</div>
              <div>Submitted {latest.submittedAt ? new Date(latest.submittedAt).toLocaleString() : '—'}</div>
              {latest.overrideReason
                ? <div><b>Exceptional override</b> recorded</div>
                : latest.confirmationStatus === 'CONFIRMED'
                  ? <div>Ordinary confirmation (packet ready)</div>
                  : null}
            </div>
          )}
        </div>
        <div>
          <b>Follow-ups</b>
          <div className="muted">Open {openFollowUps.length} · Completed {completedFollowUps.length}</div>
          <div className="muted">
            Next {openFollowUps[0]?.dueAt ? new Date(openFollowUps[0].dueAt).toLocaleString() : '—'}
            {openFollowUps.some((f) => f.overdue) ? ' · Overdue' : ''}
          </div>
        </div>
      </div>

      {canManage && (
        <div style={{ display: 'grid', gap: 8, maxWidth: 640, marginBottom: 16 }}>
          <label>
            Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {(channel === 'PHONE' || channel === 'OTHER') && (
            <label>
              Channel explanation
              <input value={channelExplanation} onChange={(e) => setChannelExplanation(e.target.value)} />
            </label>
          )}
          <label>
            Payer reference
            <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          </label>
          <label>
            Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={confirmedSent} onChange={(e) => setConfirmedSent(e.target.checked)} />
            I confirm this application was actually sent to the payer
          </label>
          {canExceptionalOverride && (
            <div style={{ borderTop: '1px solid var(--border, #d6dee8)', paddingTop: 8 }}>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                Ordinary confirmation requires a ready packet. Exceptional override is for ADMIN /
                Credentialing Manager only when the packet is incomplete, not evaluated, or blocked —
                it is not a general bypass and must be documented.
              </p>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={useExceptionalOverride}
                  onChange={(e) => setUseExceptionalOverride(e.target.checked)}
                />
                Use exceptional packet override (authorized role only)
              </label>
              {useExceptionalOverride && (
                <label>
                  Override reason (required, documented in audit)
                  <textarea
                    rows={3}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Explain why confirming despite packet readiness issues…"
                  />
                </label>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="secondary" disabled={loading} onClick={prepare}>Prepare submission</button>
            <button
              type="button"
              className="primary"
              disabled={loading || !confirmedSent || (useExceptionalOverride && overrideReason.trim().length < 20)}
              onClick={confirm}
            >
              {useExceptionalOverride ? 'Confirm with exceptional override' : 'Confirm ordinary submission'}
            </button>
          </div>
        </div>
      )}

      <h4>Submission history</h4>
      <div className="table-scroll table-cards">
        <table className="brand-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Channel</th>
              <th>Packet</th>
              <th>Override</th>
              <th>Reference</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>{s.attemptNumber}</td>
                <td><StatusBadge value={s.confirmationStatus} /></td>
                <td>{s.channel}</td>
                <td>v{s.packetVersion ?? '—'}</td>
                <td>{s.overrideReason ? 'Exceptional' : (s.confirmationStatus === 'CONFIRMED' ? 'Ordinary' : '—')}</td>
                <td>{s.referenceNo || '—'}</td>
                <td>{s.confirmedAt || s.submittedAt || s.createdAt
                  ? new Date(s.confirmedAt || s.submittedAt || s.createdAt).toLocaleString()
                  : '—'}</td>
              </tr>
            ))}
            {!submissions.length && <tr><td colSpan="7" className="table-empty">No submission attempts.</td></tr>}
          </tbody>
        </table>
      </div>

      <h4>Communications</h4>
      {canManage && (
        <form onSubmit={addComm} style={{ display: 'grid', gap: 8, maxWidth: 640, marginBottom: 12 }}>
          <select
            value={commForm.communicationType}
            onChange={(e) => setCommForm((p) => ({ ...p, communicationType: e.target.value }))}
          >
            {COMM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={commForm.channel}
            onChange={(e) => setCommForm((p) => ({ ...p, channel: e.target.value }))}
          >
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            placeholder="Summary"
            value={commForm.summary}
            onChange={(e) => setCommForm((p) => ({ ...p, summary: e.target.value }))}
            required
          />
          <button type="submit" className="secondary">Add communication</button>
        </form>
      )}
      <ul className="muted">
        {comms.map((c) => (
          <li key={c.id}>
            {new Date(c.occurredAt).toLocaleString()} — {c.communicationType} / {c.channel}: {c.summary}
          </li>
        ))}
        {!comms.length && <li>No communications recorded.</li>}
      </ul>

      <h4>Follow-ups</h4>
      {canManage && (
        <form onSubmit={addFollow} style={{ display: 'grid', gap: 8, maxWidth: 640, marginBottom: 12 }}>
          <select
            value={followForm.followUpType}
            onChange={(e) => setFollowForm((p) => ({ ...p, followUpType: e.target.value }))}
          >
            {FOLLOW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="datetime-local"
            value={followForm.dueAt}
            onChange={(e) => setFollowForm((p) => ({ ...p, dueAt: e.target.value }))}
            required
          />
          <input
            placeholder="Description"
            value={followForm.description}
            onChange={(e) => setFollowForm((p) => ({ ...p, description: e.target.value }))}
            required
          />
          <button type="submit" className="secondary">Create follow-up</button>
        </form>
      )}
      <div className="table-scroll table-cards">
        <table className="brand-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Due</th>
              <th>Assignee</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {followUps.map((f) => (
              <tr key={f.id}>
                <td>{f.followUpType || '—'}</td>
                <td>
                  <StatusBadge value={f.status} />
                  {f.overdue ? ' overdue' : ''}
                </td>
                <td>{f.dueAt ? new Date(f.dueAt).toLocaleString() : '—'}</td>
                <td>{f.assignedTo?.name || '—'}</td>
                <td>
                  {canManage && (f.status === 'OPEN' || f.status === 'IN_PROGRESS') && (
                    <button type="button" className="ghost" onClick={() => completeFollow(f.id)}>Complete</button>
                  )}
                </td>
              </tr>
            ))}
            {!followUps.length && <tr><td colSpan="5" className="table-empty">No follow-ups.</td></tr>}
          </tbody>
        </table>
      </div>

      <h4>Activity timeline</h4>
      <ul className="muted">
        {timeline.slice().reverse().slice(0, 40).map((ev) => (
          <li key={`${ev.source}-${ev.id}`}>
            {new Date(ev.at).toLocaleString()} — <b>{ev.type}</b>: {ev.summary}
          </li>
        ))}
        {!timeline.length && <li>No timeline events yet.</li>}
      </ul>
    </section>
  );
}
