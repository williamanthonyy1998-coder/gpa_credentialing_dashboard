import React, { useEffect, useState } from 'react';
import { Inbox, Plus, RefreshCw, Send, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { fmt } from '../../utils/format';

const WIZARD_STEPS = [
  { key: 'type', title: 'Type & subject' },
  { key: 'contact', title: 'Contact info' },
  { key: 'draft', title: 'Provider / site draft' },
  { key: 'review', title: 'Review' }
];

const emptySummary = { total: 0, pending: 0, sent: 0, converted: 0 };

export default function IntakePage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    intakeType: 'PROVIDER',
    subjectName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    providerNpi: '',
    practiceName: '',
    facilityName: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState('');

  async function loadSummary() {
    try {
      const r = await api.get('/intake/summary');
      setSummary({ ...emptySummary, ...r.data });
    } catch (e) {
      if (e.response?.status !== 404) throw e;
      setSummary(emptySummary);
    }
  }

  async function loadList() {
    try {
      const r = await api.get('/intake');
      setRows(Array.isArray(r.data) ? r.data : (r.data?.data ?? []));
    } catch (e) {
      if (e.response?.status === 404) {
        setRows([]);
        return;
      }
      throw e;
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadSummary(), loadList()]);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load intake requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setStep(0);
    setDraft({
      intakeType: 'PROVIDER',
      subjectName: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      providerNpi: '',
      practiceName: '',
      facilityName: '',
      notes: ''
    });
    setModal(true);
  }

  async function submitWizard(e) {
    e.preventDefault();
    if (step < WIZARD_STEPS.length - 1) {
      setStep(s => s + 1);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/intake', draft);
      setModal(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create intake request.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(id, action) {
    setActionBusy(`${id}:${action}`);
    setError('');
    try {
      await api.post(`/intake/${id}/${action}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || `Could not ${action} intake request.`);
    } finally {
      setActionBusy('');
    }
  }

  return (
    <div className="page intake-page">
      <PageHeader
        eyebrow="OPERATIONS"
        title="Intake"
        description="Capture inbound credentialing requests and route them through review before conversion to directory records."
        breadcrumbs={[
          { label: 'Workspace', to: '/' },
          { label: 'Intake' }
        ]}
        back={{ label: 'Back', fallbackHref: null, autoLabel: true, hideIfNoTarget: true }}
        actions={(
          <>
            <button type="button" className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
            <button type="button" className="primary" onClick={openCreate}><Plus size={17} /> Create request</button>
          </>
        )}
      />
      {error && <div className="error banner">{error}</div>}

      <div className="metric-grid intake-kpi">
        <StatCard label="Total requests" value={loading ? '—' : summary.total} icon={Inbox} tone="navy" />
        <StatCard label="Pending review" value={loading ? '—' : (summary.pending ?? 0)} icon={Inbox} tone="warning" />
        <StatCard label="Sent" value={loading ? '—' : (summary.sent ?? 0)} icon={Send} tone="blue" />
        <StatCard label="Converted" value={loading ? '—' : (summary.converted ?? 0)} icon={Inbox} tone="green" />
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <span className="record-count">{loading ? 'Loading…' : `${rows.length} requests`}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Created</th>
                <th className="action-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="table-empty">Loading intake requests…</td></tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    <h3>No intake requests yet</h3>
                    <p>Use Create request when the intake API is available, or connect the backend route.</p>
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.id}>
                  <td><span className="cell-strong">{row.subjectName || row.subject || '—'}</span></td>
                  <td>{fmt(row.intakeType || row.type)}</td>
                  <td>
                    {row.contactName || '—'}
                    <div className="muted" style={{ fontSize: 9 }}>{row.contactEmail || ''}</div>
                  </td>
                  <td><StatusBadge value={row.status || 'PENDING'} /></td>
                  <td>{fmt(row.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="small-action"
                        disabled={!!actionBusy}
                        onClick={() => runAction(row.id, 'send')}
                      >
                        Send
                      </button>
                      <button
                        type="button"
                        className="small-action"
                        disabled={!!actionBusy}
                        onClick={() => runAction(row.id, 'review')}
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        className="small-action"
                        disabled={!!actionBusy}
                        onClick={() => runAction(row.id, 'convert')}
                      >
                        Convert
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setModal(false)}>
          <form className="record-modal intake-wizard" onSubmit={submitWizard}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">NEW INTAKE</span>
                <h2>Create intake request</h2>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  Step {step + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[step].title}
                </p>
              </div>
              <button type="button" className="icon-button" onClick={() => setModal(false)}><X size={20} /></button>
            </div>
            <div className="intake-step-tabs tab-row">
              {WIZARD_STEPS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  className={`tab-btn ${i === step ? 'active' : ''}`}
                  onClick={() => setStep(i)}
                >
                  {s.title}
                </button>
              ))}
            </div>
            <div className="form-grid" style={{ padding: '0 24px 12px' }}>
              {step === 0 && (
                <>
                  <label>
                    Intake type
                    <select
                      value={draft.intakeType}
                      onChange={e => setDraft(d => ({ ...d, intakeType: e.target.value }))}
                    >
                      {['PROVIDER', 'ORGANIZATION', 'PRACTICE', 'FACILITY'].map(t => (
                        <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Subject name
                    <input
                      required
                      value={draft.subjectName}
                      onChange={e => setDraft(d => ({ ...d, subjectName: e.target.value }))}
                    />
                  </label>
                </>
              )}
              {step === 1 && (
                <>
                  <label>Contact name<input required value={draft.contactName} onChange={e => setDraft(d => ({ ...d, contactName: e.target.value }))} /></label>
                  <label>Contact email<input type="email" required value={draft.contactEmail} onChange={e => setDraft(d => ({ ...d, contactEmail: e.target.value }))} /></label>
                  <label className="span-2">Contact phone<input value={draft.contactPhone} onChange={e => setDraft(d => ({ ...d, contactPhone: e.target.value }))} /></label>
                </>
              )}
              {step === 2 && (
                <>
                  <label>Provider NPI<input value={draft.providerNpi} onChange={e => setDraft(d => ({ ...d, providerNpi: e.target.value }))} /></label>
                  <label>Practice name<input value={draft.practiceName} onChange={e => setDraft(d => ({ ...d, practiceName: e.target.value }))} /></label>
                  <label className="span-2">Facility name<input value={draft.facilityName} onChange={e => setDraft(d => ({ ...d, facilityName: e.target.value }))} /></label>
                </>
              )}
              {step === 3 && (
                <div className="span-2 intake-review">
                  <b>{draft.subjectName}</b>
                  <span>Type: {draft.intakeType}</span>
                  <span>Contact: {draft.contactName} · {draft.contactEmail}</span>
                  {draft.providerNpi && <span>NPI: {draft.providerNpi}</span>}
                  {draft.practiceName && <span>Practice: {draft.practiceName}</span>}
                  {draft.facilityName && <span>Facility: {draft.facilityName}</span>}
                  <label className="span-2" style={{ marginTop: 10 }}>
                    Notes
                    <textarea rows="3" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
                  </label>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => (step > 0 ? setStep(s => s - 1) : setModal(false))}
              >
                {step > 0 ? 'Back' : 'Cancel'}
              </button>
              <button className="primary" disabled={saving}>
                {step < WIZARD_STEPS.length - 1 ? 'Continue' : (saving ? 'Submitting…' : 'Submit request')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
