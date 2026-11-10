import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, Bell, Clock, Eye, FileText, FolderOpen, Link2, Pencil, Plus, Search, Settings, Share2, X
} from 'lucide-react';
import api from '../../api/client';
import DirectoryProfileShell from '../../components/layout/DirectoryProfileShell';
import InfoField from '../../components/common/InfoField';
import StatusBadge from '../../components/common/StatusBadge';
import { currentListPath, saveListReturn } from '../../navigation/listReturn';

const STEPS = [
  { key: 'basic', label: 'Basic Information' },
  { key: 'address', label: 'Address & Contact Information' },
  { key: 'timings', label: 'Facility Timings & Duration' },
  { key: 'providers', label: 'Individual Providers' },
  { key: 'contacts', label: 'Contacts' }
];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function defaultDay() {
  return { open: false, startTime: '11:00', endTime: '23:00' };
}
function defaultSchedule() {
  return Object.fromEntries(DAYS.map(d => [d, { ...defaultDay(), open: d !== 'Sunday' }]));
}

export default function FacilityProfile() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const location = useLocation();
  const isNew = id === 'new';
  const stepKey = params.get('step') || 'basic';
  const stepIndex = Math.max(0, STEPS.findIndex(s => s.key === stepKey));

  const [practices, setPractices] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [facilityId, setFacilityId] = useState(isNew ? null : id);
  const [detail, setDetail] = useState(null);
  const [affiliations, setAffiliations] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(!isNew);
  const [providersError, setProvidersError] = useState('');
  const [contacts, setContacts] = useState([]);
  const [attention, setAttention] = useState({ counts: {}, expiringSoon: [] });
  const [contactTab, setContactTab] = useState('ORGANIZATION');
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState(null);
  const [providerQ, setProviderQ] = useState('');
  const [providers, setProviders] = useState([]);
  const [saving, setSaving] = useState(false);
  const dirty = !!editModal;

  const facilityProviders = useMemo(() => (
    affiliations
      .map(a => a.provider || (a.providerId ? { id: a.providerId } : null))
      .filter(Boolean)
      .map(p => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        primarySpecialty: p.primarySpecialty,
        status: p.status
      }))
  ), [affiliations]);

  function openAssignedProvider(providerId) {
    if (!providerId) return;
    const returnTo = currentListPath(
      `/facilities/${facilityId}/profile`,
      `?step=${stepKey || 'providers'}`
    );
    saveListReturn('providers', '/providers');
    nav(`/providers/${providerId}/profile`, {
      state: {
        returnTo,
        listKey: 'facilities',
        facilityId,
        practiceId: detail?.practiceId || location.state?.practiceId,
        organizationId: detail?.organizationId || location.state?.organizationId,
        providerId
      }
    });
  }

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

  async function loadLists() {
    const [p, f] = await Promise.all([
      api.get('/practices', { params: { limit: 100 } }),
      api.get('/facilities', { params: { limit: 100 } })
    ]);
    setPractices(p.data);
    setFacilities(f.data);
  }

  async function loadDetail(fid, options = {}) {
    const { silent = false, isCurrent = () => true } = options;
    if (!fid) {
      if (isCurrent()) {
        setAffiliations([]);
        setProvidersLoading(false);
        setProvidersError('');
      }
      return;
    }
    if (!silent && isCurrent()) {
      setProvidersLoading(true);
      setProvidersError('');
      // Never keep the previous facility's providers visible while switching.
      setAffiliations([]);
    }
    try {
      const d = (await api.get(`/directory/facilities/${fid}/detail`)).data;
      if (!isCurrent()) return d;
      setDetail(d);
      setFacilityId(d.id);
      setAffiliations(d.providers || []);
      setContacts(d.contacts || []);
      setProvidersError('');
      try {
        const attn = (await api.get('/credentials/attention', { params: { facilityId: d.id } })).data;
        if (isCurrent()) setAttention(attn);
      } catch { /* optional */ }
      return d;
    } catch (e) {
      if (isCurrent()) {
        setAffiliations([]);
        setProvidersError(e.response?.data?.error || 'Could not load providers for this facility.');
      }
      throw e;
    } finally {
      if (isCurrent()) setProvidersLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const isCurrent = () => active;
    loadLists().catch(e => {
      if (active) setError(e.response?.data?.error || 'Could not load facilities.');
    });
    if (!isNew) {
      loadDetail(id, { isCurrent }).catch(e => {
        if (active) setError(e.response?.data?.error || 'Could not load facility.');
      });
    } else {
      setAffiliations([]);
      setProvidersLoading(false);
      setProvidersError('');
    }
    return () => { active = false; };
  }, [id]);

  const schedule = useMemo(() => {
    const raw = detail?.schedule;
    if (!raw || typeof raw !== 'object') return defaultSchedule();
    return Object.fromEntries(DAYS.map(day => {
      const v = raw[day];
      if (!v) return [day, defaultDay()];
      if (typeof v === 'string') {
        if (v.toLowerCase() === 'closed') return [day, { open: false, startTime: '', endTime: '' }];
        const [startTime, endTime] = v.split('-');
        return [day, { open: true, startTime: startTime || '11:00', endTime: endTime || '23:00' }];
      }
      return [day, { ...defaultDay(), ...v }];
    }));
  }, [detail]);

  const openDays = DAYS.filter(d => schedule[d]?.open).length;
  const completion = useMemo(() => {
    const addr = detail?.address || {};
    const basic = detail?.name && (detail?.organizationId || detail?.practiceId);
    const address = addr.street && addr.city && addr.state;
    const timings = openDays > 0;
    const providersDone = affiliations.length > 0;
    const contactsDone = contacts.length > 0;
    return Math.round(([basic, address, timings, providersDone, contactsDone].filter(Boolean).length / 5) * 100);
  }, [detail, openDays, affiliations, contacts]);

  async function saveFacility(body) {
    setSaving(true);
    setError('');
    try {
      let saved;
      if (facilityId) saved = (await api.patch(`/facilities/${facilityId}`, body)).data;
      else {
        saved = (await api.post('/facilities', body)).data;
        setFacilityId(saved.id);
        nav(`/facilities/${saved.id}/profile?step=${stepKey}`, { replace: true });
      }
      if (body.schedule) await api.put(`/directory/facilities/${saved.id}/schedule`, { schedule: body.schedule });
      await loadDetail(saved.id || facilityId, { silent: true });
      await loadLists();
      setEditModal(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function assignProvider(p) {
    let fid = facilityId;
    if (!fid) {
      setError('Save facility basic information first.');
      return;
    }
    await api.post('/directory/provider-facilities', { providerId: p.id, facilityId: fid, approvalStatus: 'Pending' });
    await loadDetail(fid, { silent: true });
    setEditModal(null);
  }

  async function removeAff(providerId) {
    if (!confirm('Remove affiliation? Provider record will not be deleted.')) return;
    await api.delete(`/directory/provider-facilities/${providerId}/${facilityId}`);
    await loadDetail(facilityId, { silent: true });
  }

  async function saveContact(form) {
    let fid = facilityId;
    if (!fid) { setError('Save facility first.'); return; }
    await api.post('/directory/facility-contacts', { facilityId: fid, ...form });
    await loadDetail(fid, { silent: true });
    setEditModal(null);
  }

  async function deleteContact(cid) {
    if (!confirm('Delete contact?')) return;
    await api.delete(`/directory/facility-contacts/${cid}`);
    await loadDetail(facilityId, { silent: true });
  }

  const addr = detail?.address || {};
  const practice = practices.find(p => p.id === detail?.practiceId);

  return (
    <DirectoryProfileShell
      entityType="FACILITY"
      title={detail?.name || (isNew ? 'New Facility' : 'Facility')}
      status={detail?.status || 'ACTIVE'}
      npi={detail?.npi || practice?.npi}
      taxId={practice?.taxId}
      completion={completion}
      breadcrumb={[
        { label: 'Directory', to: '/organizations' },
        ...(detail?.organizationId || practice?.organizationId
          ? [{
            label: detail?.organization?.legalName || practice?.organization?.legalName || 'Organization',
            to: `/organizations/${detail?.organizationId || practice?.organizationId}/overview`
          }]
          : []),
        ...(detail?.practiceId || practice?.id
          ? [
            { label: 'Practices', to: '/practices' },
            { label: practice?.name || detail?.practice?.name || 'Practice', to: `/practices/${detail?.practiceId || practice?.id}/profile` },
            { label: 'Facilities', to: '/facilities' }
          ]
          : [{ label: 'Facilities', to: '/facilities' }]),
        { label: detail?.name || 'Facility' },
        { label: STEPS[stepIndex]?.label || 'Basic Information' }
      ]}
      listKey="facilities"
      backLabel="Back to Facilities"
      backFallback={
        (location.state?.practiceId || detail?.practiceId)
          ? `/practices/${location.state?.practiceId || detail?.practiceId}/profile`
          : '/facilities'
      }
      backHints={{
        practiceId: location.state?.practiceId || detail?.practiceId,
        organizationId: location.state?.organizationId || detail?.organizationId || practice?.organizationId
      }}
      dirty={dirty}
      practices={practices}
      selectedPracticeId={detail?.practiceId || ''}
      onSelectPractice={(pid) => { if (pid) nav(`/practices/${pid}/profile`); }}
      facilities={facilities}
      selectedFacilityId={facilityId || ''}
      onSelectFacility={(fid) => nav(`/facilities/${fid}/profile?step=${stepKey}`)}
      providers={facilityProviders}
      providersLoading={providersLoading}
      providersError={providersError}
      onSelectProvider={(providerId) => openAssignedProvider(providerId)}
      steps={STEPS}
      activeStepKey={stepKey}
      onStepChange={setStep}
      rightMode="facility"
      attention={attention}
      onRequestInfo={() => alert('Request facility info — notification workflow will deliver this in Phase 7.')}
      quickActions={[
        {
          key: 'w9',
          label: 'W-9 Form',
          icon: FileText,
          onClick: () => facilityId && nav(`/facilities/${facilityId}/credentials`)
        },
        {
          key: 'credentials',
          label: 'Credentials',
          icon: FolderOpen,
          onClick: () => facilityId && nav(`/facilities/${facilityId}/credentials`)
        },
        { key: 'enrollments', label: 'Enrollments', icon: FileText, onClick: () => nav('/enrollments') },
        {
          key: 'share',
          label: 'Share',
          icon: Share2,
          onClick: () => { navigator.clipboard?.writeText(window.location.href); alert('Facility profile link copied.'); }
        },
        {
          key: 'alerts',
          label: 'Alerts',
          icon: Bell,
          onClick: () => facilityId && nav(`/facilities/${facilityId}/credentials`)
        },
        { key: 'activity', label: 'Activity', icon: Activity, onClick: () => nav('/audit') },
        { key: 'settings', label: 'Settings', icon: Settings, onClick: () => setStep('basic') }
      ]}
      stepIndex={stepIndex}
      stepCount={STEPS.length}
      stepLabel={STEPS[stepIndex]?.label}
      onPrev={() => stepIndex > 0 && setStep(STEPS[stepIndex - 1].key)}
      onNext={() => {
        if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1].key);
        else nav('/facilities');
      }}
    >
      {error && <div className="error banner">{error}</div>}

      {stepKey === 'basic' && (
        <>
          <div className="section-head">
            <h2>BASIC INFORMATION</h2>
            <button type="button" className="icon-round" onClick={() => setEditModal('basic')}><Pencil size={14} /></button>
          </div>
          <div className="info-grid">
            <InfoField label="FACILITY NAME" value={detail?.name} className="span-2" />
            <InfoField label="NPI" value={detail?.npi} />
            <InfoField label="PRACTICE" value={detail?.practice?.name} />
            <InfoField label="CONTACT PERSON NAME" value={detail?.contactName} />
            <InfoField label="CONTACT PERSON TITLE" value={detail?.contactTitle} />
            <InfoField label="PHONE NUMBER" value={detail?.phone} />
            <InfoField label="FAX NUMBER" value={detail?.fax} />
            <InfoField label="EMAIL" value={detail?.email} className="span-2" />
          </div>
        </>
      )}

      {stepKey === 'address' && (
        <>
          <div className="section-head">
            <h2>ADDRESS & CONTACT INFORMATION</h2>
            <button type="button" className="icon-round" onClick={() => setEditModal('address')}><Pencil size={14} /></button>
          </div>
          <div className="info-grid">
            <InfoField label="STREET ADDRESS" value={addr.street} />
            <InfoField label="ZIP CODE" value={addr.zip} />
            <InfoField label="COUNTY" value={addr.county} />
            <InfoField label="CITY" value={addr.city} />
            <InfoField label="STATE" value={addr.state} />
            <InfoField label="COUNTRY" value={addr.country || 'United States'} />
            <InfoField label="PHONE NUMBER" value={addr.phone || detail?.phone} />
            <InfoField label="FAX NUMBER" value={addr.fax || detail?.fax} />
            <InfoField label="EMAIL" value={addr.email || detail?.email} className="span-2" />
          </div>
        </>
      )}

      {stepKey === 'timings' && (
        <>
          <div className="section-head">
            <h2>FACILITY TIMINGS & DURATION</h2>
            <button type="button" className="icon-round" onClick={() => setEditModal('timings')}><Pencil size={14} /></button>
          </div>
          <div className="availability-banner">
            <Clock size={15} /> Weekly availability: {openDays} open days · {7 - openDays} closed
          </div>
          <div className="timing-list">
            {DAYS.map(day => {
              const d = schedule[day];
              return (
                <div key={day} className={`timing-row ${d.open ? '' : 'closed'}`}>
                  <span className={`timing-dot ${d.open ? 'green' : 'closed'}`} />
                  <b>{day}</b>
                  <span className="timing-hours">
                    <Clock size={13} /> {d.open ? `${d.startTime} – ${d.endTime}` : 'No hours scheduled'}
                  </span>
                  <span className={`timing-badge ${d.open ? 'open' : 'closed'}`}>{d.open ? 'Open' : 'Closed'}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {stepKey === 'providers' && (
        <>
          <div className="section-head">
            <h2>INDIVIDUAL PROVIDERS</h2>
            <button type="button" className="icon-round" onClick={() => setEditModal('providers')}><Plus size={14} /></button>
          </div>
          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr><th>S. NO</th><th>NAME</th><th>NPI</th><th>STATUS</th><th>APPROVAL</th><th>ACTIONS</th></tr>
              </thead>
              <tbody>
                {affiliations.map((a, i) => (
                  <tr key={`${a.providerId}-${i}`}>
                    <td>{i + 1}</td>
                    <td className="cell-strong">{a.provider?.firstName} {a.provider?.lastName}</td>
                    <td>{a.provider?.npi || '—'}</td>
                    <td><StatusBadge value={a.provider?.status} /></td>
                    <td>{a.approvalStatus || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-round"
                          title="View provider"
                          onClick={() => openAssignedProvider(a.providerId)}
                        >
                          <Eye size={14} />
                        </button>
                        <button className="small-action danger-text" onClick={() => removeAff(a.providerId)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!affiliations.length && <tr><td colSpan="6" className="table-empty">No providers affiliated. Assign an existing provider — do not create duplicates.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stepKey === 'contacts' && (
        <>
          <div className="section-head">
            <h2>CONTACTS</h2>
            <button type="button" className="icon-round" onClick={() => setEditModal('contact')}><Plus size={14} /></button>
          </div>
          <div className="tab-row">
            <button type="button" className={`tab-btn ${contactTab === 'PERSON' ? 'active' : ''}`} onClick={() => setContactTab('PERSON')}>Person</button>
            <button type="button" className={`tab-btn ${contactTab === 'ORGANIZATION' ? 'active' : ''}`} onClick={() => setContactTab('ORGANIZATION')}>Organization</button>
          </div>
          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>S. NO</th>
                  {contactTab === 'PERSON' ? <><th>NAME</th><th>TITLE</th></> : <th>ORGANIZATION NAME</th>}
                  <th>EMAIL</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {contacts.filter(c => c.kind === contactTab).map((c, i) => (
                  <tr key={c.id}>
                    <td>{i + 1}</td>
                    {contactTab === 'PERSON' ? <><td>{c.name}</td><td>{c.title || '—'}</td></> : <td>{c.organizationName}</td>}
                    <td>{c.email || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-round"><Link2 size={13} /></button>
                        <button className="icon-round danger" onClick={() => deleteContact(c.id)}><X size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!contacts.filter(c => c.kind === contactTab).length && (
                  <tr><td colSpan="5" className="table-empty">No contacts in this tab.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editModal && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setEditModal(null)}>
          <div className="record-modal">
            <div className="modal-heading">
              <div><span className="eyebrow">EDIT</span><h2>{String(editModal)}</h2></div>
              <button type="button" className="icon-button" onClick={() => setEditModal(null)}><X size={20} /></button>
            </div>
            {editModal === 'basic' && (
              <BasicFacilityForm
                detail={detail}
                practices={practices}
                saving={saving}
                onSave={async (form) => {
                  await saveFacility({
                    name: form.name,
                    npi: form.npi || null,
                    practiceId: form.practiceId || null,
                    organizationId: form.organizationId || null,
                    contactName: form.contactName || null,
                    contactTitle: form.contactTitle || null,
                    phone: form.phone || null,
                    fax: form.fax || null,
                    email: form.email || null,
                    status: form.status || 'ACTIVE'
                  });
                }}
              />
            )}
            {editModal === 'address' && (
              <AddressFacilityForm
                addr={addr}
                detail={detail}
                onSave={async (form) => {
                  await saveFacility({
                    address: form,
                    phone: form.phone || detail?.phone,
                    fax: form.fax || detail?.fax,
                    email: form.email || detail?.email
                  });
                }}
              />
            )}
            {editModal === 'timings' && (
              <TimingsForm
                schedule={schedule}
                onSave={async (sched) => { await saveFacility({ schedule: sched }); }}
              />
            )}
            {editModal === 'providers' && (
              <div style={{ padding: 20 }}>
                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={16} />
                    <input value={providerQ} onChange={e => setProviderQ(e.target.value)} placeholder="Search existing providers" />
                  </div>
                  <button type="button" className="secondary" onClick={async () => {
                    const r = await api.get('/providers', { params: { q: providerQ, limit: 20 } });
                    setProviders(r.data);
                  }}>Search</button>
                </div>
                <div className="provider-search-results">
                  {providers.map(p => (
                    <div key={p.id} className="provider-search-row">
                      <div><b>{p.firstName} {p.lastName}</b><span>NPI {p.npi || '—'}</span></div>
                      <button type="button" className="small-action" onClick={() => assignProvider(p).catch(e => setError(e.response?.data?.error || e.message))}>Assign</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {editModal === 'contact' && (
              <ContactForm kind={contactTab} onSave={saveContact} />
            )}
          </div>
        </div>
      )}
    </DirectoryProfileShell>
  );
}

function BasicFacilityForm({ detail, practices, onSave, saving }) {
  const [form, setForm] = useState({
    name: detail?.name || '',
    npi: detail?.npi || '',
    practiceId: detail?.practiceId || '',
    organizationId: detail?.organizationId || '',
    contactName: detail?.contactName || '',
    contactTitle: detail?.contactTitle || '',
    phone: detail?.phone || '',
    fax: detail?.fax || '',
    email: detail?.email || '',
    status: detail?.status || 'ACTIVE'
  });
  return (
    <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <label className="span-2">Facility Name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>NPI<input value={form.npi} onChange={e => setForm({ ...form, npi: e.target.value })} /></label>
      <label>Practice
        <select value={form.practiceId} onChange={e => {
          const practice = practices.find(p => p.id === e.target.value);
          setForm({ ...form, practiceId: e.target.value, organizationId: practice?.organizationId || form.organizationId });
        }}>
          <option value="">Select…</option>
          {practices.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>Contact Name<input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></label>
      <label>Title<input value={form.contactTitle} onChange={e => setForm({ ...form, contactTitle: e.target.value })} /></label>
      <label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <label>Fax<input value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} /></label>
      <label className="span-2">Email<input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <div className="modal-footer" style={{ gridColumn: '1 / -1' }}>
        <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

function AddressFacilityForm({ addr, detail, onSave }) {
  const [form, setForm] = useState({
    street: addr.street || '', zip: addr.zip || '', county: addr.county || '', city: addr.city || '',
    state: addr.state || '', country: addr.country || 'United States',
    phone: addr.phone || detail?.phone || '', fax: addr.fax || detail?.fax || '', email: addr.email || detail?.email || ''
  });
  return (
    <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <label className="span-2">Street Address<input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></label>
      <label>ZIP<input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></label>
      <label>County<input value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} /></label>
      <label>City<input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
      <label>State<input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></label>
      <label>Country<input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></label>
      <label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <label>Fax<input value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} /></label>
      <label className="span-2">Email<input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <div className="modal-footer" style={{ gridColumn: '1 / -1' }}><button className="primary">Save</button></div>
    </form>
  );
}

function TimingsForm({ schedule, onSave }) {
  const [sched, setSched] = useState(schedule);
  function setDay(day, patch) {
    setSched(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }
  return (
    <form style={{ padding: 16 }} onSubmit={e => { e.preventDefault(); onSave(sched); }}>
      <div className="schedule-grid">
        {DAYS.map(day => {
          const d = sched[day] || defaultDay();
          return (
            <div className="schedule-row" key={day}>
              <label className="schedule-day">
                <input type="checkbox" checked={!!d.open} onChange={e => setDay(day, { open: e.target.checked })} />
                <b>{day}</b>
              </label>
              {d.open ? (
                <div className="schedule-fields">
                  <label>Start<input type="time" value={d.startTime || ''} onChange={e => setDay(day, { startTime: e.target.value })} /></label>
                  <label>End<input type="time" value={d.endTime || ''} onChange={e => setDay(day, { endTime: e.target.value })} /></label>
                </div>
              ) : <span className="muted">Closed</span>}
            </div>
          );
        })}
      </div>
      <div className="modal-footer"><button className="primary">Save timings</button></div>
    </form>
  );
}

function ContactForm({ kind, onSave }) {
  const [form, setForm] = useState({ kind, name: '', title: '', organizationName: '', email: '', phone: '' });
  return (
    <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
      {kind === 'PERSON' ? (
        <>
          <label>Name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label>Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        </>
      ) : (
        <label className="span-2">Organization Name<input required value={form.organizationName} onChange={e => setForm({ ...form, organizationName: e.target.value })} /></label>
      )}
      <label>Email<input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <div className="modal-footer" style={{ gridColumn: '1 / -1' }}><button className="primary">Add contact</button></div>
    </form>
  );
}
