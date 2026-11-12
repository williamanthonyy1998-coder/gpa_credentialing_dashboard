import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';

/**
 * Phase 4B — Enrollment requirement packet checklist.
 * Packet readiness is internal only (not payer submission/approval).
 */
export default function EnrollmentPacketPanel({ enrollmentId, canReview = true, canWaive = false }) {
  const [packet, setPacket] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    setError('');
    try {
      const [pkt, hist] = await Promise.all([
        api.get(`/enrollments/${enrollmentId}/packet`),
        api.get(`/enrollments/${enrollmentId}/packet/history`)
      ]);
      setPacket(pkt.data.packet || null);
      setNote(pkt.data.packet?.disclaimer || pkt.data.note || '');
      setHistory(hist.data.items || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load packet');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => { load(); }, [load]);

  async function evaluate() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/enrollments/${enrollmentId}/packet/evaluate`, {});
      setPacket(res.data.packet);
      setNote(res.data.note || res.data.packet?.disclaimer || '');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Evaluate failed');
    } finally {
      setLoading(false);
    }
  }

  async function review(itemId, decision, reason) {
    setBusyId(itemId);
    try {
      await api.post(`/enrollments/${enrollmentId}/packet/requirements/${itemId}/review`, {
        decision,
        reason: reason || (decision === 'VERIFY' ? 'Verified by GPA reviewer' : undefined)
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Review failed');
    } finally {
      setBusyId('');
    }
  }

  async function waive(itemId) {
    const reason = window.prompt('Waiver reason (required):');
    if (!reason?.trim()) return;
    setBusyId(itemId);
    try {
      await api.post(`/enrollments/${enrollmentId}/packet/requirements/${itemId}/waive`, { reason });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Waiver failed');
    } finally {
      setBusyId('');
    }
  }

  const summary = packet?.evaluationSummary || {};

  return (
    <section className="enrollment-packet-panel" style={{ marginTop: 16 }}>
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>Enrollment packet</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Internal checklist only — not payer submission, approval, or effective participation.
          </p>
        </div>
        <button type="button" className="primary" disabled={loading} onClick={evaluate}>
          {packet ? 'Re-evaluate packet' : 'Create / evaluate packet'}
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {note && <p className="muted">{note}</p>}

      {!packet && !loading && (
        <p className="muted">No packet yet. Evaluate to snapshot applicable payer/plan requirements for this enrollment.</p>
      )}

      {packet && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0' }}>
            <span>Version <strong>v{packet.version}</strong></span>
            <span>Status <StatusBadge value={packet.status} /></span>
            <span>Items {summary.total ?? packet.items?.length ?? 0}</span>
            <span>Required satisfied {summary.requiredSatisfied ?? '—'}/{summary.required ?? '—'}</span>
            <span>Missing {summary.missing ?? 0}</span>
            <span>Pending review {summary.pendingReview ?? 0}</span>
            <span>Rejected {summary.rejected ?? 0}</span>
            <span>Expired {summary.expired ?? 0}</span>
            <span>Waived {summary.waived ?? 0}</span>
          </div>
          {packet.conflictNotes && (
            <p className="form-error">Requirement conflicts: {packet.conflictNotes}</p>
          )}

          <div className="table-scroll table-cards">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Category</th>
                  <th>Required</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Why it applies</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(packet.items || []).map((item) => (
                  <tr key={item.id}>
                    <td className="cell-strong" data-label="Requirement">
                      <span className="cell-clip" title={item.requirementTitle}>{item.requirementTitle}</span>
                      {item.requirementCode && <div className="muted">{item.requirementCode}</div>}
                    </td>
                    <td data-label="Category">{item.category || '—'}</td>
                    <td data-label="Required">{item.isRequired ? 'Yes' : 'Optional'}</td>
                    <td data-label="Status"><StatusBadge value={item.status} /></td>
                    <td data-label="Source">
                      <span className="cell-clip" title={item.sourceLabel || item.sourceType || ''}>
                        {item.sourceLabel || item.sourceType || '—'}
                      </span>
                      {item.reviewNotes && <div className="muted">{item.reviewNotes}</div>}
                    </td>
                    <td data-label="Applies">
                      <span className="cell-clip" title={item.applicabilityReason || ''}>
                        {(item.applicabilityReason || '—').slice(0, 80)}
                        {(item.applicabilityReason || '').length > 80 ? '…' : ''}
                      </span>
                    </td>
                    <td data-label="Actions">
                      {canReview && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <button
                            type="button"
                            className="ghost"
                            disabled={busyId === item.id}
                            onClick={() => review(item.id, 'VERIFY')}
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            className="ghost"
                            disabled={busyId === item.id}
                            onClick={() => {
                              const reason = window.prompt('Rejection reason:');
                              if (reason?.trim()) review(item.id, 'REJECT', reason);
                            }}
                          >
                            Reject
                          </button>
                          {canWaive && (
                            <button
                              type="button"
                              className="ghost"
                              disabled={busyId === item.id}
                              onClick={() => waive(item.id)}
                            >
                              Waive
                            </button>
                          )}
                        </div>
                      )}
                      {!canReview && <span className="muted">View only</span>}
                    </td>
                  </tr>
                ))}
                {!packet.items?.length && (
                  <tr><td colSpan="7" className="table-empty">No applicable requirements in this snapshot.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {history.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <h4>Packet history</h4>
              <ul className="muted">
                {history.map((h) => (
                  <li key={h.id}>
                    v{h.version} — {h.status} — {h.evaluatedAt ? new Date(h.evaluatedAt).toLocaleString() : '—'}
                    {h._count?.items != null ? ` (${h._count.items} items)` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
