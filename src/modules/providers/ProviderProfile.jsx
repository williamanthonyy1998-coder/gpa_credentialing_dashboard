import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, Bell, Eye, FileText, FolderOpen, Pencil, Plus, Search, Settings, Share2, X
} from 'lucide-react';
import api from '../../api/client';
import DirectoryProfileShell from '../../components/layout/DirectoryProfileShell';
import InfoField from '../../components/common/InfoField';
import MaskedField from '../../components/common/MaskedField';
import StatusBadge from '../../components/common/StatusBadge';
import { currentListPath, saveListReturn } from '../../navigation/listReturn';

const STEPS = [
  { key: 'personal', label: 'Personal & Professional' },
  { key: 'licenses', label: 'Licenses' },
  { key: 'affiliations', label: 'Affiliations' },
  { key: 'enrollments', label: 'Enrollments & Cases' },
  { key: 'credentials', label: 'Credentials & Documents' },
  { key: 'activity', label: 'Activity' }
];

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function providerName(d) {
  if (!d) return '';
  return [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ').trim();
}

function attentionFromDocs(docs) {
  const expiringSoon = (docs || []).filter(d => d.attention === 'EXPIRING_SOON' || (d.expiresAt && new Date(d.expiresAt) > new Date() && new Date(d.expiresAt) < new Date(Date.now() + 90 * 86400000)));
  return {
    counts: { expiringSoon: expiringSoon.length },
    expiringSoon: expiringSoon.slice(0, 5).map(d => ({ id: d.id, title: d.title, expiresAt: d.expiresAt }))
  };
}

export default function ProviderProfile() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const location = useLocation();
  const isNew = id === 'new';
  const stepKey = params.get('step') || 'personal';
  const stepIndex = Math.max(0, STEPS.findIndex(s => s.key === stepKey));

  const [allProviders, setAllProviders] = useState([]);
  const [providerId, setProviderId] = useState(isNew ? null : id);
  const [detail, setDetail] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [cases, setCases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [attention, setAttention] = useState({ counts: {}, expiringSoon: [] });
  const [affTab, setAffTab] = useState('organizations');
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const dirty = !!editModal;

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function setStep(key) {
    if (dirty && !window.confirm('You have unsaved changes. Leave this section?')) return;
    setEditModal(null);
    setParams({ step: key });
  }

  async function loadProviderList() {
    const r = await api.get('/providers', { params: { limit: 100 } });
    setAllProviders(r.data);
  }

  async function loadDetail(pid) {
    if (!pid) return;
    const d = (await api.get(`/providers/${pid}`)).data;
    setDetail(d);
    setProviderId(d.id);
    const [enr, caseRows, creds] = await Promise.all([
      api.get('/enrollments', { params: { providerId: pid, limit: 100 } }).then(r => r.data?.data ?? r.data).catch(() => []),
      api.get('/cases', { params: { limit: 100 } }).then(r => (r.data || []).filter(c => c.providerId === pid)).catch(() => []),
      api.get('/credentials', { params: { providerId: pid, limit: 100 } }).then(r => r.data).catch(() => [])
    ]);
    setEnrollments(Array.isArray(enr) ? enr : []);
    setCases(caseRows);
    setDocuments(creds);
    setAttention(attentionFromDocs(creds));
  }

  useEffect(() => {
    loadProviderList().catch(e => setError(e.response?.data?.error || 'Could not load providers.'));
    if (!isNew) loadDetail(id).catch(e => setError(e.response?.data?.error || 'Could not load provider.'));
  }, [id]);

  const completion = useMemo(() => {
    if (detail?.completion?.percent != null) return Number(detail.completion.percent);
    const d = detail || {};
    const checks = [
      d.firstName && d.lastName,
      d.npi,
      d.dateOfBirth,
      d.email,
      d.primarySpecialty,
      d.taxonomyCode,
      d.professionalType,
      (d.licenses || []).length > 0
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [detail]);

  const addr = detail?.address || {};
  const displayName = providerName(detail) || (isNew ? 'New Provider' : 'Provider');
  const orgAffiliations = detail?.organizations || [];
  const practiceAffiliations = detail?.practices || [];
  const facilityAffiliations = detail?.facilities || [];
  const licenses = detail?.licenses || [];

  async function saveProvider(body) {
    setSaving(true);
    setError('');
    try {
      let saved;
      if (providerId) saved = (await api.patch(`/providers/${providerId}`, body)).data;
      else {
        if (!body.firstName || !body.lastName) throw new Error('First and last name are required.');
        saved = (await api.post('/providers', body)).data;
        setProviderId(saved.id);
        nav(`/providers/${saved.id}/profile?step=${stepKey}`, { replace: true });
      }
      await loadDetail(saved.id || providerId);
      await loadProviderList();
      setEditModal(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function assignAffiliation(kind, row) {
    const pid = providerId;
    if (!pid) {
      setError('Save provider personal information first.');
      return;
    }
    try {
      if (kind === 'practice') {
        await api.post('/directory/provider-practices', { providerId: pid, practiceId: row.id });
      } else if (kind === 'facility') {
        await api.post('/directory/provider-facilities', { providerId: pid, facilityId: row.id, approvalStatus: 'Pending' });
      } else {
        await api.post('/providerOrganizations', {
          providerId: pid,
          organizationId: row.id,
          status: 'ACTIVE',
          effectiveAt: new Date().toISOString()
        });
      }
      await loadDetail(pid);
      setEditModal(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not add affiliation.');
    }
  }

  async function removeFacilityAff(facilityId) {
    if (!confirm('Remove facility affiliation?')) return;
    await api.delete(`/directory/provider-facilities/${providerId}/${facilityId}`);
    await loadDetail(providerId);
  }

  async function removeOrgAff(affiliationId) {
    if (!confirm('Remove organization affiliation?')) return;
    await api.delete(`/providerOrganizations/${affiliationId}`);
    await loadDetail(providerId);
  }

  async function saveLicense(form) {
    const pid = providerId;
    if (!pid) {
      setError('Save provider first.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/licenses', {
        providerId: pid,
        type: form.type,
        number: form.number || null,
        state: form.state || null,
        issuedAt: form.issuedAt ? new Date(`${form.issuedAt}T12:00:00`).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T12:00:00`).toISOString() : null,
        status: form.status || 'RECEIVED'
      });
      await loadDetail(pid);
      setEditModal(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not save license.');
    } finally {
      setSaving(false);
    }
  }

  async function runAffiliationSearch() {
    const q = searchQ.trim();
    if (affTab === 'organizations') {
      const r = await api.get('/organizations', { params: { q, limit: 20 } });
      setSearchHits(r.data);
    } else if (affTab === 'practices') {
      const r = await api.get('/practices', { params: { q, limit: 20 } });
      setSearchHits(r.data);
    } else {
      const r = await api.get('/facilities', { params: { q, limit: 20 } });
      setSearchHits(r.data);
    }
  }

  return (
    <DirectoryProfileShell
      entityType="PROVIDER"
      title={displayName}
      status={detail?.status || 'ACTIVE'}
      npi={detail?.npi}
      completion={completion}
      breadcrumb={[
        { label: 'Directory', to: '/organizations' },
        { label: 'Providers', to: '/providers' },
        { label: displayName },
        { label: STEPS[stepIndex]?.label || 'Personal & Professional' }
      ]}
      listKey="providers"
      backLabel="Back to Providers"
      backFallback="/providers"
      backHints={location.state || {}}
      dirty={dirty}
      providers={allProviders}
      selectedProviderId={providerId || ''}
      onSelectProvider={(pid) => { if (pid) nav(`/providers/${pid}/profile?step=${stepKey}`); }}
      steps={STEPS}
      activeStepKey={stepKey}
      onStepChange={setStep}
      rightMode="provider"
      attention={attention}
      onRequestInfo={() => alert('Request provider info — notification workflow will deliver this in Phase 7.')}
      quickActions={[
        { key: 'licenses', label: 'Licenses', icon: FileText, onClick: () => setStep('licenses') },
        { key: 'credentials', label: 'Credentials', icon: FolderOpen, onClick: () => nav('/credentials') },
        { key: 'enrollments', label: 'Enrollments', icon: FileText, onClick: () => nav('/enrollments') },
        {
          key: 'share',
          label: 'Share',
          icon: Share2,
          onClick: () => { navigator.clipboard?.writeText(window.location.href); alert('Provider profile link copied.'); }
        },
        { key: 'alerts', label: 'Alerts', icon: Bell, onClick: () => setStep('credentials') },
        { key: 'activity', label: 'Activity', icon: Activity, onClick: () => setStep('activity') },
        { key: 'settings', label: 'Settings', icon: Settings, onClick: () => setStep('personal') }
      ]}
      stepIndex={stepIndex}
      stepCount={STEPS.length}
      stepLabel={STEPS[stepIndex]?.label}
      onPrev={() => stepIndex > 0 && setStep(STEPS[stepIndex - 1].key)}
      onNext={() => {
        if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1].key);
        else nav('/providers');
      }}
    >
      {error && <div className="error banner">{error}</div>}

      {stepKey === 'personal' && (
        <>
          <SectionHead title="IDENTITY" onEdit={() => setEditModal('personal')} />
          <div className="info-grid">
            <InfoField label="FIRST NAME" value={detail?.firstName} />
            <InfoField label="MIDDLE NAME" value={detail?.middleName} />
            <InfoField label="LAST NAME" value={detail?.lastName} />
            <InfoField label="NPI" value={detail?.npi} />
            <InfoField label="DATE OF BIRTH" value={fmtDate(detail?.dateOfBirth)} />
            <InfoField label="PLACE OF BIRTH" value={detail?.placeOfBirth} />
            <MaskedField label="SSN" value={detail?.ssn} />
            <InfoField label="CITIZENSHIP" value={detail?.citizenship} />
            <InfoField label="GENDER" value={detail?.gender} />
            <InfoField label="STATUS" value={detail?.status} />
          </div>
          <SectionHead title="CONTACT" onEdit={() => setEditModal('contact')} />
          <div className="info-grid">
            <InfoField label="EMAIL" value={detail?.email} className="span-2" />
            <InfoField label="HOME PHONE" value={detail?.homePhone} />
            <InfoField label="WORK PHONE" value={detail?.workPhone} />
            <InfoField label="STREET" value={addr.street} />
            <InfoField label="CITY" value={addr.city} />
            <InfoField label="STATE" value={addr.state} />
            <InfoField label="ZIP" value={addr.zip} />
          </div>
          <SectionHead title="PROFESSIONAL" onEdit={() => setEditModal('professional')} />
          <div className="info-grid">
            <InfoField label="PRIMARY SPECIALTY" value={detail?.primarySpecialty} />
            <InfoField label="SECONDARY SPECIALTY" value={detail?.secondarySpecialty} />
            <InfoField label="TAXONOMY CODE" value={detail?.taxonomyCode} />
            <InfoField label="PROFESSIONAL TYPE" value={detail?.professionalType} />
            <InfoField label="SUPERVISOR PHYSICIAN" value={detail?.supervisorName} className="span-2" />
          </div>
        </>
      )}

      {stepKey === 'licenses' && (
        <>
          <div className="section-head">
            <h2>LICENSES & CERTIFICATIONS</h2>
            <button type="button" className="icon-round" onClick={() => setEditModal('license')}><Plus size={14} /></button>
          </div>
          <p className="muted" style={{ marginBottom: 12 }}>
            Manage licenses in the profile or open the{' '}
            <button type="button" className="text-link" onClick={() => nav('/licenses')}>licenses workspace</button>.
          </p>
          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr><th>S. NO</th><th>TYPE</th><th>NUMBER</th><th>STATE</th><th>EXPIRES</th><th>STATUS</th></tr>
              </thead>
              <tbody>
                {licenses.map((lic, i) => (
                  <tr key={lic.id}>
                    <td>{i + 1}</td>
                    <td className="cell-strong">{lic.type}</td>
                    <td>{lic.number || '—'}</td>
                    <td>{lic.state || '—'}</td>
                    <td>{fmtDate(lic.expiresAt)}</td>
                    <td><StatusBadge value={lic.status} /></td>
                  </tr>
                ))}
                {!licenses.length && <tr><td colSpan="6" className="table-empty">No licenses on file. Add a license or use the licenses list.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stepKey === 'affiliations' && (
        <>
          <div className="section-head">
            <h2>AFFILIATIONS</h2>
            <button type="button" className="icon-round" onClick={() => { setEditModal('affiliation'); setSearchHits([]); setSearchQ(''); }}><Plus size={14} /></button>
          </div>
          <div className="tab-row">
            <button type="button" className={`tab-btn ${affTab === 'organizations' ? 'active' : ''}`} onClick={() => setAffTab('organizations')}>Organizations</button>
            <button type="button" className={`tab-btn ${affTab === 'practices' ? 'active' : ''}`} onClick={() => setAffTab('practices')}>Practices</button>
            <button type="button" className={`tab-btn ${affTab === 'facilities' ? 'active' : ''}`} onClick={() => setAffTab('facilities')}>Facilities</button>
          </div>
          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>S. NO</th>
                  <th>NAME</th>
                  <th>ROLE / STATUS</th>
                  <th>EFFECTIVE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {affTab === 'organizations' && orgAffiliations.map((a, i) => (
                  <tr key={a.id}>
                    <td>{i + 1}</td>
                    <td className="cell-strong">{a.organization?.legalName || '—'}</td>
                    <td>{a.affiliationTitle || a.status || '—'}</td>
                    <td>{fmtDate(a.effectiveAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-round" title="View organization" onClick={() => nav(`/organizations/${a.organizationId}/overview`)}><Eye size={14} /></button>
                        <button className="small-action danger-text" onClick={() => removeOrgAff(a.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {affTab === 'practices' && practiceAffiliations.map((a, i) => (
                  <tr key={`${a.providerId}-${a.practiceId}`}>
                    <td>{i + 1}</td>
                    <td className="cell-strong">{a.practice?.name || '—'}</td>
                    <td>{a.affiliationTitle || '—'}</td>
                    <td>{fmtDate(a.effectiveAt)}</td>
                    <td>
                      <button className="icon-round" title="View practice" onClick={() => nav(`/practices/${a.practiceId}/profile`)}><Eye size={14} /></button>
                    </td>
                  </tr>
                ))}
                {affTab === 'facilities' && facilityAffiliations.map((a, i) => (
                  <tr key={`${a.providerId}-${a.facilityId}`}>
                    <td>{i + 1}</td>
                    <td className="cell-strong">{a.facility?.name || '—'}</td>
                    <td>{a.approvalStatus || '—'}</td>
                    <td>{fmtDate(a.effectiveAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-round" title="View facility" onClick={() => nav(`/facilities/${a.facilityId}/profile`)}><Eye size={14} /></button>
                        <button className="small-action danger-text" onClick={() => removeFacilityAff(a.facilityId)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {affTab === 'organizations' && !orgAffiliations.length && <tr><td colSpan="5" className="table-empty">No organization affiliations.</td></tr>}
                {affTab === 'practices' && !practiceAffiliations.length && <tr><td colSpan="5" className="table-empty">No practice affiliations.</td></tr>}
                {affTab === 'facilities' && !facilityAffiliations.length && <tr><td colSpan="5" className="table-empty">No facility affiliations.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stepKey === 'enrollments' && (
        <>
          <div className="section-head"><h2>ENROLLMENTS</h2></div>
          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr><th>APPLICATION</th><th>PAYER / PLAN</th><th>STATUS</th><th>SUBMITTED</th></tr>
              </thead>
              <tbody>
                {enrollments.map(e => (
                  <tr key={e.id}>
                    <td className="cell-strong">{e.applicationNo}</td>
                    <td>{e.payerPlan?.payer?.name || e.payerPlan?.name || '—'}</td>
                    <td><StatusBadge value={e.status} /></td>
                    <td>{fmtDate(e.submittedAt || e.createdAt)}</td>
                  </tr>
                ))}
                {!enrollments.length && <tr><td colSpan="4" className="table-empty">No enrollments linked to this provider.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="section-head" style={{ marginTop: 24 }}><h2>CREDENTIALING CASES</h2></div>
          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr><th>CASE #</th><th>STATUS</th><th>DUE</th><th>PRACTICE</th></tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.id}>
                    <td className="cell-strong">{c.caseNumber}</td>
                    <td><StatusBadge value={c.status} /></td>
                    <td>{fmtDate(c.dueAt)}</td>
                    <td>{c.practice?.name || '—'}</td>
                  </tr>
                ))}
                {!cases.length && <tr><td colSpan="4" className="table-empty">No credentialing cases for this provider.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            <button type="button" className="text-link" onClick={() => nav('/enrollments')}>Open enrollments</button>
            {' · '}
            <button type="button" className="text-link" onClick={() => nav('/cases')}>Open cases</button>
          </p>
        </>
      )}

      {stepKey === 'credentials' && (
        <>
          <div className="section-head"><h2>CREDENTIALS & DOCUMENTS</h2></div>
          <p className="muted" style={{ marginBottom: 12 }}>
            View the full credential library in{' '}
            <button type="button" className="text-link" onClick={() => nav('/credentials')}>Credentials Center</button>
            {' or '}
            <button type="button" className="text-link" onClick={() => nav('/documents')}>documents list</button>.
          </p>
          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr><th>TITLE</th><th>TYPE</th><th>STATUS</th><th>EXPIRES</th></tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td className="cell-strong">{doc.title}</td>
                    <td>{doc.type}</td>
                    <td><StatusBadge value={doc.status} /></td>
                    <td>{fmtDate(doc.expiresAt)}</td>
                  </tr>
                ))}
                {!documents.length && <tr><td colSpan="4" className="table-empty">No documents linked to this provider.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stepKey === 'activity' && (
        <>
          <div className="section-head"><h2>ACTIVITY & AUDIT</h2></div>
          <p className="muted" style={{ marginBottom: 16 }}>
            Credentialing changes, affiliation updates, and document events for this provider are recorded in the system audit log.
          </p>
          <div className="dir-center-actions">
            <button type="button" className="primary" onClick={() => {
              saveListReturn('providers', currentListPath(`/providers/${providerId || id}/profile`, `?step=activity`));
              nav('/audit');
            }}>
              <Activity size={16} style={{ marginRight: 6 }} />
              Open audit log
            </button>
          </div>
        </>
      )}

      {editModal && (
        <EditModal title={modalTitle(editModal)} onClose={() => setEditModal(null)} saving={saving}>
          {(editModal === 'personal' || editModal === 'contact' || editModal === 'professional') && (
            <ProviderForm detail={detail} addr={addr} mode={editModal} onSave={saveProvider} saving={saving} />
          )}
          {editModal === 'license' && <LicenseForm onSave={saveLicense} saving={saving} />}
          {editModal === 'affiliation' && (
            <div style={{ padding: 4 }}>
              <p className="muted" style={{ marginBottom: 12 }}>Assign an existing {affTab.slice(0, -1)} — do not create duplicate directory records.</p>
              <div className="table-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={`Search ${affTab}`} />
                </div>
                <button type="button" className="secondary" onClick={runAffiliationSearch}>Search</button>
              </div>
              <div className="provider-search-results">
                {searchHits.map(row => (
                  <div key={row.id} className="provider-search-row">
                    <div>
                      <b>{row.legalName || row.name || providerName(row)}</b>
                      {row.npi ? <span>NPI {row.npi}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="small-action"
                      onClick={() => assignAffiliation(
                        affTab === 'organizations' ? 'organization' : affTab === 'practices' ? 'practice' : 'facility',
                        row
                      )}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </EditModal>
      )}
    </DirectoryProfileShell>
  );
}

function modalTitle(editModal) {
  if (editModal === 'personal') return 'Personal information';
  if (editModal === 'contact') return 'Contact information';
  if (editModal === 'professional') return 'Professional information';
  if (editModal === 'license') return 'Add license';
  if (editModal === 'affiliation') return 'Assign affiliation';
  return String(editModal);
}

function SectionHead({ title, onEdit }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {onEdit && <button type="button" className="icon-round" onClick={onEdit} aria-label="Edit"><Pencil size={14} /></button>}
    </div>
  );
}

function EditModal({ title, children, onClose, saving }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="record-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">EDIT</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {saving && <div className="muted" style={{ padding: '0 23px 16px' }}>Saving…</div>}
      </div>
    </div>
  );
}

function ProviderForm({ detail, addr, mode, onSave, saving }) {
  const [form, setForm] = useState({
    firstName: detail?.firstName || '',
    middleName: detail?.middleName || '',
    lastName: detail?.lastName || '',
    npi: detail?.npi || '',
    dateOfBirth: detail?.dateOfBirth ? String(detail.dateOfBirth).slice(0, 10) : '',
    placeOfBirth: detail?.placeOfBirth || '',
    ssn: detail?.ssn || '',
    citizenship: detail?.citizenship || '',
    gender: detail?.gender || '',
    email: detail?.email || '',
    homePhone: detail?.homePhone || '',
    workPhone: detail?.workPhone || '',
    street: addr.street || '',
    city: addr.city || '',
    state: addr.state || '',
    zip: addr.zip || '',
    primarySpecialty: detail?.primarySpecialty || '',
    secondarySpecialty: detail?.secondarySpecialty || '',
    taxonomyCode: detail?.taxonomyCode || '',
    professionalType: detail?.professionalType || '',
    supervisorName: detail?.supervisorName || '',
    status: detail?.status || 'ACTIVE'
  });

  function submit(e) {
    e.preventDefault();
    const body = {
      status: form.status
    };
    if (mode === 'personal') {
      Object.assign(body, {
        firstName: form.firstName,
        middleName: form.middleName || null,
        lastName: form.lastName,
        npi: form.npi || null,
        dateOfBirth: form.dateOfBirth ? new Date(`${form.dateOfBirth}T12:00:00`).toISOString() : null,
        placeOfBirth: form.placeOfBirth || null,
        ssn: form.ssn || null,
        citizenship: form.citizenship || null,
        gender: form.gender || null
      });
    } else if (mode === 'contact') {
      Object.assign(body, {
        email: form.email || null,
        homePhone: form.homePhone || null,
        workPhone: form.workPhone || null,
        address: {
          street: form.street || '', city: form.city || '', state: form.state || '', zip: form.zip || ''
        }
      });
    } else {
      Object.assign(body, {
        primarySpecialty: form.primarySpecialty || null,
        secondarySpecialty: form.secondarySpecialty || null,
        taxonomyCode: form.taxonomyCode || null,
        professionalType: form.professionalType || null,
        supervisorName: form.supervisorName || null
      });
    }
    onSave(body);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {mode === 'personal' && (
        <>
          <label>First Name<input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></label>
          <label>Middle Name<input value={form.middleName} onChange={e => setForm({ ...form, middleName: e.target.value })} /></label>
          <label>Last Name<input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></label>
          <label>NPI<input value={form.npi} onChange={e => setForm({ ...form, npi: e.target.value })} /></label>
          <label>Date of Birth<input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></label>
          <label>Place of Birth<input value={form.placeOfBirth} onChange={e => setForm({ ...form, placeOfBirth: e.target.value })} /></label>
          <label>SSN<input value={form.ssn} onChange={e => setForm({ ...form, ssn: e.target.value })} autoComplete="off" /></label>
          <label>Citizenship<input value={form.citizenship} onChange={e => setForm({ ...form, citizenship: e.target.value })} /></label>
          <label>Gender
            <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
              <option value="">—</option>
              {['Female', 'Male', 'Other', 'Prefer not to say'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label>Status
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </>
      )}
      {mode === 'contact' && (
        <>
          <label className="span-2">Email<input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          <label>Home Phone<input value={form.homePhone} onChange={e => setForm({ ...form, homePhone: e.target.value })} /></label>
          <label>Work Phone<input value={form.workPhone} onChange={e => setForm({ ...form, workPhone: e.target.value })} /></label>
          <label className="span-2">Street<input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></label>
          <label>City<input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
          <label>State<input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></label>
          <label>ZIP<input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></label>
        </>
      )}
      {mode === 'professional' && (
        <>
          <label>Primary Specialty<input value={form.primarySpecialty} onChange={e => setForm({ ...form, primarySpecialty: e.target.value })} /></label>
          <label>Secondary Specialty<input value={form.secondarySpecialty} onChange={e => setForm({ ...form, secondarySpecialty: e.target.value })} /></label>
          <label>Taxonomy Code<input value={form.taxonomyCode} onChange={e => setForm({ ...form, taxonomyCode: e.target.value })} /></label>
          <label>Professional Type<input value={form.professionalType} onChange={e => setForm({ ...form, professionalType: e.target.value })} /></label>
          <label className="span-2">Supervisor Physician<input value={form.supervisorName} onChange={e => setForm({ ...form, supervisorName: e.target.value })} /></label>
        </>
      )}
      <div className="modal-footer" style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}

function LicenseForm({ onSave, saving }) {
  const [form, setForm] = useState({
    type: '', number: '', state: '', issuedAt: '', expiresAt: '', status: 'RECEIVED'
  });
  return (
    <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <label className="span-2">License / certification type<input required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} /></label>
      <label>Number<input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} /></label>
      <label>State<input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></label>
      <label>Issued<input type="date" value={form.issuedAt} onChange={e => setForm({ ...form, issuedAt: e.target.value })} /></label>
      <label>Expires<input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} /></label>
      <div className="modal-footer" style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="primary" disabled={saving}>Add license</button>
      </div>
    </form>
  );
}
