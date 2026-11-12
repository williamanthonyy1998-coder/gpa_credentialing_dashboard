import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, Bell, Eye, FileText, FolderOpen, Pencil, Plus, Search, Settings, Share2, Trash2, X
} from 'lucide-react';
import api from '../../api/client';
import DirectoryProfileShell from '../../components/layout/DirectoryProfileShell';
import InfoField from '../../components/common/InfoField';
import MaskedField from '../../components/common/MaskedField';
import StatusBadge from '../../components/common/StatusBadge';
import IconButton, { RowActions } from '../../components/common/IconButton';
import { SpecialtySelect, StateAbbrevSelect, StateSelect, LicenseTypeSelect } from '../../components/directory';
import { currentListPath, saveListReturn } from '../../navigation/listReturn';
import ProfessionalHistoryPanel from './ProfessionalHistoryPanel';
import IntegrationPanel from '../integrations/IntegrationPanel';

const STEPS = [
  { key: 'personal', label: 'Personal & Professional' },
  { key: 'readiness', label: 'Credentialing Readiness' },
  { key: 'licenses', label: 'Licenses' },
  { key: 'history', label: 'Professional History' },
  { key: 'affiliations', label: 'Affiliations' },
  { key: 'enrollments', label: 'Enrollments & Cases' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'credentials', label: 'Credentials & Documents' },
  { key: 'gaps', label: 'Gaps & Actions' },
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
  const [licenseRows, setLicenseRows] = useState([]);
  const [licenseSummary, setLicenseSummary] = useState(null);
  const [licenseCompleteness, setLicenseCompleteness] = useState(null);
  const [credentialingProfile, setCredentialingProfile] = useState(null);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState('');
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

  async function loadLicenses(pid) {
    if (!pid) return;
    const [rows, completeness, summary] = await Promise.all([
      api.get(`/provider-licenses/providers/${pid}`).then(r => r.data).catch(() => []),
      api.get(`/provider-licenses/providers/${pid}/completeness`).then(r => r.data).catch(() => null),
      api.get('/provider-licenses/expiration-summary', { params: { providerId: pid } }).then(r => r.data).catch(() => null)
    ]);
    setLicenseRows(Array.isArray(rows) ? rows : []);
    setLicenseCompleteness(completeness);
    setLicenseSummary(summary);
  }

  async function loadCredentialingProfile(pid, syncGaps = false) {
    if (!pid) return;
    const r = await api.get(`/providers/${pid}/credentialing-profile`, {
      params: syncGaps ? { syncGaps: '1' } : undefined
    });
    setCredentialingProfile(r.data);
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
    await loadLicenses(pid);
    await loadCredentialingProfile(pid).catch(() => setCredentialingProfile(null));
  }

  useEffect(() => {
    loadProviderList().catch(e => setError(e.response?.data?.error || 'Could not load providers.'));
    if (!isNew) loadDetail(id).catch(e => setError(e.response?.data?.error || 'Could not load provider.'));
    else setEditModal('personal');
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
  const licenses = licenseRows.length ? licenseRows : (detail?.licenses || []);

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
      await api.post(`/provider-licenses/providers/${pid}`, {
        licenseTypeId: form.licenseTypeId || null,
        usStateId: form.usStateId || null,
        type: form.type,
        number: form.number || null,
        state: form.state || null,
        issuedAt: form.issuedAt ? new Date(`${form.issuedAt}T12:00:00`).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T12:00:00`).toISOString() : null,
        isPrimary: Boolean(form.isPrimary)
      });
      await loadDetail(pid);
      setEditModal(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not save license.');
    } finally {
      setSaving(false);
    }
  }

  async function licenseAction(id, action, body = {}) {
    setError('');
    try {
      if (action === 'renew') {
        const expiresAt = window.prompt('New expiration date (YYYY-MM-DD):');
        if (!expiresAt) return;
        await api.post(`/provider-licenses/${id}/renew`, { expiresAt: new Date(`${expiresAt}T12:00:00`).toISOString() });
      } else if (action === 'reject') {
        const reason = window.prompt('Rejection reason (required):');
        if (!reason || reason.trim().length < 2) return;
        await api.post(`/provider-licenses/${id}/reject`, { reason: reason.trim() });
      } else if (action === 'correction') {
        const comments = window.prompt('Correction request:');
        if (!comments || comments.trim().length < 2) return;
        await api.post(`/provider-licenses/${id}/request-correction`, { comments: comments.trim() });
      } else {
        await api.post(`/provider-licenses/${id}/${action}`, body);
      }
      await loadLicenses(providerId);
      await loadDetail(providerId);
    } catch (e) {
      setError(e.response?.data?.error || e.message || `License ${action} failed`);
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
            <InfoField label="PRIMARY SPECIALTY" value={detail?.primarySpecialtyRef?.name || detail?.primarySpecialty} />
            <InfoField label="SECONDARY SPECIALTY" value={detail?.secondarySpecialtyRef?.name || detail?.secondarySpecialty} />
            <InfoField label="TAXONOMY CODE" value={detail?.taxonomyCode} />
            <InfoField label="PROFESSIONAL TYPE" value={detail?.professionalType} />
            <InfoField label="SUPERVISOR PHYSICIAN" value={detail?.supervisorName} className="span-2" />
          </div>
        </>
      )}

      {stepKey === 'readiness' && (
        <>
          <div className="section-head">
            <h2>CREDENTIALING READINESS</h2>
            <button
              type="button"
              className="btn secondary"
              disabled={readinessBusy || !providerId}
              onClick={async () => {
                setReadinessBusy(true);
                try {
                  await loadCredentialingProfile(providerId, true);
                } catch (e) {
                  setError(e.response?.data?.error || e.message || 'Could not refresh readiness');
                } finally {
                  setReadinessBusy(false);
                }
              }}
            >
              Recalculate
            </button>
          </div>
          <p className="muted">
            Operational assessment only — not payer enrollment approval, Medicare/Medicaid enrollment,
            or authorization to practice.
          </p>
          {credentialingProfile ? (
            <>
              <div className="banner" style={{ background: '#f4f7fb', padding: 12, marginBottom: 12 }}>
                <strong>Overall: {credentialingProfile.readiness?.overall || '—'}</strong>
                <div className="muted" style={{ marginTop: 4 }}>
                  Assessed {credentialingProfile.readiness?.assessedAt ? fmtDate(credentialingProfile.readiness.assessedAt) : '—'}
                  {' · '}Profile review: {credentialingProfile.profileReview?.status || 'NOT_STARTED'}
                </div>
              </div>
              <div className="info-grid" style={{ marginBottom: 16 }}>
                {Object.entries(credentialingProfile.credentialingSummary || {}).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    className="info-field"
                    style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid #d8e0ea', background: '#fff', padding: 10 }}
                    onClick={() => {
                      if (k === 'licenses' || k === 'verification' || k === 'expirationAttention') setStep('licenses');
                      else if (k === 'professionalHistory') setStep('history');
                      else if (k === 'credentialDocuments') setStep('credentials');
                      else if (k === 'outstandingReviews') setStep('gaps');
                      else setStep('personal');
                    }}
                  >
                    <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>{k}</div>
                    <div><StatusBadge value={v || 'NOT_ASSESSED'} /></div>
                  </button>
                ))}
              </div>
              <SectionHead title="DIMENSIONS" />
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dimension</th>
                      <th>Status</th>
                      <th>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(credentialingProfile.readiness?.dimensions || []).map((d) => (
                      <tr key={d.key}>
                        <td>
                          <button type="button" className="linkish" onClick={() => d.hrefHint && setStep(d.hrefHint === 'readiness' ? 'gaps' : d.hrefHint)}>
                            {d.label}
                          </button>
                        </td>
                        <td><StatusBadge value={d.status} /></td>
                        <td>
                          {(d.issues || []).length === 0 ? '—' : (
                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                              {d.issues.slice(0, 4).map((issue) => (
                                <li key={`${issue.code}-${issue.recordId || ''}`}>
                                  {issue.message}
                                  <div className="muted" style={{ fontSize: 12 }}>{issue.recommendedAction}</div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <SectionHead title="PROFILE REVIEW" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={readinessBusy}
                  onClick={async () => {
                    setReadinessBusy(true);
                    try {
                      await api.post(`/providers/${providerId}/review/start`, {});
                      await loadCredentialingProfile(providerId, true);
                    } catch (e) {
                      setError(e.response?.data?.error || e.message || 'Start review failed');
                    } finally {
                      setReadinessBusy(false);
                    }
                  }}
                >
                  Start review
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={readinessBusy || !correctionNotes.trim()}
                  onClick={async () => {
                    setReadinessBusy(true);
                    try {
                      await api.post(`/providers/${providerId}/review/request-corrections`, {
                        clientVisibleNotes: correctionNotes.trim()
                      });
                      setCorrectionNotes('');
                      await loadCredentialingProfile(providerId, true);
                    } catch (e) {
                      setError(e.response?.data?.error || e.message || 'Request corrections failed');
                    } finally {
                      setReadinessBusy(false);
                    }
                  }}
                >
                  Request corrections
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={readinessBusy}
                  onClick={async () => {
                    setReadinessBusy(true);
                    try {
                      await api.post(`/providers/${providerId}/review/complete`, {});
                      await loadCredentialingProfile(providerId, true);
                    } catch (e) {
                      setError(e.response?.data?.error || e.message || 'Complete review failed');
                    } finally {
                      setReadinessBusy(false);
                    }
                  }}
                >
                  Complete review
                </button>
              </div>
              <textarea
                className="input"
                rows={3}
                placeholder="Client-visible correction notes (required to request corrections)"
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
              />
              {credentialingProfile.profileReview?.clientVisibleNotes && (
                <p className="muted">Last client-visible notes: {credentialingProfile.profileReview.clientVisibleNotes}</p>
              )}
              {credentialingProfile.profileReview?.internalNotes && (
                <p className="muted">Internal notes: {credentialingProfile.profileReview.internalNotes}</p>
              )}
            </>
          ) : (
            <p className="muted">Loading readiness…</p>
          )}
        </>
      )}

      {stepKey === 'gaps' && (
        <>
          <div className="section-head">
            <h2>GAPS & ACTION ITEMS</h2>
            <button
              type="button"
              className="btn secondary"
              disabled={readinessBusy || !providerId}
              onClick={async () => {
                setReadinessBusy(true);
                try {
                  await api.post(`/providers/${providerId}/gaps/recalculate`);
                  await loadCredentialingProfile(providerId);
                } catch (e) {
                  setError(e.response?.data?.error || e.message || 'Gap recalculation failed');
                } finally {
                  setReadinessBusy(false);
                }
              }}
            >
              Recalculate gaps
            </button>
          </div>
          <p className="muted">
            Generated credentialing gaps use the existing Task system (source=CREDENTIALING_GAP).
            Gaps resolve only when underlying data satisfies the requirement.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Next action</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(credentialingProfile?.gaps || []).length === 0 && (
                  <tr><td colSpan={6} className="muted">No open credentialing gaps.</td></tr>
                )}
                {(credentialingProfile?.gaps || []).map((g) => (
                  <tr key={g.id}>
                    <td><StatusBadge value={g.priority} /></td>
                    <td>{g.title}</td>
                    <td>{g.category || '—'}</td>
                    <td><StatusBadge value={g.status} /></td>
                    <td className="muted">{g.recommendedNextAction || '—'}</td>
                    <td>
                      <RowActions>
                        <IconButton
                          title="Open section"
                          icon={Eye}
                          onClick={() => {
                            if (g.relatedType === 'licenses') setStep('licenses');
                            else if (String(g.relatedType || '').includes('history') || ['education', 'employment', 'malpractice'].includes(g.relatedType)) setStep('history');
                            else if (g.relatedType === 'credentials') setStep('credentials');
                            else setStep('readiness');
                          }}
                        />
                        <IconButton
                          title="Attempt resolve"
                          icon={Pencil}
                          onClick={async () => {
                            try {
                              await api.post(`/providers/${providerId}/gaps/${g.id}/resolve`);
                              await loadCredentialingProfile(providerId);
                            } catch (e) {
                              setError(e.response?.data?.error || e.message || 'Gap still open — fix underlying data first');
                            }
                          }}
                        />
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stepKey === 'licenses' && (
        <>
          <div className="section-head">
            <h2>LICENSES & CERTIFICATIONS</h2>
            <button type="button" className="icon-round" onClick={() => setEditModal('license')} aria-label="Add license" title="Add license"><Plus size={14} /></button>
          </div>
          {licenseSummary?.counts && (
            <div className="muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <span>Active: {licenseSummary.counts.active}</span>
              <span>Expiring 30d: {licenseSummary.counts.expiring30}</span>
              <span>Expiring 90d: {licenseSummary.counts.expiring90}</span>
              <span>Expired: {licenseSummary.counts.expired}</span>
              <span>Pending: {licenseSummary.counts.pendingVerification}</span>
              <span>Incomplete: {licenseSummary.counts.incomplete}</span>
            </div>
          )}
          {licenseCompleteness && (
            <div className="banner" style={{ background: '#f4f7fb', padding: 12, marginBottom: 12 }}>
              <strong>Credential completeness</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                Verified licenses: {licenseCompleteness.counts?.licensesVerified || 0} ·
                Pending: {licenseCompleteness.counts?.licensesPending || 0} ·
                Trusted documents: {licenseCompleteness.counts?.documentsTrusted || 0} ·
                Quarantined docs: {licenseCompleteness.counts?.documentsQuarantined || 0}
              </div>
              {(licenseCompleteness.unresolved || []).length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {licenseCompleteness.unresolved.map((u) => <li key={u}>{u}</li>)}
                </ul>
              )}
              <p className="muted" style={{ marginBottom: 0 }}>{licenseCompleteness.disclaimer}</p>
            </div>
          )}
          <p className="muted" style={{ marginBottom: 12 }}>
            Upload does not verify a license. Quarantined documents are not trusted evidence.
            Manual verification records reviewer identity — this is not an automated state-board API.
          </p>
          <div className="table-scroll table-cards">
            <table className="brand-table">
              <thead>
                <tr>
                  <th className="col-index">#</th>
                  <th>Type</th>
                  <th className="col-mid">Number</th>
                  <th className="col-narrow">State</th>
                  <th className="col-date">Expires</th>
                  <th className="col-status">Attention</th>
                  <th className="col-status">Verification</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic, i) => (
                  <tr key={lic.id}>
                    <td className="col-index" data-label="#">{i + 1}</td>
                    <td className="cell-strong" data-label="Type"><span className="cell-clip" title={lic.licenseType?.name || lic.type}>{lic.licenseType?.name || lic.type}</span></td>
                    <td className="col-mid" data-label="Number"><span className="cell-clip" title={lic.number || '—'}>{lic.number || '—'}</span></td>
                    <td className="col-narrow" data-label="State">{lic.usState?.abbreviation || lic.state || '—'}</td>
                    <td className="col-date" data-label="Expires">{fmtDate(lic.expiresAt)}</td>
                    <td className="col-status" data-label="Attention"><StatusBadge value={lic.attention || lic.status} /></td>
                    <td className="col-status" data-label="Verification"><StatusBadge value={lic.verificationStatus || lic.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(!lic.verificationStatus || lic.verificationStatus === 'NOT_SUBMITTED' || lic.verificationStatus === 'DRAFT' || lic.attention === 'DRAFT') && (
                          <button type="button" className="secondary" onClick={() => licenseAction(lic.id, 'submit')}>Submit</button>
                        )}
                        {lic.verificationStatus === 'PENDING_REVIEW' && (
                          <>
                            <button type="button" className="primary" onClick={() => licenseAction(lic.id, 'verify', { verificationSource: 'manual_review' })}>Verify</button>
                            <button type="button" className="secondary" onClick={() => licenseAction(lic.id, 'reject')}>Reject</button>
                            <button type="button" className="secondary" onClick={() => licenseAction(lic.id, 'correction')}>Request corrections</button>
                          </>
                        )}
                        <button type="button" className="secondary" onClick={() => licenseAction(lic.id, 'renew')}>Renew</button>
                        <button type="button" className="secondary" onClick={() => licenseAction(lic.id, 'archive')}>Archive</button>
                      </div>
                      {lic.correctionRequest && <div className="muted">Corrections: {lic.correctionRequest}</div>}
                      {lic.rejectionReason && <div className="muted">Rejected: {lic.rejectionReason}</div>}
                    </td>
                  </tr>
                ))}
                {!licenses.length && <tr><td colSpan="8" className="table-empty">No licenses on file. Add a license to begin review.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stepKey === 'history' && (
        <>
          <div className="section-head">
            <h2>PROFESSIONAL HISTORY</h2>
          </div>
          {!providerId ? (
            <p className="muted">Save the provider first to manage professional history.</p>
          ) : (
            <ProfessionalHistoryPanel providerId={providerId} canVerify />
          )}
        </>
      )}

      {stepKey === 'affiliations' && (
        <>
          <div className="section-head">
            <h2>AFFILIATIONS</h2>
            <button type="button" className="icon-round" onClick={() => { setEditModal('affiliation'); setSearchHits([]); setSearchQ(''); }} aria-label="Add affiliation" title="Add affiliation"><Plus size={14} /></button>
          </div>
          <div className="tab-row">
            <button type="button" className={`tab-btn ${affTab === 'organizations' ? 'active' : ''}`} onClick={() => setAffTab('organizations')}>Organizations</button>
            <button type="button" className={`tab-btn ${affTab === 'practices' ? 'active' : ''}`} onClick={() => setAffTab('practices')}>Practices</button>
            <button type="button" className={`tab-btn ${affTab === 'facilities' ? 'active' : ''}`} onClick={() => setAffTab('facilities')}>Facilities</button>
          </div>
          <div className="table-scroll table-cards">
            <table className="brand-table">
              <thead>
                <tr>
                  <th className="col-index">#</th>
                  <th>Name</th>
                  <th className="col-mid">Role / Status</th>
                  <th className="col-date">Effective</th>
                  <th className="col-actions action-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {affTab === 'organizations' && orgAffiliations.map((a, i) => (
                  <tr key={a.id}>
                    <td className="col-index" data-label="#">{i + 1}</td>
                    <td className="cell-strong" data-label="Name"><span className="cell-clip" title={a.organization?.legalName || '—'}>{a.organization?.legalName || '—'}</span></td>
                    <td className="col-mid" data-label="Role / Status"><span className="cell-clip" title={a.affiliationTitle || a.status || '—'}>{a.affiliationTitle || a.status || '—'}</span></td>
                    <td className="col-date" data-label="Effective">{fmtDate(a.effectiveAt)}</td>
                    <td className="col-actions" data-label="Actions">
                      <RowActions>
                        <IconButton
                          icon={Eye}
                          label="View organization"
                          tone="view"
                          onClick={() => nav(`/organizations/${a.organizationId}/overview`)}
                        />
                        <IconButton
                          icon={Trash2}
                          label="Remove"
                          tone="delete"
                          onClick={() => removeOrgAff(a.id)}
                        />
                      </RowActions>
                    </td>
                  </tr>
                ))}
                {affTab === 'practices' && practiceAffiliations.map((a, i) => (
                  <tr key={`${a.providerId}-${a.practiceId}`}>
                    <td className="col-index" data-label="#">{i + 1}</td>
                    <td className="cell-strong" data-label="Name"><span className="cell-clip" title={a.practice?.name || '—'}>{a.practice?.name || '—'}</span></td>
                    <td className="col-mid" data-label="Role / Status"><span className="cell-clip" title={a.affiliationTitle || '—'}>{a.affiliationTitle || '—'}</span></td>
                    <td className="col-date" data-label="Effective">{fmtDate(a.effectiveAt)}</td>
                    <td className="col-actions" data-label="Actions">
                      <RowActions>
                        <IconButton
                          icon={Eye}
                          label="View practice"
                          tone="view"
                          onClick={() => nav(`/practices/${a.practiceId}/profile`)}
                        />
                      </RowActions>
                    </td>
                  </tr>
                ))}
                {affTab === 'facilities' && facilityAffiliations.map((a, i) => (
                  <tr key={`${a.providerId}-${a.facilityId}`}>
                    <td className="col-index" data-label="#">{i + 1}</td>
                    <td className="cell-strong" data-label="Name"><span className="cell-clip" title={a.facility?.name || '—'}>{a.facility?.name || '—'}</span></td>
                    <td className="col-mid" data-label="Role / Status"><span className="cell-clip" title={a.approvalStatus || '—'}>{a.approvalStatus || '—'}</span></td>
                    <td className="col-date" data-label="Effective">{fmtDate(a.effectiveAt)}</td>
                    <td className="col-actions" data-label="Actions">
                      <RowActions>
                        <IconButton
                          icon={Eye}
                          label="View facility"
                          tone="view"
                          onClick={() => nav(`/facilities/${a.facilityId}/profile`)}
                        />
                        <IconButton
                          icon={Trash2}
                          label="Remove"
                          tone="delete"
                          onClick={() => removeFacilityAff(a.facilityId)}
                        />
                      </RowActions>
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
          <p className="muted">Payer enrollment is separate from credentialing readiness. Lifecycle actions are managed on the Enrollments page.</p>
          <div className="table-scroll table-cards">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Payer / Plan</th>
                  <th className="col-status">Status</th>
                  <th>Attention</th>
                  <th className="col-date">Submitted</th>
                  <th className="col-date">Effective</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map(e => (
                  <tr key={e.id}>
                    <td className="cell-strong" data-label="Application"><span className="cell-clip" title={e.applicationNo}>{e.applicationNo}</span></td>
                    <td data-label="Payer / Plan"><span className="cell-clip" title={e.payerPlan?.payer?.name || e.payerPlan?.name || '—'}>{e.payerPlan?.payer?.name || e.payerPlan?.name || '—'}</span></td>
                    <td className="col-status" data-label="Status"><StatusBadge value={e.status} /></td>
                    <td data-label="Attention"><StatusBadge value={e.attention || '—'} /></td>
                    <td className="col-date" data-label="Submitted">{fmtDate(e.submittedAt)}</td>
                    <td className="col-date" data-label="Effective">{fmtDate(e.effectiveAt)}</td>
                  </tr>
                ))}
                {!enrollments.length && <tr><td colSpan="6" className="table-empty">No enrollments linked to this provider.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="section-head" style={{ marginTop: 24 }}><h2>CREDENTIALING CASES</h2></div>
          <div className="table-scroll table-cards">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Case #</th>
                  <th className="col-status">Status</th>
                  <th className="col-date">Due</th>
                  <th>Practice</th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.id}>
                    <td className="cell-strong" data-label="Case #"><span className="cell-clip" title={c.caseNumber}>{c.caseNumber}</span></td>
                    <td className="col-status" data-label="Status"><StatusBadge value={c.status} /></td>
                    <td className="col-date" data-label="Due">{fmtDate(c.dueAt)}</td>
                    <td data-label="Practice"><span className="cell-clip" title={c.practice?.name || '—'}>{c.practice?.name || '—'}</span></td>
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

      {stepKey === 'integrations' && providerId && (
        <IntegrationPanel
          providerId={providerId}
          canConfigure={['ADMIN', 'CREDENTIALING_MANAGER'].includes(
            (() => { try { return JSON.parse(localStorage.getItem('credentialing_user') || '{}').role; } catch { return ''; } })()
          )}
          canManageAuth={!['CLIENT_USER', 'EXTERNAL_PROVIDER', 'READ_ONLY'].includes(
            (() => { try { return JSON.parse(localStorage.getItem('credentialing_user') || '{}').role; } catch { return ''; } })()
          )}
        />
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
          <div className="table-scroll table-cards">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th className="col-mid">Type</th>
                  <th className="col-status">Status</th>
                  <th className="col-date">Expires</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td className="cell-strong" data-label="Title"><span className="cell-clip" title={doc.title}>{doc.title}</span></td>
                    <td className="col-mid" data-label="Type"><span className="cell-clip" title={doc.type}>{doc.type}</span></td>
                    <td className="col-status" data-label="Status"><StatusBadge value={doc.status} /></td>
                    <td className="col-date" data-label="Expires">{fmtDate(doc.expiresAt)}</td>
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
    primarySpecialtyId: detail?.primarySpecialtyId || detail?.primarySpecialtyRef?.id || '',
    secondarySpecialtyId: detail?.secondarySpecialtyId || detail?.secondarySpecialtyRef?.id || '',
    primarySpecialty: detail?.primarySpecialty || detail?.primarySpecialtyRef?.name || '',
    secondarySpecialty: detail?.secondarySpecialty || detail?.secondarySpecialtyRef?.name || '',
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
        primarySpecialtyId: form.primarySpecialtyId || null,
        secondarySpecialtyId: form.secondarySpecialtyId || null,
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
          <label>State
            <StateAbbrevSelect
              value={form.state}
              fallbackLabel={form.state}
              onChange={(v) => setForm({ ...form, state: v || '' })}
            />
          </label>
          <label>ZIP<input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></label>
        </>
      )}
      {mode === 'professional' && (
        <>
          <label>Primary Specialty
            <SpecialtySelect
              value={form.primarySpecialtyId}
              selectedOption={detail?.primarySpecialtyRef}
              fallbackLabel={form.primarySpecialty}
              onChange={(v, opt) => setForm({
                ...form,
                primarySpecialtyId: v || '',
                primarySpecialty: opt?.name || opt?.label || ''
              })}
            />
          </label>
          <label>Secondary Specialty
            <SpecialtySelect
              value={form.secondarySpecialtyId}
              selectedOption={detail?.secondarySpecialtyRef}
              fallbackLabel={form.secondarySpecialty}
              onChange={(v, opt) => setForm({
                ...form,
                secondarySpecialtyId: v || '',
                secondarySpecialty: opt?.name || opt?.label || ''
              })}
            />
          </label>
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
    licenseTypeId: '', usStateId: '', type: '', number: '', state: '', issuedAt: '', expiresAt: '', status: 'RECEIVED'
  });
  return (
    <form className="form-grid" onSubmit={e => {
      e.preventDefault();
      onSave({
        licenseTypeId: form.licenseTypeId || null,
        usStateId: form.usStateId || null,
        type: form.type || undefined,
        number: form.number || null,
        state: form.state || null,
        issuedAt: form.issuedAt || null,
        expiresAt: form.expiresAt || null,
        status: form.status
      });
    }}>
      <label className="span-2">License / certification type
        <LicenseTypeSelect
          required
          allowEmpty={false}
          value={form.licenseTypeId}
          onChange={(v, opt) => setForm({
            ...form,
            licenseTypeId: v || '',
            type: opt?.name || opt?.label || form.type
          })}
        />
      </label>
      <label>Number<input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} /></label>
      <label>State
        <StateSelect
          value={form.usStateId}
          onChange={(v, opt) => setForm({
            ...form,
            usStateId: v || '',
            state: opt?.abbreviation || form.state
          })}
        />
      </label>
      <label>Issued<input type="date" value={form.issuedAt} onChange={e => setForm({ ...form, issuedAt: e.target.value })} /></label>
      <label>Expires<input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} /></label>
      <div className="modal-footer" style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="primary" disabled={saving}>Add license</button>
      </div>
    </form>
  );
}
