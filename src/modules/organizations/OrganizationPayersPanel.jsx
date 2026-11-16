import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import api from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';

const STATUS_OPTIONS = [
  'NOT_CONTRACTED',
  'CONTRACTING',
  'CONTRACTED',
  'ACTIVE',
  'SUSPENDED',
  'TERMINATED',
  'PENDING_RENEWAL'
];

function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString() : '—';
}

export default function OrganizationPayersPanel({ organizationId, orgName }) {
  const [items, setItems] = useState([]);
  const [payers, setPayers] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/organizations/${organizationId}/payers`, {
        params: {
          q: q || undefined,
          participationStatus: status || undefined
        }
      });
      setItems(r.data.items || []);
      setCanManage(Boolean(r.data.canManage));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load organization payer relationships.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [organizationId]);

  async function openAdd() {
    setEditing(null);
    setModal(true);
    setError('');
    try {
      const r = await api.get('/payers', { params: { limit: 500 } });
      setPayers(Array.isArray(r.data) ? r.data : (r.data?.data || []));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load payer directory.');
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null; });
    try {
      if (editing) {
        await api.patch(`/organizations/${organizationId}/payers/${editing.id}`, body);
      } else {
        await api.post(`/organizations/${organizationId}/payers`, body);
      }
      setModal(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save payer relationship.');
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row) {
    const label = row.payer?.name || 'payer';
    if (!window.confirm(`Remove or terminate participation with ${label}? Active/contracted relationships are terminated rather than deleted.`)) return;
    try {
      await api.delete(`/organizations/${organizationId}/payers/${row.id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not update payer relationship.');
    }
  }

  const linked = new Set(items.map((x) => x.payerId));
  const availablePayers = payers.filter((p) => !linked.has(p.id) && p.status !== 'ARCHIVED');

  return (
    <div className="page org-record-page">
      <div className="panel-heading">
        <div>
          <h2>Payer Participation</h2>
          <p>
            Contract and participation relationships for {orgName || 'this organization'} using the shared payer directory.
            Enrollment workflows remain separate under Payer Enrollment.
          </p>
        </div>
        <div className="row gap">
          <button type="button" className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {canManage && (
            <button type="button" className="primary" onClick={openAdd}><Plus size={16} /> Add payer</button>
          )}
        </div>
      </div>

      <div className="toolbar row gap wrap" style={{ marginBottom: '1rem' }}>
        <label className="grow">
          <div className="row gap" style={{ alignItems: 'center' }}>
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payer or contract…" />
          </div>
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Participation status">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button type="button" className="secondary" onClick={load}>Apply</button>
      </div>

      {error && <div className="error banner">{error}</div>}

      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>Payer</th>
              <th>Type</th>
              <th>Status</th>
              <th>Contract #</th>
              <th>Effective</th>
              <th>Renewal</th>
              <th>Plans</th>
              <th>Contact</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="9" className="table-empty">Loading…</td></tr>}
            {!loading && !items.length && (
              <tr><td colSpan="9" className="table-empty">No payer participation records yet. Add an existing payer to begin contracting.</td></tr>
            )}
            {!loading && items.map((row) => (
              <tr key={row.id}>
                <td>
                  <button type="button" className="linkish" onClick={() => setDetail(row)}>
                    <b>{row.payer?.name || '—'}</b>
                  </button>
                  <div className="muted small">{row.payer?.payerCode || ''}</div>
                </td>
                <td>{row.payer?.payerType || '—'}</td>
                <td><StatusBadge value={row.participationStatus} /></td>
                <td>{row.contractReference || '—'}</td>
                <td>{fmtDate(row.effectiveDate)}</td>
                <td>{fmtDate(row.renewalDate)}</td>
                <td>{row.payer?.plans?.length ?? 0}</td>
                <td>{row.assignedContact?.name || '—'}</td>
                <td className="row gap">
                  {canManage && (
                    <>
                      <button type="button" className="ghost-btn" onClick={() => { setEditing(row); setModal(true); }}>Edit</button>
                      <button type="button" className="ghost-btn" onClick={() => removeRow(row)}>Remove</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <div className="panel-heading">
            <div>
              <h3>{detail.payer?.name}</h3>
              <p className="muted">{detail.participationStatus?.replace(/_/g, ' ')} · {detail.contractReference || 'No contract reference'}</p>
            </div>
            <button type="button" className="ghost-btn" onClick={() => setDetail(null)}>Close</button>
          </div>
          <p>{detail.notes || 'No notes.'}</p>
          <h4>Associated plans</h4>
          <ul>
            {(detail.payer?.plans || []).map((p) => (
              <li key={p.id}>{p.name}{p.planCode ? ` (${p.planCode})` : ''} · {p.planType || '—'}</li>
            ))}
            {!detail.payer?.plans?.length && <li className="muted">No active plans on this payer.</li>}
          </ul>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal panel" onSubmit={save}>
            <h3>{editing ? 'Update payer participation' : 'Add payer relationship'}</h3>
            {!editing && (
              <label>Payer
                <select name="payerId" required defaultValue="">
                  <option value="" disabled>Select payer…</option>
                  {availablePayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.payerType ? ` · ${p.payerType}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>Participation status
              <select name="participationStatus" defaultValue={editing?.participationStatus || 'CONTRACTING'}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label>Contract reference
              <input name="contractReference" defaultValue={editing?.contractReference || ''} />
            </label>
            <div className="row gap">
              <label className="grow">Effective
                <input type="date" name="effectiveDate" defaultValue={editing?.effectiveDate ? String(editing.effectiveDate).slice(0, 10) : ''} />
              </label>
              <label className="grow">Termination
                <input type="date" name="terminationDate" defaultValue={editing?.terminationDate ? String(editing.terminationDate).slice(0, 10) : ''} />
              </label>
              <label className="grow">Renewal
                <input type="date" name="renewalDate" defaultValue={editing?.renewalDate ? String(editing.renewalDate).slice(0, 10) : ''} />
              </label>
            </div>
            <label>Notes
              <textarea name="notes" rows={3} defaultValue={editing?.notes || ''} />
            </label>
            <div className="row gap end">
              <button type="button" className="ghost-btn" onClick={() => { setModal(false); setEditing(null); }}>Cancel</button>
              <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
