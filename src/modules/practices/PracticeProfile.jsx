import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, Bell, FileText, Pencil, Settings, Share2, Trash2, UserPlus, Users, X
} from 'lucide-react';
import api from '../../api/client';
import DirectoryProfileShell from '../../components/layout/DirectoryProfileShell';
import InfoField from '../../components/common/InfoField';
import MaskedField from '../../components/common/MaskedField';
import ProgressBar from '../../components/common/ProgressBar';

const STEPS = [
  { key: 'basic', label: 'Basic Information' },
  { key: 'address', label: 'Address' },
  { key: 'owners', label: "Owner's Information" },
  { key: 'banking', label: 'Banking Information' }
];

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export default function PracticeProfile() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useNavigate();
  const location = useLocation();
  const isNew = id === 'new';
  const stepKey = searchParams.get('step') || 'basic';
  const stepIndex = Math.max(0, STEPS.findIndex(s => s.key === stepKey));

  const [practices, setPractices] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [practiceId, setPracticeId] = useState(isNew ? null : id);
  const [detail, setDetail] = useState(null);
  const [owners, setOwners] = useState([]);
  const [ownerIndex, setOwnerIndex] = useState(0);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState(null); // basic|contact|address|banking|owner
  const [saving, setSaving] = useState(false);
  const dirty = !!editModal;

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  async function loadLists() {
    const [p, f] = await Promise.all([
      api.get('/practices', { params: { limit: 100 } }),
      api.get('/facilities', { params: { limit: 100 } })
    ]);
    setPractices(p.data);
    setFacilities(f.data);
  }

  async function loadDetail(pid) {
    if (!pid) return;
    const d = (await api.get(`/directory/practices/${pid}/detail`)).data;
    setDetail(d);
    setOwners(d.owners || []);
    setPracticeId(d.id);
    const related = (await api.get('/facilities', { params: { limit: 100, organizationId: d.organizationId } })).data
      .filter(x => !x.practiceId || x.practiceId === d.id);
    setFacilities(related);
  }

  useEffect(() => {
    loadLists().catch(e => setError(e.response?.data?.error || 'Could not load practices.'));
    if (!isNew) loadDetail(id).catch(e => setError(e.response?.data?.error || 'Could not load practice.'));
  }, [id]);

  function setStep(key) {
    if (dirty && !window.confirm('You have unsaved changes. Leave this section?')) return;
    setEditModal(null);
    setSearchParams({ step: key });
  }

  const completion = useMemo(() => {
    if (!detail && isNew) return 0;
    const d = detail || {};
    const addr = d.mailingAddress || d.primaryAddress || {};
    const basic = d.name && d.organizationId;
    const address = addr.street && addr.city && addr.state && addr.zip;
    const own = owners.length > 0 && Math.abs(Number(d.ownershipTotal || owners.reduce((s, o) => s + Number(o.ownershipPercent || 0), 0)) - 100) < 0.5;
    const bank = d.bankName && d.bankAccountTitle;
    return Math.round(([basic, address, own, bank].filter(Boolean).length / 4) * 100);
  }, [detail, owners, isNew]);

  async function saveSection(body) {
    setSaving(true);
    setError('');
    try {
      let saved;
      if (practiceId) saved = (await api.patch(`/practices/${practiceId}`, body)).data;
      else {
        if (!body.organizationId || !body.name) throw new Error('Organization and Practice Name are required.');
        saved = (await api.post('/practices', body)).data;
        setPracticeId(saved.id);
        nav(`/practices/${saved.id}/profile?step=${stepKey}`, { replace: true });
      }
      await loadDetail(saved.id || practiceId);
      setEditModal(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function saveOwner(form) {
    setSaving(true);
    setError('');
    try {
      let pid = practiceId;
      if (!pid) {
        const orgs = (await api.get('/organizations', { params: { limit: 1 } })).data;
        if (!orgs[0]) throw new Error('Create an organization first.');
        const created = (await api.post('/practices', { organizationId: orgs[0].id, name: 'New Practice' })).data;
        pid = created.id;
        setPracticeId(pid);
        nav(`/practices/${pid}/profile?step=owners`, { replace: true });
      }
      const payload = {
        practiceId: pid,
        name: form.name,
        ownershipPercent: Number(form.ownershipPercent),
        ssn: form.ssn || null,
        dateOfBirth: form.dateOfBirth ? new Date(`${form.dateOfBirth}T12:00:00`).toISOString() : null,
        ownershipDate: form.ownershipDate ? new Date(`${form.ownershipDate}T12:00:00`).toISOString() : null,
        placeOfBirth: form.placeOfBirth || null,
        phone: form.phone || null,
        fax: form.fax || null,
        email: form.email || null,
        address: {
          street: form.street || '', zip: form.zip || '', county: form.county || '',
          city: form.city || '', state: form.state || '', country: form.country || 'USA'
        }
      };
      if (form.id) await api.patch(`/directory/practice-owners/${form.id}`, payload);
      else await api.post('/directory/practice-owners', payload);
      await loadDetail(pid);
      setEditModal(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not save owner.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteOwner(owner) {
    if (!owner?.id || !confirm('Remove this owner?')) return;
    await api.delete(`/directory/practice-owners/${owner.id}`);
    await loadDetail(practiceId);
  }

  const addr = detail?.mailingAddress || detail?.primaryAddress || {};
  const currentOwner = owners[ownerIndex] || null;
  const ownershipTotal = owners.reduce((s, o) => s + Number(o.ownershipPercent || 0), 0);

  const orgsPromiseCache = React.useRef(null);
  const [orgs, setOrgs] = useState([]);
  useEffect(() => {
    api.get('/organizations', { params: { limit: 100 } }).then(r => setOrgs(r.data)).catch(() => {});
  }, []);

  return (
    <DirectoryProfileShell
      entityType="PRACTICE"
      title={detail?.name || (isNew ? 'New Practice' : 'Practice')}
      status={detail?.status || 'ACTIVE'}
      npi={detail?.npi}
      taxId={detail?.taxId}
      completion={completion}
      breadcrumb={[
        { label: 'Directory', to: '/organizations' },
        ...(detail?.organizationId
          ? [{ label: detail?.organization?.legalName || detail?.organization?.dba || 'Organization', to: `/organizations/${detail.organizationId}/overview` }]
          : []),
        { label: 'Practices', to: '/practices' },
        { label: detail?.name || 'Practice' },
        { label: STEPS[stepIndex]?.label || 'Basic Information' }
      ]}
      listKey="practices"
      backLabel="Back to Practices"
      backFallback="/practices"
      backHints={{ organizationId: location.state?.organizationId }}
      dirty={dirty}
      practices={practices}
      selectedPracticeId={practiceId || ''}
      onSelectPractice={(pid) => { if (pid) nav(`/practices/${pid}/profile?step=${stepKey}`); }}
      facilities={facilities}
      onSelectFacility={(fid) => {
        const returnTo = `/practices/${practiceId || id}/profile?step=${stepKey}`;
        nav(`/facilities/${fid}/profile?step=basic`, {
          state: {
            returnTo,
            listKey: 'practices',
            practiceId: practiceId || id,
            organizationId: detail?.organizationId
          }
        });
      }}
      steps={STEPS}
      activeStepKey={stepKey}
      onStepChange={setStep}
      rightMode="practice"
      owners={owners}
      selectedOwnerId={currentOwner?.id}
      onSelectOwner={(o) => { setOwnerIndex(Math.max(0, owners.findIndex(x => x.id === o.id))); setStep('owners'); }}
      onAddOwner={() => { setStep('owners'); setEditModal('owner'); }}
      onRequestInfo={() => alert('Request practice info — notification workflow will deliver this in Phase 7.')}
      quickActions={[
        { key: 'intent', label: 'Intent Letter', icon: FileText, onClick: () => nav('/credentials') },
        { key: 'roster', label: 'Roster', icon: Users, onClick: () => nav('/providers') },
        { key: 'activity', label: 'Activity', icon: Activity, onClick: () => nav('/audit') },
        {
          key: 'alerts',
          label: 'Alerts',
          icon: Bell,
          onClick: () => {
            const fid = facilities[0]?.id;
            if (fid) nav(`/facilities/${fid}/credentials`);
            else nav('/credentials');
          }
        },
        { key: 'settings', label: 'Settings', icon: Settings, onClick: () => setStep('basic') },
        { key: 'addProvider', label: 'Add Provider', icon: UserPlus, onClick: () => nav('/providers') },
        {
          key: 'share',
          label: 'Share',
          icon: Share2,
          onClick: () => { navigator.clipboard?.writeText(window.location.href); alert('Practice profile link copied.'); }
        }
      ]}
      stepIndex={stepIndex}
      stepCount={STEPS.length}
      stepLabel={STEPS[stepIndex]?.label}
      onPrev={() => stepIndex > 0 && setStep(STEPS[stepIndex - 1].key)}
      onNext={() => {
        if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1].key);
        else nav('/practices');
      }}
      centerActions={stepKey === 'banking' ? (
        <button type="button" className="primary" onClick={() => nav('/audit')}>View Banking Logs</button>
      ) : null}
    >
      {error && <div className="error banner">{error}</div>}

      {stepKey === 'basic' && (
        <>
          <SectionHead title="PRACTICE NAME & NPI" onEdit={() => setEditModal('basic')} />
          <div className="info-grid">
            <InfoField label="NPI" value={detail?.npi} />
            <InfoField label="PRACTICE NAME / LEGAL BUSINESS NAME" value={detail?.legalName || detail?.name} />
            <InfoField label="DOING BUSINESS AS" value={detail?.dba} />
            <InfoField label="TAX ID" value={detail?.taxId} />
            <InfoField label="BUSINESS ESTABLISHED DATE" value={fmtDate(detail?.establishedAt)} />
            <InfoField label="TAXONOMY CODE" value={detail?.taxonomyCode} />
          </div>
          <SectionHead title="CONTACT INFORMATION" onEdit={() => setEditModal('contact')} />
          <div className="info-grid">
            <InfoField label="NAME" value={detail?.contactName} />
            <InfoField label="TITLE" value={detail?.contactTitle} />
            <InfoField label="PHONE NUMBER" value={detail?.phone} />
            <InfoField label="FAX NUMBER" value={detail?.fax} />
            <InfoField label="EMAIL" value={detail?.email} className="span-2" />
          </div>
        </>
      )}

      {stepKey === 'address' && (
        <>
          <SectionHead title="MAILING ADDRESS" onEdit={() => setEditModal('address')} />
          <div className="info-grid">
            <InfoField label="STREET ADDRESS" value={addr.street} />
            <InfoField label="ZIP CODE" value={addr.zip} />
            <InfoField label="COUNTY" value={addr.county} />
            <InfoField label="CITY" value={addr.city} />
            <InfoField label="STATE" value={addr.state} />
            <InfoField label="COUNTRY" value={addr.country || 'United States'} />
            <InfoField label="PHONE NUMBER" value={addr.phone || detail?.phone} />
            <InfoField label="FAX NUMBER" value={addr.fax || detail?.fax} />
          </div>
        </>
      )}

      {stepKey === 'owners' && (
        <>
          <div className="ownership-status">
            <InfoField label="STATUS" value="Partnership" />
            <InfoField label="CLASSIFICATION" value="—" />
          </div>
          <div className="ownership-bar-wrap">
            <div className="ownership-bar">
              {owners.map((o, i) => (
                <div
                  key={o.id || i}
                  className={`ownership-seg tone-${i % 2}`}
                  style={{ width: `${Math.min(100, Number(o.ownershipPercent) || 0)}%` }}
                  title={`${o.name} ${o.ownershipPercent}%`}
                >
                  {Number(o.ownershipPercent) >= 8 ? `${Number(o.ownershipPercent)}%` : ''}
                </div>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>Total ownership: {ownershipTotal.toFixed(0)}%</div>
            <ProgressBar value={Math.min(100, ownershipTotal)} showPercent={false} />
          </div>

          <div className="owner-slider">
            <button type="button" className="small-action" disabled={ownerIndex <= 0} onClick={() => setOwnerIndex(i => i - 1)}>‹</button>
            <span>Owner {owners.length ? ownerIndex + 1 : 0} of {owners.length}</span>
            <button type="button" className="small-action" disabled={ownerIndex >= owners.length - 1} onClick={() => setOwnerIndex(i => i + 1)}>›</button>
            <button type="button" className="small-action" onClick={() => setEditModal('owner')}>+ Add</button>
          </div>

          {currentOwner ? (
            <>
              <SectionHead
                title={(currentOwner.name || 'OWNER').toUpperCase()}
                onEdit={() => setEditModal({ type: 'owner', owner: currentOwner })}
                onDelete={() => deleteOwner(currentOwner)}
              />
              <div className="info-grid">
                <InfoField label="NAME" value={currentOwner.name} />
                <InfoField label="OWNERSHIP %" value={`${Number(currentOwner.ownershipPercent)}%`} />
                <MaskedField label="SSN" value={currentOwner.ssn} />
                <InfoField label="DOB" value={fmtDate(currentOwner.dateOfBirth)} />
                <InfoField label="DATE OF OWNERSHIP" value={fmtDate(currentOwner.ownershipDate)} />
                <InfoField label="PLACE OF BIRTH" value={currentOwner.placeOfBirth} />
                <InfoField label="STREET ADDRESS" value={currentOwner.address?.street} />
                <InfoField label="ZIP CODE" value={currentOwner.address?.zip} />
                <InfoField label="COUNTY" value={currentOwner.address?.county} />
                <InfoField label="CITY" value={currentOwner.address?.city} />
                <InfoField label="STATE" value={currentOwner.address?.state} />
                <InfoField label="COUNTRY" value={currentOwner.address?.country} />
                <InfoField label="PHONE NUMBER" value={currentOwner.phone} />
                <InfoField label="FAX NUMBER" value={currentOwner.fax} />
                <InfoField label="EMAIL" value={currentOwner.email} className="span-2" />
              </div>
            </>
          ) : (
            <div className="empty">No owners yet. Add owners so ownership totals 100%.</div>
          )}
        </>
      )}

      {stepKey === 'banking' && (
        <>
          <SectionHead title="ACCOUNT HOLDER CREDENTIALS" onEdit={() => setEditModal('banking')} />
          <div className="info-grid">
            <InfoField label="NAME OF BANK" value={detail?.bankName} />
            <InfoField label="ACCOUNT TITLE" value={detail?.bankAccountTitle} />
            <MaskedField label="ACCOUNT NUMBER" value={detail?.bankAccountNumber} />
            <MaskedField label="FINANCIAL INSTITUTION ROUTING NUMBER" value={detail?.bankRoutingNumber} />
          </div>
          <SectionHead title="BANK CONTACT PERSON DETAILS" onEdit={() => setEditModal('banking')} />
          <div className="info-grid">
            <InfoField label="NAME" value={detail?.bankContactName} />
            <InfoField label="PHONE NUMBER" value={detail?.bankContactPhone} />
            <InfoField label="EMAIL" value={detail?.bankContactEmail} className="span-2" />
          </div>
        </>
      )}

      {editModal && (
        <EditModal
          title={typeof editModal === 'object' ? 'Edit Owner' : `Edit ${editModal}`}
          onClose={() => setEditModal(null)}
          saving={saving}
        >
          {(editModal === 'basic' || editModal === 'contact') && (
            <BasicForm
              detail={detail}
              orgs={orgs}
              mode={editModal}
              onSave={async (form) => {
                await saveSection({
                  organizationId: form.organizationId || detail?.organizationId,
                  name: form.name,
                  legalName: form.legalName,
                  dba: form.dba,
                  npi: form.npi,
                  taxId: form.taxId,
                  taxonomyCode: form.taxonomyCode,
                  establishedAt: form.establishedAt ? new Date(`${form.establishedAt}T12:00:00`).toISOString() : null,
                  contactName: form.contactName,
                  contactTitle: form.contactTitle,
                  phone: form.phone,
                  fax: form.fax,
                  email: form.email,
                  status: form.status || detail?.status || 'ACTIVE'
                });
              }}
            />
          )}
          {editModal === 'address' && (
            <AddressForm
              addr={addr}
              onSave={async (form) => {
                await saveSection({ mailingAddress: form, primaryAddress: form });
              }}
            />
          )}
          {editModal === 'banking' && (
            <BankingForm
              detail={detail}
              onSave={async (form) => { await saveSection(form); }}
            />
          )}
          {(editModal === 'owner' || editModal?.type === 'owner') && (
            <OwnerForm
              owner={editModal?.owner || null}
              onSave={saveOwner}
            />
          )}
        </EditModal>
      )}
    </DirectoryProfileShell>
  );
}

function SectionHead({ title, onEdit, onDelete }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      <div className="section-head-actions">
        {onEdit && <button type="button" className="icon-round" onClick={onEdit} aria-label="Edit"><Pencil size={14} /></button>}
        {onDelete && <button type="button" className="icon-round danger" onClick={onDelete} aria-label="Delete"><Trash2 size={14} /></button>}
      </div>
    </div>
  );
}

function EditModal({ title, children, onClose, saving }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="record-modal">
        <div className="modal-heading">
          <div><span className="eyebrow">EDIT</span><h2>{title}</h2></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {saving && <div className="muted" style={{ padding: '0 23px 16px' }}>Saving…</div>}
      </div>
    </div>
  );
}

function BasicForm({ detail, orgs, mode, onSave }) {
  const [form, setForm] = useState({
    organizationId: detail?.organizationId || '',
    name: detail?.name || '',
    legalName: detail?.legalName || '',
    dba: detail?.dba || '',
    npi: detail?.npi || '',
    taxId: detail?.taxId || '',
    taxonomyCode: detail?.taxonomyCode || '',
    establishedAt: detail?.establishedAt ? String(detail.establishedAt).slice(0, 10) : '',
    contactName: detail?.contactName || '',
    contactTitle: detail?.contactTitle || '',
    phone: detail?.phone || '',
    fax: detail?.fax || '',
    email: detail?.email || '',
    status: detail?.status || 'ACTIVE'
  });
  return (
    <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
      {mode === 'basic' && (
        <>
          <label>Organization
            <select required value={form.organizationId} onChange={e => setForm({ ...form, organizationId: e.target.value })}>
              <option value="">Select…</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.legalName}</option>)}
            </select>
          </label>
          <label>Practice Name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label>Legal Business Name<input value={form.legalName} onChange={e => setForm({ ...form, legalName: e.target.value })} /></label>
          <label>DBA<input value={form.dba} onChange={e => setForm({ ...form, dba: e.target.value })} /></label>
          <label>NPI<input value={form.npi} onChange={e => setForm({ ...form, npi: e.target.value })} /></label>
          <label>Tax ID<input value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} /></label>
          <label>Taxonomy Code<input value={form.taxonomyCode} onChange={e => setForm({ ...form, taxonomyCode: e.target.value })} /></label>
          <label>Established Date<input type="date" value={form.establishedAt} onChange={e => setForm({ ...form, establishedAt: e.target.value })} /></label>
        </>
      )}
      {mode === 'contact' && (
        <>
          <label>Contact Name<input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></label>
          <label>Title<input value={form.contactTitle} onChange={e => setForm({ ...form, contactTitle: e.target.value })} /></label>
          <label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Fax<input value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} /></label>
          <label className="span-2">Email<input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        </>
      )}
      <div className="modal-footer span-2" style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="primary">Save changes</button>
      </div>
    </form>
  );
}

