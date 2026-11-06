import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity, Bell, Check, ChevronDown, ChevronRight, Download, FileText, FolderOpen,
  Pencil, Plus, Settings, Share2, Trash2, Upload, X
} from 'lucide-react';
import api from '../../api/client';
import DirectoryProfileShell from '../../components/layout/DirectoryProfileShell';
import { fmt } from '../../utils/format';

const FACILITY_STEPS = [
  { key: 'basic', label: 'Basic Information' },
  { key: 'address', label: 'Address & Contact Information' },
  { key: 'timings', label: 'Facility Timings & Duration' },
  { key: 'providers', label: 'Individual Providers' },
  { key: 'contacts', label: 'Contacts' }
];

export default function FacilityCredentials() {
  const { id } = useParams();
  const nav = useNavigate();
  const [detail, setDetail] = useState(null);
  const [practices, setPractices] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('banking');
  const [expanded, setExpanded] = useState({ banking: true });
  const [rows, setRows] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [attention, setAttention] = useState({ counts: {}, expiringSoon: [] });
  const [selectedType, setSelectedType] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ignoreType, setIgnoreType] = useState(false);

  const completion = useMemo(() => {
    if (!detail) return 0;
    const addr = detail.address || {};
    const basic = detail.name && (detail.organizationId || detail.practiceId);
    const address = addr.street && addr.city;
    const sched = detail.schedule && Object.keys(detail.schedule).length;
    const providers = (detail.providers || []).length > 0;
    const contacts = (detail.contacts || []).length > 0;
    return Math.round(([basic, address, sched, providers, contacts].filter(Boolean).length / 5) * 100);
  }, [detail]);

  async function loadShell() {
    const [d, p, f, cats] = await Promise.all([
      api.get(`/directory/facilities/${id}/detail`),
      api.get('/practices', { params: { limit: 100 } }),
      api.get('/facilities', { params: { limit: 100 } }),
      api.get('/credentials/categories')
    ]);
    setDetail(d.data);
    setPractices(p.data);
    setFacilities(f.data);
    setCategories(cats.data);
  }

  async function loadDocs() {
    const [list, attn, all] = await Promise.all([
      api.get('/credentials', { params: { facilityId: id, category, limit: 100 } }),
      api.get('/credentials/attention', { params: { facilityId: id } }),
      api.get('/credentials', { params: { facilityId: id, limit: 200 } })
    ]);
    setRows(list.data);
    setAttention(attn.data);
    setAllDocs(all.data);
    if (!selectedType && list.data[0]) setSelectedType(list.data[0].type);
  }

  useEffect(() => {
    loadShell().catch(e => setError(e.response?.data?.error || 'Could not load facility.'));
  }, [id]);

  useEffect(() => {
    if (id) loadDocs().catch(e => setError(e.response?.data?.error || 'Could not load credentials.'));
  }, [id, category]);

  const typesInCategory = useMemo(() => {
    const catMeta = categories.find(c => c.key === category);
    const catalog = catMeta?.types || [];
    const map = new Map();
    catalog.forEach(t => map.set(t.type, { type: t.type, docs: [], required: !!t.required, reporting: !!t.reporting }));
    allDocs.filter(d => d.category === category).forEach(d => {
      if (!map.has(d.type)) map.set(d.type, { type: d.type, docs: [], required: !!d.required, reporting: !!d.reportingRequired });
      map.get(d.type).docs.push(d);
    });
    return [...map.values()].map(entry => {
      const { type, docs } = entry;
      const attentions = docs.map(d => d.attention);
      let status = 'MISSING';
      if (docs.length && (attentions.includes('AVAILABLE') || attentions.includes('EXPIRING_SOON'))) {
        status = attentions.includes('EXPIRING_SOON') ? 'EXPIRING_SOON' : 'AVAILABLE';
      }
      if (docs.length && attentions.every(a => a === 'EXPIRED')) status = 'EXPIRED';
      if (!docs.length || attentions.every(a => a === 'MISSING')) status = 'MISSING';
      return {
        type,
        docs,
        required: docs.length ? docs.some(d => d.required) : entry.required,
        reporting: docs.length ? docs.some(d => d.reportingRequired) : entry.reporting,
        status,
        ignored: docs.length ? docs.every(d => d.ignored) : false
      };
    });
  }, [allDocs, category, categories]);

  const tableRows = useMemo(() => {
    if (selectedType) return rows.filter(r => r.type === selectedType);
    return rows;
  }, [rows, selectedType]);

  useEffect(() => {
    if (selectedType) {
      const match = typesInCategory.find(t => t.type === selectedType);
      setIgnoreType(!!match?.ignored);
    }
  }, [selectedType, typesInCategory]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    body.required = fd.get('required') === 'on';
    body.reportingRequired = fd.get('reportingRequired') === 'on';
    body.ignored = fd.get('ignored') === 'on';
    body.category = category;
    body.facilityId = id;
    if (body.warningDays) body.warningDays = Number(body.warningDays);
    if (detail?.organizationId) body.organizationId = detail.organizationId;
    if (detail?.practiceId) body.practiceId = detail.practiceId;
    if (body.expiresAt) body.expiresAt = new Date(`${body.expiresAt}T12:00:00`).toISOString();
    if (body.issuedAt) body.issuedAt = new Date(`${body.issuedAt}T12:00:00`).toISOString();
    ['organizationId', 'practiceId', 'facilityId'].forEach(k => { if (!body[k]) delete body[k]; });
    try {
      if (editing) await api.patch(`/credentials/${editing.id}`, body);
      else await api.post('/credentials', body);
      setModal(false);
      setEditing(null);
      await loadDocs();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save credential.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!confirm(`Delete credential "${row.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/credentials/${row.id}`);
      await loadDocs();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  }

  async function upload(row, file) {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      await api.post(`/documents/${row.id}/file`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadDocs();
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed.');
    }
  }

  async function download(row) {
    try {
      const r = await api.get(`/documents/${row.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.originalName || row.title || 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.response?.data?.error || 'Download failed.');
    }
  }

  async function toggleIgnoreType(checked) {
    setIgnoreType(checked);
    const targets = tableRows.length ? tableRows : rows.filter(r => r.type === selectedType);
    try {
      await Promise.all(targets.map(r => api.patch(`/credentials/${r.id}`, { ignored: checked })));
      await loadDocs();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not update ignore flag.');
    }
  }

  function statusDot(status) {
    const map = { MISSING: 'miss', EXPIRED: 'exp', EXPIRING_SOON: 'soon', AVAILABLE: 'ok' };
    return map[status] || 'miss';
  }

  return (
    <DirectoryProfileShell
      entityType="FACILITY"
      title={detail?.name || 'Facility'}
      status={detail?.status || 'ACTIVE'}
      npi={detail?.npi}
      taxId={practices.find(p => p.id === detail?.practiceId)?.taxId}
      completion={completion}
      breadcrumb={[
        { label: 'Directory', to: '/organizations' },
        { label: 'Facilities', to: '/facilities' },
        { label: detail?.name || 'Facility', to: `/facilities/${id}/profile` },
        { label: 'Credentials' }
      ]}
      listKey="facilities"
      backLabel="Back to Facility"
      backFallback={`/facilities/${id}/profile`}
      backHints={{ facilityId: id, practiceId: detail?.practiceId, organizationId: detail?.organizationId }}
      practices={practices}
      selectedPracticeId={detail?.practiceId || ''}
      onSelectPractice={(pid) => pid && nav(`/practices/${pid}/profile`)}
      facilities={facilities}
      selectedFacilityId={id}
      onSelectFacility={(fid) => nav(`/facilities/${fid}/credentials`)}
      steps={FACILITY_STEPS}
      activeStepKey="basic"
      onStepChange={(key) => nav(`/facilities/${id}/profile?step=${key}`)}
      rightMode="facility"
      attention={attention}
      onRequestInfo={() => alert('Request facility info queued for the responsible assignee.')}
      quickActions={[
        {
          key: 'w9',
          label: 'W-9 Form',
          icon: FileText,
          onClick: () => {
            setCategory('irs');
            setExpanded(e => ({ ...e, irs: true }));
            setSelectedType('W-9 Form');
          }
        },
        { key: 'credentials', label: 'Credentials', icon: FolderOpen, onClick: () => nav(`/facilities/${id}/credentials`) },
        { key: 'enrollments', label: 'Enrollments', icon: FileText, onClick: () => nav('/enrollments') },
        {
          key: 'share',
          label: 'Share',
          icon: Share2,
          onClick: () => { navigator.clipboard?.writeText(window.location.href); alert('Credentials link copied.'); }
        },
        { key: 'alerts', label: 'Alerts', icon: Bell, onClick: () => document.querySelector('.attn-box')?.scrollIntoView({ behavior: 'smooth' }) },
        { key: 'activity', label: 'Activity', icon: Activity, onClick: () => nav('/audit') },
        { key: 'settings', label: 'Settings', icon: Settings, onClick: () => nav(`/facilities/${id}/profile?step=basic`) }
      ]}
      stepIndex={0}
      stepCount={5}
      stepLabel="Credentials"
      onPrev={() => nav(`/facilities/${id}/profile?step=contacts`)}
      onNext={() => nav(`/facilities/${id}/profile?step=basic`)}
    >
      {error && <div className="error banner">{error}</div>}

      <div className="cred-split">
        <aside className="cred-left-panel">
          <div className="cred-left-head">
            <FolderOpen size={16} />
            <div>
              <b>Credentials</b>
              <small>Document categories</small>
            </div>
          </div>
          <div className="cred-legend">
            <span><i className="dot miss" /> Missing</span>
            <span><i className="dot exp" /> Expired</span>
            <span><i className="dot soon" /> Expiring soon</span>
            <span><i className="dot ok" /> Available</span>
          </div>
          <div className="cred-acc-list">
            {categories.map(c => {
              const open = !!expanded[c.key];
              const isActive = category === c.key;
              return (
                <div key={c.key} className={`cred-acc ${isActive ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="cred-acc-btn"
                    onClick={() => {
                      setCategory(c.key);
                      setExpanded(prev => ({ ...prev, [c.key]: !prev[c.key] }));
                      setSelectedType(null);
                    }}
                  >
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>{c.label}</span>
                  </button>
                  {open && isActive && (
                    <div className="cred-acc-body">
                      <table className="cred-mini-table">
                        <thead>
                          <tr><th>NAME</th><th>REQUIRED</th><th>REPORTING</th></tr>
                        </thead>
                        <tbody>
                          {typesInCategory.length === 0 && (
                            <tr><td colSpan="3" className="muted">No documents in category</td></tr>
                          )}
                          {typesInCategory.map(t => (
                            <tr
                              key={t.type}
                              className={selectedType === t.type ? 'selected' : ''}
                              onClick={() => setSelectedType(t.type)}
                            >
                              <td>
                                <i className={`dot ${statusDot(t.status)}`} />
                                {t.type}
                              </td>
                              <td>{t.required ? <Check size={14} className="ok-ico" /> : <X size={14} className="bad-ico" />}</td>
                              <td>{t.reporting ? <Check size={14} className="ok-ico" /> : <X size={14} className="bad-ico" />}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="cred-right-panel">
          <div className="cred-right-head">
            <div>
              <h2>{selectedType || categories.find(c => c.key === category)?.label || 'Credentials'}</h2>
              <label className="ignore-toggle">
                <input
                  type="checkbox"
                  checked={ignoreType}
                  disabled={!selectedType || !tableRows.length}
                  onChange={e => toggleIgnoreType(e.target.checked)}
                />
                Ignore this credential
              </label>
            </div>
            <button type="button" className="primary" onClick={() => { setEditing(null); setModal(true); }}>
              <Plus size={15} /> Add New
            </button>
          </div>

          <div className="table-scroll">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>S. NO</th>
                  <th>CREDENTIAL</th>
                  <th>EXPIRATION DATE</th>
                  <th>CREATED AT</th>
                  <th>CREATED BY</th>
                  <th>FILE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={row.id}>
                    <td>{i + 1}</td>
                    <td className="cell-strong">{row.title}</td>
                    <td>{fmt(row.expiresAt)}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                    <td>{row.createdBy?.name || '—'}</td>
                    <td>{row.storageKey ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="row-actions">
                        {row.storageKey && (
                          <button type="button" className="icon-round" title="Download" onClick={() => download(row)}>
                            <Download size={13} />
                          </button>
                        )}
                        <label className="icon-round upload-action" title="Upload">
                          <Upload size={13} />
                          <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx" onChange={e => upload(row, e.target.files?.[0])} />
                        </label>
                        <button type="button" className="icon-round" title="Edit" onClick={() => { setEditing(row); setModal(true); }}>
                          <Pencil size={13} />
                        </button>
                        <button type="button" className="icon-round danger" title="Delete" onClick={() => remove(row)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!tableRows.length && (
                  <tr><td colSpan="7" className="table-empty">No credentials yet. Click Add New.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modal && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setModal(false)}>
          <form className="record-modal" onSubmit={save}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{editing ? 'UPDATE' : 'NEW'}</span>
                <h2>{editing ? 'Edit credential' : 'Add credential'}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setModal(false)}><X size={20} /></button>
            </div>
            <div className="form-grid">
              <label>Credential Name<input name="title" required defaultValue={editing?.title || selectedType || ''} /></label>
              <label>Type<input name="type" required defaultValue={editing?.type || selectedType || ''} /></label>
              <label>Issued At<input type="date" name="issuedAt" defaultValue={editing?.issuedAt ? String(editing.issuedAt).slice(0, 10) : ''} /></label>
              <label>Expiration Date<input type="date" name="expiresAt" defaultValue={editing?.expiresAt ? String(editing.expiresAt).slice(0, 10) : ''} /></label>
              <label>Warning days<input type="number" min="1" name="warningDays" defaultValue={editing?.warningDays || 30} /></label>
              <label className="span-2">Notes<textarea name="notes" rows="2" defaultValue={editing?.notes || ''} /></label>
              <label><span><input type="checkbox" name="required" defaultChecked={editing?.required || false} /> Required</span></label>
              <label><span><input type="checkbox" name="reportingRequired" defaultChecked={editing?.reportingRequired || false} /> Reporting requirement</span></label>
              <label><span><input type="checkbox" name="ignored" defaultChecked={editing?.ignored || false} /> Ignore</span></label>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </DirectoryProfileShell>
  );
}
