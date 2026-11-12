import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, Eye, Inbox, Plus, RefreshCw, Send, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import IconButton, { RowActions } from '../../components/common/IconButton';
import CellText from '../../components/common/CellText';
import { SpecialtySelect, LicenseTypeSelect, StateSelect, StateAbbrevSelect } from '../../components/directory';
import { fmt } from '../../utils/format';

const WIZARD_STEPS = [
  { key: 'type', title: 'Type & subject' },
  { key: 'contact', title: 'Contact info' },
  { key: 'draft', title: 'Provider / site draft' },
  { key: 'review', title: 'Review' }
];

const emptySummary = { total: 0, pending: 0, sent: 0, converted: 0 };

const emptyDraft = {
  intakeType: 'PROVIDER',
  subjectName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  firstName: '',
  lastName: '',
  providerNpi: '',
  primarySpecialtyId: '',
  primarySpecialty: '',
  licenseTypeId: '',
  licenseTypeName: '',
  licenseNumber: '',
  usStateId: '',
  licenseState: '',
  practiceName: '',
  facilityName: '',
  addressState: '',
  notes: ''
};

export default function IntakePage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
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
    setDraft({ ...emptyDraft });
    setModal(true);
  }

  function buildPayload() {
    const kind = draft.intakeType;
    const names = String(draft.subjectName || '').trim().split(/\s+/);
    const firstName = draft.firstName || names[0] || '';
    const lastName = draft.lastName || names.slice(1).join(' ') || names[0] || '';
    return {
      kind,
      contactName: draft.contactName || null,
      contactEmail: draft.contactEmail || null,
      contactPhone: draft.contactPhone || null,
      notes: draft.notes || null,
      payload: {
        subjectName: draft.subjectName,
        firstName,
        lastName,
        npi: draft.providerNpi || null,
        provider: {
          firstName,
          lastName,
          npi: draft.providerNpi || null,
          primarySpecialtyId: draft.primarySpecialtyId || null,
          primarySpecialty: draft.primarySpecialty || null,
          license: draft.licenseTypeId || draft.licenseNumber ? {
            licenseTypeId: draft.licenseTypeId || null,
            type: draft.licenseTypeName || null,
            number: draft.licenseNumber || null,
            usStateId: draft.usStateId || null,
            state: draft.licenseState || null
          } : undefined,
          address: draft.addressState ? { state: draft.addressState } : undefined
        },
        practiceName: draft.practiceName || null,
        facilityName: draft.facilityName || null,
        practice: draft.practiceName ? { name: draft.practiceName } : undefined,
        facility: draft.facilityName ? {
          name: draft.facilityName,
          address: draft.addressState ? { state: draft.addressState } : undefined
        } : undefined
      }
    };
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
      await api.post('/intake', buildPayload());
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
      if (action === 'invite-provider') {
        const email = window.prompt('Provider email for secure intake invitation');
        if (!email) return;
        const r = await api.post(`/intake/${id}/invite-provider`, { email, send: true });
        if (r.data?.acceptanceUrl) {
          setError(`Email not delivered. Share invitation link securely: ${r.data.acceptanceUrl}`);
        }
      } else if (action === 'request-changes') {
        const comments = window.prompt('Comments for the provider (required)');
        if (!comments) return;
        await api.post(`/intake/${id}/request-changes`, { comments });
      } else if (action === 'approve') {
        await api.post(`/intake/${id}/approve`, {});
      } else if (action === 'reject') {
        const reason = window.prompt('Rejection reason (required)');
        if (!reason) return;
        await api.post(`/intake/${id}/reject`, { reason });
      } else {
        await api.post(`/intake/${id}/${action}`);
      }
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
        <div className="table-scroll table-cards">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th className="col-narrow">Type</th>
                <th>Contact</th>
                <th className="col-status">Status</th>
                <th className="col-date">Created</th>
                <th className="action-head col-actions">Actions</th>
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
                  <td data-label="Subject">
                    <CellText strong title={row.payload?.subjectName || row.referenceNo || '—'}>
                      {row.payload?.subjectName || row.referenceNo || '—'}
                    </CellText>
                  </td>
                  <td className="col-narrow" data-label="Type">{fmt(row.kind || row.intakeType || row.type)}</td>
                  <td data-label="Contact">
                    <CellText title={[row.contactName, row.contactEmail].filter(Boolean).join(' · ') || '—'}>
                      {row.contactName || '—'}
                    </CellText>
                    {row.contactEmail ? <div className="muted" style={{ fontSize: 9 }}>{row.contactEmail}</div> : null}
                  </td>
                  <td className="col-status" data-label="Status"><StatusBadge value={row.status || 'PENDING'} /></td>
                  <td className="col-date" data-label="Created">{fmt(row.createdAt)}</td>
                  <td className="col-actions" data-label="Actions">
                    <RowActions>
                      <IconButton
                        icon={Send}
                        label="Invite provider"
                        tone="view"
                        disabled={!!actionBusy}
                        onClick={() => runAction(row.id, 'invite-provider')}
                      />
                      <IconButton
                        icon={Eye}
                        label="Review"
                        tone="history"
                        disabled={!!actionBusy}
                        onClick={() => runAction(row.id, 'review')}
                      />
                      <IconButton
                        icon={Inbox}
                        label="Request changes"
                        tone="history"
                        disabled={!!actionBusy}
                        onClick={() => runAction(row.id, 'request-changes')}
                      />
                      <IconButton
                        icon={Eye}
                        label="Approve"
                        tone="activate"
                        disabled={!!actionBusy}
                        onClick={() => runAction(row.id, 'approve')}
                      />
                      <IconButton
                        icon={ArrowRightLeft}
                        label="Convert"
                        tone="activate"
                        disabled={!!actionBusy}
                        onClick={() => runAction(row.id, 'convert')}
                      />
                    </RowActions>
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
                      {['PROVIDER', 'ORGANIZATION', 'PRACTICE', 'FACILITY', 'COMBINED'].map(t => (
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
                  {(draft.intakeType === 'PROVIDER' || draft.intakeType === 'COMBINED') && (
                    <>
                      <label>First name<input value={draft.firstName} onChange={e => setDraft(d => ({ ...d, firstName: e.target.value }))} /></label>
                      <label>Last name<input value={draft.lastName} onChange={e => setDraft(d => ({ ...d, lastName: e.target.value }))} /></label>
                      <label>Provider NPI<input value={draft.providerNpi} onChange={e => setDraft(d => ({ ...d, providerNpi: e.target.value }))} /></label>
                      <label>Specialty
                        <SpecialtySelect
                          value={draft.primarySpecialtyId}
                          onChange={(v, opt) => setDraft(d => ({
                            ...d,
                            primarySpecialtyId: v || '',
                            primarySpecialty: opt?.name || opt?.label || ''
                          }))}
                        />
                      </label>
                      <label>License type
                        <LicenseTypeSelect
                          value={draft.licenseTypeId}
                          onChange={(v, opt) => setDraft(d => ({
                            ...d,
                            licenseTypeId: v || '',
                            licenseTypeName: opt?.name || opt?.label || ''
                          }))}
                        />
                      </label>
                      <label>License number<input value={draft.licenseNumber} onChange={e => setDraft(d => ({ ...d, licenseNumber: e.target.value }))} /></label>
                      <label>License state
                        <StateSelect
                          value={draft.usStateId}
                          onChange={(v, opt) => setDraft(d => ({
                            ...d,
                            usStateId: v || '',
                            licenseState: opt?.abbreviation || ''
                          }))}
                        />
                      </label>
                    </>
                  )}
                  {(draft.intakeType === 'PRACTICE' || draft.intakeType === 'COMBINED') && (
                    <label>Practice name<input value={draft.practiceName} onChange={e => setDraft(d => ({ ...d, practiceName: e.target.value }))} /></label>
                  )}
                  {(draft.intakeType === 'FACILITY' || draft.intakeType === 'COMBINED') && (
                    <label className="span-2">Facility name<input value={draft.facilityName} onChange={e => setDraft(d => ({ ...d, facilityName: e.target.value }))} /></label>
                  )}
                  <label>Address state
                    <StateAbbrevSelect
                      value={draft.addressState}
                      onChange={(v) => setDraft(d => ({ ...d, addressState: v || '' }))}
                    />
                  </label>
                </>
              )}
              {step === 3 && (
                <div className="span-2 intake-review">
                  <b>{draft.subjectName}</b>
                  <span>Type: {draft.intakeType}</span>
                  <span>Contact: {draft.contactName} · {draft.contactEmail}</span>
                  {draft.providerNpi && <span>NPI: {draft.providerNpi}</span>}
                  {draft.primarySpecialty && <span>Specialty: {draft.primarySpecialty}</span>}
                  {draft.licenseTypeName && <span>License: {draft.licenseTypeName}</span>}
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