function AddressForm({ addr, onSave }) {
  const [form, setForm] = useState({
    street: addr.street || '', suite: addr.suite || '', zip: addr.zip || '', county: addr.county || '',
    city: addr.city || '', state: addr.state || '', country: addr.country || 'United States',
    phone: addr.phone || '', fax: addr.fax || ''
  });
  return (
    <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <label className="span-2">Street Address<input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></label>
      <label>Suite<input value={form.suite} onChange={e => setForm({ ...form, suite: e.target.value })} /></label>
      <label>ZIP<input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></label>
      <label>County<input value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} /></label>
      <label>City<input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
      <label>State<input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></label>
      <label>Country<input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></label>
      <label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <label>Fax<input value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} /></label>
      <div className="modal-footer span-2" style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="primary">Save address</button>
      </div>
    </form>
  );
}

function BankingForm({ detail, onSave }) {
  const [form, setForm] = useState({
    bankName: detail?.bankName || '',
    bankAccountTitle: detail?.bankAccountTitle || '',
    bankAccountNumber: detail?.bankAccountNumber || '',
    bankRoutingNumber: detail?.bankRoutingNumber || '',
    bankContactName: detail?.bankContactName || '',
    bankContactPhone: detail?.bankContactPhone || '',
    bankContactEmail: detail?.bankContactEmail || ''
  });
  return (
    <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <label>Name of Bank<input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} /></label>
      <label>Account Title<input value={form.bankAccountTitle} onChange={e => setForm({ ...form, bankAccountTitle: e.target.value })} /></label>
      <label>Account Number<input value={form.bankAccountNumber} onChange={e => setForm({ ...form, bankAccountNumber: e.target.value })} autoComplete="off" /></label>
      <label>Routing Number<input value={form.bankRoutingNumber} onChange={e => setForm({ ...form, bankRoutingNumber: e.target.value })} autoComplete="off" /></label>
      <label>Bank Contact Name<input value={form.bankContactName} onChange={e => setForm({ ...form, bankContactName: e.target.value })} /></label>
      <label>Phone<input value={form.bankContactPhone} onChange={e => setForm({ ...form, bankContactPhone: e.target.value })} /></label>
      <label className="span-2">Email<input value={form.bankContactEmail} onChange={e => setForm({ ...form, bankContactEmail: e.target.value })} /></label>
      <div className="modal-footer span-2" style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="primary">Save banking</button>
      </div>
    </form>
  );
}

