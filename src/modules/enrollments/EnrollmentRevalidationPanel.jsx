import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';

const TYPES = [
  'MEDICARE_REVALIDATION',
  'MEDICAID_REVALIDATION',
  'COMMERCIAL_REVALIDATION',
  'GROUP_REVALIDATION',
  'FACILITY_REVALIDATION',
  'OTHER'
];

/**
 * Phase 4E — payer revalidation panel.
 * Separate from credential/license expiration.
 */
export default function EnrollmentRevalidationPanel({ enrollmentId, canManage = true }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [type, setType] = useState('COMMERCIAL_REVALIDATION');
  const [dueDate, setDueDate] = useState('');
  const [source, setSource] = useState('MANUAL');
  const [sourceRef, setSourceRef] = useState('');

  const load = useCallback(async () => {
    if (!enrollmentId) return;
    setError('');
    try {
      const res = await api.get(`/enrollments/${enrollmentId}/revalidations`);
      setItems(res.data.items || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, [enrollmentId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    try {
      await api.post(`/enrollments/${enrollmentId}/revalidations`, {
        revalidationType: type,
        dueDate: dueDate || null,
        dueDateSource: source,
        sourceReference: sourceRef || null,
        source: source === 'PAYER_NOTICE' ? 'Payer notice' : 'Staff entry'
      });
      setDueDate('');
      setSourceRef('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  async function act(id, path, body = {}) {
    try {
      await api.post(`/revalidations/${id}/${path}`, body);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  return (
    <section style={{ marginTop: 20 }}>
      <div className="section-head">
        <h3 style={{ margin: 0 }}>Payer revalidation</h3>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Separate from license/credential expiration. Creating a revalidation does not change enrollment
          approval or effective status.
        </p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      {canManage && (
        <div style={{ display: 'grid', gap: 8, maxWidth: 640, marginBottom: 12 }}>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label>
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="MANUAL">MANUAL</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="ESTIMATED">ESTIMATED</option>
            <option value="PAYER_NOTICE">PAYER_NOTICE</option>
          </select>
          <input
            placeholder="Source reference (required for CONFIRMED)"
            value={sourceRef}
            onChange={(e) => setSourceRef(e.target.value)}
          />
          <button type="button" className="secondary" onClick={create}>Create revalidation</button>
        </div>
      )}

      <div className="table-scroll table-cards">
        <table className="brand-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Due</th>
              <th>Days</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.revalidationType}</td>
                <td><StatusBadge value={r.status} /></td>
                <td>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</td>
                <td>{r.daysRemaining ?? '—'}{r.overdue ? ' overdue' : ''}</td>
                <td>{r.dueDateSource}</td>
                <td>
                  {canManage && !['COMPLETED', 'DENIED', 'CANCELLED'].includes(r.status) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {['NOT_STARTED', 'UPCOMING', 'OVERDUE', 'ADDITIONAL_INFORMATION_REQUIRED'].includes(r.status) && (
                        <button type="button" className="ghost" onClick={() => act(r.id, 'prepare')}>Prepare</button>
                      )}
                      {r.status === 'PREPARING' && (
                        <button type="button" className="ghost" onClick={() => act(r.id, 'ready')}>Ready</button>
                      )}
                      {r.status === 'READY_FOR_INTERNAL_REVIEW' && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => act(r.id, 'submit', { confirmedSent: true })}
                        >
                          Submit
                        </button>
                      )}
                      {r.status === 'SUBMITTED' && (
                        <button type="button" className="ghost" onClick={() => act(r.id, 'acknowledge')}>Ack</button>
                      )}
                      {['ACKNOWLEDGED', 'SUBMITTED'].includes(r.status) && (
                        <button type="button" className="ghost" onClick={() => act(r.id, 'approve')}>Approve</button>
                      )}
                      {r.status === 'APPROVED' && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => act(r.id, 'complete', {})}
                          title="Requires evidence document id in API for completion"
                        >
                          Complete*
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          const reason = window.prompt('Cancel reason');
                          if (reason) act(r.id, 'cancel', { reason });
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan="6" className="table-empty">No revalidations.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
