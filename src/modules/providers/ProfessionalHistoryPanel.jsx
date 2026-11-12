import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';

const SECTIONS = [
  { key: 'education', label: 'Education', fields: [
    ['institutionName', 'Institution', true],
    ['degreeName', 'Degree'],
    ['fieldOfStudy', 'Field of study'],
    ['startDate', 'Start', 'date'],
    ['endDate', 'End', 'date'],
    ['graduationDate', 'Graduation', 'date'],
    ['country', 'Country'],
    ['state', 'State'],
    ['city', 'City'],
    ['notes', 'Notes']
  ]},
  { key: 'residency', label: 'Residency', fields: [
    ['institutionName', 'Institution', true],
    ['programName', 'Program'],
    ['specialtyName', 'Specialty'],
    ['startDate', 'Start', 'date'],
    ['endDate', 'End', 'date'],
    ['country', 'Country'],
    ['state', 'State'],
    ['city', 'City'],
    ['programDirector', 'Program director'],
    ['notes', 'Notes']
  ]},
  { key: 'fellowship', label: 'Fellowship', fields: [
    ['institutionName', 'Institution', true],
    ['programName', 'Program'],
    ['specialtyName', 'Specialty / subspecialty'],
    ['startDate', 'Start', 'date'],
    ['endDate', 'End', 'date'],
    ['country', 'Country'],
    ['state', 'State'],
    ['city', 'City'],
    ['notes', 'Notes']
  ]},
  { key: 'board_certification', label: 'Board Certifications', fields: [
    ['certifyingBoard', 'Certifying board', true],
    ['specialtyName', 'Specialty'],
    ['certificationNumber', 'Number'],
    ['issueDate', 'Issue date', 'date'],
    ['expirationDate', 'Expiration', 'date'],
    ['doesNotExpire', 'Does not expire', 'checkbox'],
    ['notes', 'Notes']
  ]},
  { key: 'professional_certification', label: 'Professional Certifications', fields: [
    ['certificationName', 'Certification name', true],
    ['certificationTypeName', 'Type'],
    ['issuingOrganization', 'Issuing organization'],
    ['certificateNumber', 'Number'],
    ['issueDate', 'Issue date', 'date'],
    ['expirationDate', 'Expiration', 'date'],
    ['notes', 'Notes']
  ]},
  { key: 'employment', label: 'Employment', fields: [
    ['employerName', 'Employer', true],
    ['employerType', 'Employer type'],
    ['positionTitle', 'Position'],
    ['specialtyOrDept', 'Department'],
    ['startDate', 'Start', 'date'],
    ['endDate', 'End', 'date'],
    ['isCurrent', 'Current employment', 'checkbox'],
    ['country', 'Country'],
    ['state', 'State'],
    ['city', 'City'],
    ['supervisorName', 'Supervisor'],
    ['notes', 'Notes']
  ]},
  { key: 'hospital_affiliation', label: 'Hospital Affiliations', fields: [
    ['hospitalName', 'Hospital / facility name', true],
    ['affiliationType', 'Affiliation type'],
    ['department', 'Department'],
    ['effectiveDate', 'Effective', 'date'],
    ['expirationDate', 'Expiration', 'date'],
    ['privilegeStatus', 'Privilege status'],
    ['notes', 'Notes']
  ]},
  { key: 'malpractice', label: 'Malpractice', fields: [
    ['insuranceCarrier', 'Insurance carrier', true],
    ['policyNumber', 'Policy number'],
    ['coverageType', 'Coverage type'],
    ['perOccurrenceAmount', 'Per-occurrence amount'],
    ['aggregateAmount', 'Aggregate amount'],
    ['effectiveDate', 'Effective', 'date'],
    ['expirationDate', 'Expiration', 'date'],
    ['retroactiveDate', 'Retroactive date', 'date'],
    ['isCurrent', 'Current policy', 'checkbox'],
    ['hasTailCoverage', 'Tail coverage', 'checkbox'],
    ['tailCoverageNotes', 'Tail notes'],
    ['notes', 'Notes']
  ]}
];

function fmt(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
  }
  return String(v);
}

function emptyForm(fields) {
  const o = {};
  fields.forEach(([k, , type]) => {
    o[k] = type === 'checkbox' ? false : '';
  });
  return o;
}

/**
 * Professional history manager for GPA/client provider profile.
 * basePath: /providers/:id/professional-history
 */