function OwnerForm({ owner, onSave }) {
  const [form, setForm] = useState({
    id: owner?.id,
    name: owner?.name || '',
    ownershipPercent: owner?.ownershipPercent ?? '',
    ssn: owner?.ssn || '',
    dateOfBirth: owner?.dateOfBirth ? String(owner.dateOfBirth).slice(0, 10) : '',
    ownershipDate: owner?.ownershipDate ? String(owner.ownershipDate).slice(0, 10) : '',
    placeOfBirth: owner?.placeOfBirth || '',
    phone: owner?.phone || '',
    fax: owner?.fax || '',
    email: owner?.email || '',
    street: owner?.address?.street || '',
    zip: owner?.address?.zip || '',
    county: owner?.address?.county || '',
    city: owner?.address?.city || '',
    state: owner?.address?.state || '',
    country: owner?.address?.country || 'USA'
  });
  return (
    <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <label>Owner Name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>Ownership %<input required type="number" min="0.01" max="100" step="0.01" value={form.ownershipPercent} onChange={e => setForm({ ...form, ownershipPercent: e.target.value })} /></label>
      <label>SSN<input value={form.ssn} onChange={e => setForm({ ...form, ssn: e.target.value })} /></label>
      <label>DOB<input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></label>
      <label>Date of Ownership<input type="date" value={form.ownershipDate} onChange={e => setForm({ ...form, ownershipDate: e.target.value })} /></label>
      <label>Place of Birth<input value={form.placeOfBirth} onChange={e => setForm({ ...form, placeOfBirth: e.target.value })} /></label>
      <label className="span-2">Street<input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></label>
      <label>ZIP<input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></label>
      <label>County<input value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} /></label>
      <label>City<input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
      <label>State<input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></label>
      <label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <label>Fax<input value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} /></label>
      <label className="span-2">Email<input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <div className="modal-footer span-2" style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="primary">Save owner</button>
      </div>
    </form>
  );
}
