import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const emptyProvider = {
  firstName: '', middleName: '', lastName: '', preferredName: '', professionalTitle: '',
  email: '', phone: '', npi: '', taxonomyCode: '', primarySpecialty: '', secondarySpecialty: '',
  professionalType: '', address: { line1: '', city: '', state: '', postalCode: '' },
  licenses: [{ type: '', number: '', state: '', issuedAt: '', expiresAt: '', status: 'ACTIVE' }],
  education: [{ school: '', degree: '', graduationYear: '' }],
  boardCertifications: [{ name: '', year: '' }],
  affiliations: [{ organizationName: '', practiceName: '', facilityName: '', affiliationType: '', effectiveDate: '' }],
  historyNotes: ''
};

export default function ProviderIntakeDetail() {
  const { id } = useParams();
  const [intake, setIntake] = useState(null);
  const [form, setForm] = useState(emptyProvider);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [section, setSection] = useState('identity');

  async function load() {
    setError('');
    try {
      const row = (await api.get(`/provider-portal/intakes/${id}`)).data;
      setIntake(row);
      const p = row.payload?.provider || row.payload || {};
      setForm({
        ...emptyProvider,
        ...p,
        address: { ...emptyProvider.address, ...(p.address || {}) },
        licenses: p.licenses?.length ? p.licenses : emptyProvider.licenses,
        education: p.education?.length ? p.education : emptyProvider.education,
        boardCertifications: p.boardCertifications?.length ? p.boardCertifications : emptyProvider.boardCertifications,
        affiliations: p.affiliations?.length ? p.affiliations : emptyProvider.affiliations
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load intake');
    }
  }

  useEffect(() => { load(); }, [id]);

  const editable = intake && ['INVITED', 'IN_PROGRESS', 'CHANGES_REQUESTED', 'DRAFT'].includes(intake.status);

  async function saveDraft() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const row = (await api.patch(`/provider-portal/intakes/${id}/draft`, {
        payload: { provider: form }
      })).data;
      setIntake((prev) => ({ ...prev, ...row }));
      setMessage(`Draft saved${row.lastSavedAt ? ` at ${new Date(row.lastSavedAt).toLocaleString()}` : ''}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not save draft');
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await saveDraft();
      const row = (await api.post(`/provider-portal/intakes/${id}/submit`)).data;
      setIntake((prev) => ({ ...prev, ...row }));
      setMessage('Intake submitted for review');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not submit');
      if (e.response?.data?.missing) setError(`Missing: ${e.response.data.missing.join(', ')}`);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name);
      fd.append('type', 'SUPPORTING');
      fd.append('category', 'intake');
      await api.post(`/provider-portal/intakes/${id}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage('Document uploaded (quarantined until security review)');
      // Refresh documents/status only — do not wipe in-progress form fields.
      const row = (await api.get(`/provider-portal/intakes/${id}`)).data;
      setIntake((prev) => ({ ...prev, ...row, documents: row.documents, events: row.events }));
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function setProvider(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  if (!intake && !error) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <PageHeader
        title={intake?.referenceNo || 'Intake'}
        description={intake?.tenant?.name ? `Requested by ${intake.tenant.name}` : undefined}
        breadcrumbs={[
          { label: 'Provider portal', to: '/provider-portal' },
          { label: 'Intakes', to: '/provider-portal/intakes' },
          { label: intake?.referenceNo || 'Detail' }
        ]}
      />
      {error && <div className="error banner">{error}</div>}
      {message && <div className="banner" style={{ background: '#eef8f1', padding: 12 }}>{message}</div>}
      {intake && (
        <>
          <p>
            Status: <StatusBadge value={intake.status} />
            {intake.lastSavedAt && <span className="muted"> · Last saved {new Date(intake.lastSavedAt).toLocaleString()}</span>}
          </p>
          {intake.reviewerComments && (
            <div className="banner" style={{ background: '#fff8e8', padding: 12, marginBottom: 12 }}>
              Reviewer comments: {intake.reviewerComments}
            </div>
          )}
          {intake.rejectionReason && (
            <div className="error banner">Rejection reason: {intake.rejectionReason}</div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {['identity', 'licenses', 'education', 'affiliations', 'documents', 'timeline'].map((s) => (
              <button key={s} type="button" className={section === s ? 'primary' : 'secondary'} onClick={() => setSection(s)}>
                {s}
              </button>
            ))}
          </div>

          {section === 'identity' && (
            <div className="panel form-grid" style={{ padding: 16 }}>
              <label>First name<input disabled={!editable} value={form.firstName} onChange={(e) => setProvider('firstName', e.target.value)} /></label>
              <label>Middle name<input disabled={!editable} value={form.middleName} onChange={(e) => setProvider('middleName', e.target.value)} /></label>
              <label>Last name<input disabled={!editable} value={form.lastName} onChange={(e) => setProvider('lastName', e.target.value)} /></label>
              <label>Preferred name<input disabled={!editable} value={form.preferredName} onChange={(e) => setProvider('preferredName', e.target.value)} /></label>
              <label>Title<input disabled={!editable} value={form.professionalTitle} onChange={(e) => setProvider('professionalTitle', e.target.value)} /></label>
              <label>Email<input disabled={!editable} type="email" value={form.email} onChange={(e) => setProvider('email', e.target.value)} /></label>
              <label>Phone<input disabled={!editable} value={form.phone} onChange={(e) => setProvider('phone', e.target.value)} /></label>
              <label>NPI<input disabled={!editable} value={form.npi} onChange={(e) => setProvider('npi', e.target.value)} /></label>
              <label>Taxonomy<input disabled={!editable} value={form.taxonomyCode} onChange={(e) => setProvider('taxonomyCode', e.target.value)} /></label>
              <label>Primary specialty<input disabled={!editable} value={form.primarySpecialty} onChange={(e) => setProvider('primarySpecialty', e.target.value)} /></label>
              <label>Secondary specialty<input disabled={!editable} value={form.secondarySpecialty} onChange={(e) => setProvider('secondarySpecialty', e.target.value)} /></label>
              <label>Provider type<input disabled={!editable} value={form.professionalType} onChange={(e) => setProvider('professionalType', e.target.value)} /></label>
              <label className="span-2">Mailing address line 1
                <input disabled={!editable} value={form.address.line1} onChange={(e) => setForm({ ...form, address: { ...form.address, line1: e.target.value } })} />
              </label>
              <label>City<input disabled={!editable} value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} /></label>
              <label>State<input disabled={!editable} value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} /></label>
              <label>Postal code<input disabled={!editable} value={form.address.postalCode} onChange={(e) => setForm({ ...form, address: { ...form.address, postalCode: e.target.value } })} /></label>
            </div>
          )}

          {section === 'licenses' && (
            <div className="panel" style={{ padding: 16 }}>
              {(form.licenses || []).map((lic, idx) => (
                <div key={idx} className="form-grid" style={{ marginBottom: 12 }}>
                  <label>Type<input disabled={!editable} value={lic.type || ''} onChange={(e) => {
                    const licenses = [...form.licenses]; licenses[idx] = { ...lic, type: e.target.value }; setForm({ ...form, licenses });
                  }} /></label>
                  <label>Number<input disabled={!editable} value={lic.number || ''} onChange={(e) => {
                    const licenses = [...form.licenses]; licenses[idx] = { ...lic, number: e.target.value }; setForm({ ...form, licenses });
                  }} /></label>
                  <label>State<input disabled={!editable} value={lic.state || ''} onChange={(e) => {
                    const licenses = [...form.licenses]; licenses[idx] = { ...lic, state: e.target.value }; setForm({ ...form, licenses });
                  }} /></label>
                  <label>Expires<input disabled={!editable} type="date" value={(lic.expiresAt || '').slice(0, 10)} onChange={(e) => {
                    const licenses = [...form.licenses]; licenses[idx] = { ...lic, expiresAt: e.target.value }; setForm({ ...form, licenses });
                  }} /></label>
                </div>
              ))}
              {editable && (
                <button type="button" className="secondary" onClick={() => setForm({
                  ...form,
                  licenses: [...form.licenses, { type: '', number: '', state: '', issuedAt: '', expiresAt: '', status: 'ACTIVE' }]
                })}>Add license</button>
              )}
            </div>
          )}

          {section === 'education' && (
            <div className="panel form-grid" style={{ padding: 16 }}>
              <label className="span-2">Professional history / notes
                <textarea disabled={!editable} rows={4} value={form.historyNotes || ''} onChange={(e) => setProvider('historyNotes', e.target.value)} />
              </label>
              <p className="muted span-2">Education and board details are stored as intake answers until a dedicated professional-history phase converts them.</p>
              {(form.education || []).map((ed, idx) => (
                <React.Fragment key={idx}>
                  <label>School<input disabled={!editable} value={ed.school || ''} onChange={(e) => {
                    const education = [...form.education]; education[idx] = { ...ed, school: e.target.value }; setForm({ ...form, education });
                  }} /></label>
                  <label>Degree<input disabled={!editable} value={ed.degree || ''} onChange={(e) => {
                    const education = [...form.education]; education[idx] = { ...ed, degree: e.target.value }; setForm({ ...form, education });
                  }} /></label>
                  <label>Graduation year<input disabled={!editable} value={ed.graduationYear || ''} onChange={(e) => {
                    const education = [...form.education]; education[idx] = { ...ed, graduationYear: e.target.value }; setForm({ ...form, education });
                  }} /></label>
                </React.Fragment>
              ))}
            </div>
          )}

          {section === 'affiliations' && (
            <div className="panel" style={{ padding: 16 }}>
              <p className="muted">Requested affiliations are captured for review. You cannot select records from other clients.</p>
              {(form.affiliations || []).map((aff, idx) => (
                <div key={idx} className="form-grid" style={{ marginBottom: 12 }}>
                  <label>Organization<input disabled={!editable} value={aff.organizationName || ''} onChange={(e) => {
                    const affiliations = [...form.affiliations]; affiliations[idx] = { ...aff, organizationName: e.target.value }; setForm({ ...form, affiliations });
                  }} /></label>
                  <label>Practice<input disabled={!editable} value={aff.practiceName || ''} onChange={(e) => {
                    const affiliations = [...form.affiliations]; affiliations[idx] = { ...aff, practiceName: e.target.value }; setForm({ ...form, affiliations });
                  }} /></label>
                  <label>Facility<input disabled={!editable} value={aff.facilityName || ''} onChange={(e) => {
                    const affiliations = [...form.affiliations]; affiliations[idx] = { ...aff, facilityName: e.target.value }; setForm({ ...form, affiliations });
                  }} /></label>
                  <label>Type<input disabled={!editable} value={aff.affiliationType || ''} onChange={(e) => {
                    const affiliations = [...form.affiliations]; affiliations[idx] = { ...aff, affiliationType: e.target.value }; setForm({ ...form, affiliations });
                  }} /></label>
                </div>
              ))}
            </div>
          )}

          {section === 'documents' && (
            <div className="panel" style={{ padding: 16 }}>
              {editable && (
                <label>
                  Upload supporting document (PDF/JPG/PNG, max 20 MB)
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={uploading} onChange={uploadFile} />
                </label>
              )}
              <ul>
                {(intake.documents || []).map((d) => (
                  <li key={d.id}>
                    {d.title} — {d.securityStatus}
                    {d.securityStatus === 'AVAILABLE' ? (
                      <> · <a href="#" onClick={async (e) => {
                        e.preventDefault();
                        const r = await api.get(`/provider-portal/documents/${d.id}/file`, { responseType: 'blob' });
                        const url = URL.createObjectURL(r.data);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = d.originalName || d.title;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}>Download</a></>
                    ) : (
                      <span className="muted"> · Download unavailable until security release</span>
                    )}
                  </li>
                ))}
                {!intake.documents?.length && <li className="muted">No documents uploaded</li>}
              </ul>
              <p className="muted">Uploaded files remain quarantined until GPA security review. Malware scanning is not automated; quarantined files cannot be re-downloaded.</p>
            </div>
          )}

          {section === 'timeline' && (
            <div className="panel table-panel">
              <div className="table-scroll">
                <table>
                  <thead><tr><th>When</th><th>Action</th></tr></thead>
                  <tbody>
                    {(intake.events || []).map((ev) => (
                      <tr key={ev.id}>
                        <td>{new Date(ev.createdAt).toLocaleString()}</td>
                        <td>{ev.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {editable && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="secondary" disabled={saving} onClick={saveDraft}>{saving ? 'Saving…' : 'Save draft'}</button>
              <button type="button" className="primary" disabled={saving} onClick={submit}>{saving ? 'Submitting…' : 'Submit for review'}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