export default function ProfessionalHistoryPanel({
  providerId,
  canVerify = true,
  readOnly = false,
  basePathOverride
}) {
  const [tab, setTab] = useState('education');
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const section = SECTIONS.find((s) => s.key === tab) || SECTIONS[0];
  const base = basePathOverride || `/providers/${providerId}/professional-history`;

  async function loadSummary() {
    const r = await api.get(`${base}/summary`);
    setSummary(r.data);
  }

  async function loadSection(key = tab) {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`${base}/${key}`);
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load professional history');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!providerId) return;
    loadSummary().catch(() => {});
    loadSection(tab);
  }, [providerId, tab]);

  function startCreate() {
    setEditing('new');
    setForm(emptyForm(section.fields));
    setMessage('');
  }

  function startEdit(row) {
    const next = emptyForm(section.fields);
    section.fields.forEach(([k, , type]) => {
      const v = row[k];
      if (type === 'date' && v) next[k] = String(v).slice(0, 10);
      else if (type === 'checkbox') next[k] = Boolean(v);
      else next[k] = v == null ? '' : v;
    });
    setEditing(row.id);
    setForm(next);
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = { ...form };
      section.fields.forEach(([k, , type]) => {
        if (type === 'date' && body[k] === '') body[k] = null;
        if (type === 'checkbox') body[k] = Boolean(body[k]);
      });
      if (editing === 'new') await api.post(`${base}/${tab}`, body);
      else await api.patch(`${base}/${tab}/${editing}`, body);
      setEditing(null);
      setMessage('Saved — verification remains pending until an authorized reviewer verifies.');
      await loadSection();
      await loadSummary();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function archive(id) {
    if (!confirm('Archive this record?')) return;
    await api.post(`${base}/${tab}/${id}/archive`);
    await loadSection();
    await loadSummary();
  }

  async function verify(id) {
    setError('');
    try {
      await api.post(`${base}/${tab}/${id}/verify`, {});
      setMessage('Record verified.');
      await loadSection();
      await loadSummary();
    } catch (e) {
      setError(e.response?.data?.error || 'Verification failed');
    }
  }

  async function reject(id) {
    const reason = window.prompt('Rejection reason (required):');
    if (!reason || reason.trim().length < 2) return;
    try {
      await api.post(`${base}/${tab}/${id}/reject`, { reason: reason.trim() });
      await loadSection();
      await loadSummary();
    } catch (e) {
      setError(e.response?.data?.error || 'Reject failed');
    }
  }

  const titleKey = section.fields[0][0];

  return (
    <div className="panel" style={{ padding: 16 }}>
      {summary && (
        <div className="muted" style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <span>Education: {summary.education}</span>
          <span>Residency: {summary.residency}</span>
          <span>Fellowship: {summary.fellowship}</span>
          <span>Board: {summary.boardCertifications}</span>
          <span>Professional certs: {summary.professionalCertifications}</span>
          <span>Current employment: {summary.currentEmployment}</span>
          <span>Active affiliations: {summary.activeHospitalAffiliations}</span>
          <span>Pending verification: {summary.pendingVerification}</span>
          <span>Expired: {summary.expiredRecords}</span>
          {summary.currentMalpracticePolicy && (
            <span>Malpractice: {summary.currentMalpracticePolicy.insuranceCarrier}</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={tab === s.key ? 'primary' : 'secondary'}
            onClick={() => { setEditing(null); setTab(s.key); }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <div className="error banner">{error}</div>}
      {message && <div className="banner" style={{ background: '#eef8f1', padding: 12 }}>{message}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{section.label}</h3>
        {!readOnly && (
          <button type="button" className="primary" onClick={startCreate}>Add</button>
        )}
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && !rows.length && !editing && (
        <p className="muted">No {section.label.toLowerCase()} records yet.</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Verification</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row[titleKey] || row.hospitalName || 'Record'}</strong>
                    {row.rejectionReason && (
                      <div className="muted">Rejected: {row.rejectionReason}</div>
                    )}
                  </td>
                  <td><StatusBadge value={row.verificationStatus} /></td>
                  <td><StatusBadge value={row.recordStatus || row.status || 'ACTIVE'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!readOnly && (
                        <button type="button" className="secondary" onClick={() => startEdit(row)}>Edit</button>
                      )}
                      {!readOnly && canVerify && (
                        <button type="button" className="secondary" onClick={() => archive(row.id)}>Archive</button>
                      )}
                      {canVerify && row.verificationStatus === 'PENDING_REVIEW' && (
                        <>
                          <button type="button" className="primary" onClick={() => verify(row.id)}>Verify</button>
                          <button type="button" className="secondary" onClick={() => reject(row.id)}>Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="form-grid" style={{ marginTop: 16 }}>
          {section.fields.map(([key, label, typeOrReq]) => {
            const type = typeOrReq === true ? 'text' : (typeOrReq || 'text');
            const required = typeOrReq === true;
            if (type === 'checkbox') {
              return (
                <label key={key} className="span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(form[key])}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  />{' '}
                  {label}
                </label>
              );
            }
            return (
              <label key={key} className={key === 'notes' ? 'span-2' : undefined}>
                {label}{required ? ' *' : ''}
                <input
                  type={type === 'date' ? 'date' : 'text'}
                  value={form[key] ?? ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            );
          })}
          <div className="span-2" style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="primary" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
          </div>
          <p className="muted span-2">
            Saving does not verify the record. Only authorized reviewers can mark history as verified.
            Quarantined documents are not trusted evidence.
          </p>
        </div>
      )}
    </div>
  );
}
