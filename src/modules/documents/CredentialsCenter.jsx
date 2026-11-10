import React, { useEffect, useState } from 'react';
import { Download, FileText, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { fmt } from '../../utils/format';

export default function CredentialsCenter() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('organization');
  const [rows, setRows] = useState([]);
  const [attention, setAttention] = useState({ counts: {}, expiringSoon: [], expired: [], missingRequired: [] });
  const [orgs, setOrgs] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ organizationId: '', facilityId: '', q: '' });

  async function loadMeta() {
    const [cats, o, f] = await Promise.all([
      api.get('/credentials/categories'),
      api.get('/organizations', { params: { limit: 100 } }),
      api.get('/facilities', { params: { limit: 100 } })
    ]);
    setCategories(cats.data);
    setOrgs(o.data);
    setFacilities(f.data);
    if (cats.data?.[0]?.key) setCategory(prev => prev || cats.data[0].key);
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = {
        category,
        limit: 100,
        ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
        ...(filters.facilityId ? { facilityId: filters.facilityId } : {}),
        ...(filters.q ? { q: filters.q } : {})
      };
      const [list, attn] = await Promise.all([
        api.get('/credentials', { params }),
        api.get('/credentials/attention', {
          params: {
            ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
            ...(filters.facilityId ? { facilityId: filters.facilityId } : {})
          }
        })
      ]);
      setRows(list.data);
      setAttention(attn.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load credentials.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMeta().catch(e => setError(e.response?.data?.error || 'Could not load credential categories.'));
  }, []);

  useEffect(() => { load(); }, [category, filters.organizationId, filters.facilityId]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    body.ignored = fd.get('ignored') === 'on';
    body.required = fd.get('required') === 'on';
    body.reportingRequired = fd.get('reportingRequired') === 'on';
    body.category = category;
    if (body.expiresAt) body.expiresAt = new Date(`${body.expiresAt}T12:00:00`).toISOString();
    if (body.issuedAt) body.issuedAt = new Date(`${body.issuedAt}T12:00:00`).toISOString();
    if (body.warningDays) body.warningDays = Number(body.warningDays);
    ['organizationId', 'facilityId', 'practiceId', 'providerId'].forEach(k => { if (!body[k]) delete body[k]; });
    try {
      if (editing) await api.patch(`/credentials/${editing.id}`, body);
      else await api.post('/credentials', body);
      setModal(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save credential.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!confirm(`Delete credential "${row.title}"?`)) return;
    try {
      await api.delete(`/credentials/${row.id}`);
      await load();
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
      await load();
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

  async function toggleIgnore(row) {
    try {
      await api.patch(`/credentials/${row.id}`, { ignored: !row.ignored });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not update ignore flag.');
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="CREDENTIALS & DOCUMENTS"
        title="Credential Document Center"
        description="Category-based credentials with expiration tracking, required flags, and authorized private file access."
        breadcrumbs={[
          { label: 'Directory', to: '/organizations' },
          { label: 'Credentials' }
        ]}
        back={{ label: 'Back', fallbackHref: null, autoLabel: true, hideIfNoTarget: true, listKey: 'credentials' }}
        actions={<button className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>}
      />
      {error && <div className="error banner">{error}</div>}

      <div className="cred-attention-row">
        <div className="cred-attn-card danger"><b>{attention.counts?.expired ?? 0}</b><span>Expired</span></div>
        <div className="cred-attn-card warning"><b>{attention.counts?.expiringSoon ?? 0}</b><span>Expiring soon</span></div>
        <div className="cred-attn-card amber"><b>{attention.counts?.missingRequired ?? 0}</b><span>Missing required</span></div>
      </div>

      <div className="cred-layout">
        <aside className="panel cred-categories">
          <div className="panel-heading"><div><h2>Document categories</h2><p>Select a category</p></div></div>
          <div className="cred-cat-list">
            {categories.map(c => (
              <button
                key={c.key}
                type="button"
                className={`cred-cat ${category === c.key ? 'active' : ''}`}
                onClick={() => setCategory(c.key)}
              >
                <FileText size={16} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel table-panel">
          <div className="table-toolbar cred-toolbar">
            <div className="cred-filters">
              <select value={filters.organizationId} onChange={e => setFilters(f => ({ ...f, organizationId: e.target.value }))}>
                <option value="">All organizations</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.legalName}</option>)}
              </select>
              <select value={filters.facilityId} onChange={e => setFilters(f => ({ ...f, facilityId: e.target.value }))}>
                <option value="">All facilities</option>
                {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <input placeholder="Search credential" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} onKeyDown={e => e.key === 'Enter' && load()} />
            </div>
            <button className="primary" onClick={() => { setEditing(null); setModal(true); }}><Plus size={15} /> Add new</button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Credential Name</th>
                  <th>Expiration</th>
                  <th>Attention</th>
                  <th>Created At</th>
                  <th>Created By</th>
                  <th>File</th>
                  <th className="action-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="table-empty">Loading credentials…</td></tr>
                ) : !rows.length ? (
                  <tr><td colSpan="7" className="table-empty">No credentials in this category yet.</td></tr>
                ) : rows.map(row => (
                  <tr key={row.id}>
                    <td>
                      <span className="cell-strong">{row.title}</span>
                      <div className="muted" style={{ fontSize: 9, marginTop: 4 }}>
                        {row.type}
                        {row.required ? ' · Required' : ''}
                        {row.ignored ? ' · Ignored' : ''}
                        {row.reportingRequired ? ' · Reporting' : ''}
                      </div>
                    </td>
                    <td>{fmt(row.expiresAt)}</td>
                    <td><StatusBadge value={row.attention || row.status} /></td>
                    <td>{fmt(row.createdAt)}</td>
                    <td>{row.createdBy?.name || '—'}</td>
                    <td>{row.storageKey ? row.originalName || 'Attached' : '—'}</td>
                    <td>
                      <div className="row-actions">
                        {row.storageKey && <button className="small-action" onClick={() => download(row)}><Download size={12} /> Download</button>}
                        <label className="small-action upload-action"><Upload size={12} /> Upload<input hidden type="file" accept={category === 'other' || row.category === 'other' || category === 'agreements' || row.category === 'agreements' ? '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png' : '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx'} onChange={e => upload(row, e.target.files?.[0])} /></label>
                        <button className="small-action" onClick={() => { setEditing(row); setModal(true); }}>Edit</button>
                        <button className="small-action" onClick={() => toggleIgnore(row)}>{row.ignored ? 'Unignore' : 'Ignore'}</button>
                        <button className="small-action danger-text" onClick={() => remove(row)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel right-context">
          <div className="panel-heading"><div><h2>Credential attention</h2><p>Ignored items are excluded from missing required</p></div></div>
          <div className="right-context-body">
            <div className="context-block">
              <b>Expiring soon</b>
              {(attention.expiringSoon || []).slice(0, 5).map(d => <span key={d.id}>{d.title} · {fmt(d.expiresAt)}</span>)}
              {!attention.expiringSoon?.length && <span>None</span>}
            </div>
            <div className="context-block">
              <b>Expired</b>
              {(attention.expired || []).slice(0, 5).map(d => <span key={d.id}>{d.title}</span>)}
              {!attention.expired?.length && <span>None</span>}
            </div>
            <div className="context-block">
              <b>Missing required</b>
              {(attention.missingRequired || []).slice(0, 5).map(d => <span key={d.id}>{d.title}</span>)}
              {!attention.missingRequired?.length && <span>None</span>}
            </div>
          </div>
        </aside>
      </div>

      {modal && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setModal(false)}>
          <form className="record-modal" onSubmit={save}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{editing ? 'UPDATE CREDENTIAL' : 'NEW CREDENTIAL'}</span>
                <h2>{editing ? 'Edit credential' : 'Add credential'}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setModal(false)}><X size={20} /></button>
            </div>
            <div className="form-grid">
              <label>Credential Name<input name="title" required defaultValue={editing?.title || ''} /></label>
              <label>Type / Document Type<input name="type" required defaultValue={editing?.type || ''} /></label>
              <label>Issued At<input type="date" name="issuedAt" defaultValue={editing?.issuedAt ? String(editing.issuedAt).slice(0, 10) : ''} /></label>
              <label>Expiration Date<input type="date" name="expiresAt" defaultValue={editing?.expiresAt ? String(editing.expiresAt).slice(0, 10) : ''} /></label>
              <label>Warning Days
                <select name="warningDays" defaultValue={editing?.warningDays || 30}>
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={120}>120 Days</option>
                </select>
              </label>
              <label>Organization
                <select name="organizationId" defaultValue={editing?.organizationId || filters.organizationId || ''}>
                  <option value="">Optional…</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.legalName}</option>)}
                </select>
              </label>
              <label>Facility
                <select name="facilityId" defaultValue={editing?.facilityId || filters.facilityId || ''}>
                  <option value="">Optional…</option>
                  {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <label className="span-2">Notes<textarea name="notes" rows="3" defaultValue={editing?.notes || ''} /></label>
              <label><span><input type="checkbox" name="required" defaultChecked={editing?.required || false} /> Required</span></label>
              <label><span><input type="checkbox" name="reportingRequired" defaultChecked={editing?.reportingRequired || false} /> Reporting requirement</span></label>
              <label><span><input type="checkbox" name="ignored" defaultChecked={editing?.ignored || false} /> Ignore (exclude from missing required)</span></label>
            </div>
            <div className="modal-footer">
              <span className="muted">Files upload after the credential record is created.</span>
              <button type="button" className="secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
