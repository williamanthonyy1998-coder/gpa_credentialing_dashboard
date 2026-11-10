import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Plus, Search, X } from 'lucide-react';
import api from '../../api/client';
import { config } from '../../config/resources';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { fmt, nested } from '../../utils/format';
import { currentListPath, LIST_KEYS, saveListReturn } from '../../navigation/listReturn';

const PROFILE_TYPES = new Set(['practices', 'facilities', 'providers']);
const WORKSPACE_TYPES = new Set(['organizations']);

function listBreadcrumbs(type, scopedId, orgName) {
  if (scopedId) {
    return [
      { label: 'Directory', to: '/organizations' },
      { label: orgName || 'Organization', to: `/organizations/${scopedId}/overview` },
      { label: config[type]?.title || type }
    ];
  }
  return [
    { label: 'Directory', to: '/organizations' },
    { label: config[type]?.title || type }
  ];
}

export default function RecordPage({ type, scopedId, orgName }) {
  const cfg = config[type];
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [refs, setRefs] = useState({});
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Keep list query in the URL so refresh / back restore works.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (q) next.set('q', q);
    else next.delete('q');
    const nextStr = next.toString();
    if (nextStr !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [q]);

  useEffect(() => {
    const path = currentListPath(window.location.pathname, q ? `?q=${encodeURIComponent(q)}` : '');
    if (LIST_KEYS[type]) saveListReturn(LIST_KEYS[type], path);
  }, [type, q, scopedId]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [r, ...related] = await Promise.all([
        api.get(`/${cfg.resource}`, { params: { q, limit: 100, ...(scopedId ? { organizationId: scopedId } : {}) } }),
        ...cfg.fields.filter(f => f[2] === 'relation').map(f =>
          api.get(`/${f[3]}`, { params: { limit: 100, ...(scopedId ? { organizationId: scopedId } : {}) } })
        )
      ]);
      setRows(r.data);
      const names = cfg.fields.filter(f => f[2] === 'relation');
      setRefs(Object.fromEntries(names.map((f, i) => [f[3], related[i].data])));
    } catch (e) {
      setError(e.response?.data?.error || `Could not load ${cfg.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q, type, scopedId]);

  function start(row = null) {
    setEditing(row);
    setModal(true);
  }

  // Deep-link: /providers?edit=<id> opens the edit modal (e.g. from facility affiliations).
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || loading || !rows.length) return;
    const row = rows.find(r => r.id === editId);
    if (!row) return;
    start(row);
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
  }, [rows, loading, searchParams]);

  function openRecord(row) {
    const returnTo = currentListPath(window.location.pathname, window.location.search);
    if (LIST_KEYS[type]) saveListReturn(LIST_KEYS[type], returnTo);

    if (WORKSPACE_TYPES.has(type)) {
      nav(`/organizations/${row.id}/overview`, { state: { returnTo, organizationId: row.id } });
      return;
    }
    if (type === 'practices') {
      nav(`/practices/${row.id}/profile`, {
        state: {
          returnTo,
          listKey: 'practices',
          practiceId: row.id,
          organizationId: row.organizationId || scopedId || undefined
        }
      });
      return;
    }
    if (type === 'facilities') {
      nav(`/facilities/${row.id}/profile`, {
        state: {
          returnTo,
          listKey: 'facilities',
          facilityId: row.id,
          practiceId: row.practiceId || undefined,
          organizationId: row.organizationId || scopedId || undefined
        }
      });
      return;
    }
    if (type === 'providers') {
      nav(`/providers/${row.id}/profile`, {
        state: {
          returnTo,
          listKey: 'providers',
          providerId: row.id
        }
      });
      return;
    }
    start(row);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const body = {};
    cfg.fields.forEach(f => {
      let v = fd.get(f[0]);
      if (v !== null && v !== '') {
        if (f[2] === 'date') v = new Date(`${v}T12:00:00`).toISOString();
        body[f[0]] = v;
      }
    });
    if (scopedId && ['practices', 'facilities', 'enrollments', 'documents'].includes(type)) {
      body.organizationId = scopedId;
    }
    try {
      if (editing) {
        await api.patch(`/${cfg.resource}/${editing.id}`, body);
      } else {
        const created = (await api.post(`/${cfg.resource}`, body)).data;
        if (scopedId && type === 'providers') {
          await api.post('/providerOrganizations', {
            providerId: created.id,
            organizationId: scopedId,
            status: 'ACTIVE',
            effectiveAt: new Date().toISOString()
          });
        }
        if (PROFILE_TYPES.has(type) && created?.id) {
          const returnTo = currentListPath(window.location.pathname, window.location.search);
          nav(`/${type}/${created.id}/profile`, { state: { returnTo, listKey: type } });
          return;
        }
      }
      setModal(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details?.map(x => x.message).join(', ') || 'Could not save record.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!confirm(`Delete this ${cfg.singular.toLowerCase()}? This may be blocked if related records depend on it.`)) return;
    try {
      await api.delete(`/${cfg.resource}/${row.id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  }

  async function uploadFile(row, file) {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      await api.post(`/documents/${row.id}/file`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'File upload failed.');
    }
  }

  async function downloadFile(row) {
    try {
      const r = await api.get(`/documents/${row.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.originalName || row.title || 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.response?.data?.error || 'File download failed.');
    }
  }

  async function toggleStatus(row) {
    const next = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/${cfg.resource}/${row.id}`, { status: next });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not update status.');
    }
  }

  // Top-level listings: Back only when a real previous page / return context exists.
  // Nested org sections: fall back to organization overview — never Dashboard.
  const back = scopedId
    ? {
      label: 'Back to Organization',
      fallbackHref: `/organizations/${scopedId}/overview`,
      autoLabel: true,
      hints: { organizationId: scopedId }
    }
    : {
      label: 'Back',
      fallbackHref: null,
      listKey: LIST_KEYS[type],
      autoLabel: true,
      hideIfNoTarget: true
    };

  return (
    <div className={scopedId ? 'page org-record-page' : 'page'}>
      <PageHeader
        eyebrow="RECORD MANAGEMENT"
        title={cfg.title}
        description="Manage records, keep key details current, and maintain a clear operational history."
        breadcrumbs={listBreadcrumbs(type, scopedId, orgName)}
        back={back}
        actions={(
          <button
            className="primary"
            onClick={() => {
              const path = currentListPath(window.location.pathname, window.location.search);
              if (type === 'practices') nav('/practices/new/profile', { state: { returnTo: path, listKey: 'practices' } });
              else if (type === 'facilities') nav('/facilities/new/profile', { state: { returnTo: path, listKey: 'facilities' } });
              else if (type === 'providers') nav('/providers/new/profile', { state: { returnTo: path, listKey: 'providers' } });
              else start();
            }}
          >
            <Plus size={17} /> Add {cfg.singular}
          </button>
        )}
      />
      {error && <div className="error banner">{error}</div>}
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input placeholder={cfg.search} value={q} onChange={e => setQ(e.target.value)} aria-label={cfg.search} />
          </div>
          {q ? (
            <button type="button" className="small-action" onClick={() => setQ('')}>
              Clear search
            </button>
          ) : null}
          <span className="record-count">{loading ? 'Loading…' : `${rows.length} records`}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {cfg.columns.map(c => <th key={c[0]}>{c[1]}</th>)}
                <th className="action-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cfg.columns.length + 1} className="table-empty">Loading records…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={cfg.columns.length + 1} className="table-empty">
                    <div className="empty-inline">
                      <FileText size={25} />
                      <b>No records found</b>
                      <span>Create a record or change your search.</span>
                    </div>
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.id}>
                  {cfg.columns.map(c => (
                    <td key={c[0]}>
                      {c[0] === 'status'
                        ? <StatusBadge value={nested(row, c[0])} />
                        : <span className={c[0] === 'title' || c[0] === 'legalName' || c[0] === 'name' ? 'cell-strong' : ''}>{fmt(nested(row, c[0]))}</span>}
                    </td>
                  ))}
                  <td>
                    <div className="row-actions">
                      {(WORKSPACE_TYPES.has(type) || PROFILE_TYPES.has(type)) && (
                        <button className="small-action" onClick={() => openRecord(row)}>
                          {WORKSPACE_TYPES.has(type) ? 'Open Workspace' : 'Open Profile'}
                        </button>
                      )}
                      {type === 'organizations' && (row.status === 'ACTIVE' || row.status === 'INACTIVE') && (
                        <button className="small-action" onClick={() => toggleStatus(row)}>
                          {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      {type === 'documents' && (
                        <>
                          {row.storageKey ? <button className="small-action" onClick={() => downloadFile(row)}>Download</button> : null}
                          <label className="small-action upload-action">
                            Upload
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx" onChange={e => uploadFile(row, e.target.files?.[0])} hidden />
                          </label>
                        </>
                      )}
                      <button className="small-action" onClick={() => start(row)}>Edit</button>
                      <button className="small-action danger-text" onClick={() => remove(row)}>Delete</button>
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
          <form className="record-modal" onSubmit={save}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{editing ? 'UPDATE RECORD' : 'NEW RECORD'}</span>
                <h2>{editing ? `Edit ${cfg.singular}` : `Add ${cfg.singular}`}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setModal(false)}><X size={20} /></button>
            </div>
            <div className="form-grid">
              {cfg.fields.map(f => (
                <label className={f[2] === 'textarea' ? 'span-2' : ''} key={f[0]}>
                  {f[1]}
                  {f[2] === 'select' ? (
                    <select name={f[0]} defaultValue={editing?.[f[0]] || ''}>
                      <option value="">Select…</option>
                      {f[3].map(v => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}
                    </select>
                  ) : f[2] === 'relation' ? (
                    <select name={f[0]} defaultValue={editing?.[f[0]] || (scopedId && f[0] === 'organizationId' ? scopedId : '')} required={!!f[4]}>
                      <option value="">Select…</option>
                      {(refs[f[3]] || []).map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name || r.legalName || `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.applicationNo || r.id}
                        </option>
                      ))}
                    </select>
                  ) : f[2] === 'textarea' ? (
                    <textarea name={f[0]} defaultValue={editing?.[f[0]] || ''} rows="3" />
                  ) : (
                    <input
                      name={f[0]}
                      type={f[2]}
                      defaultValue={editing?.[f[0]] ? (f[2] === 'date' ? String(editing[f[0]]).slice(0, 10) : editing[f[0]]) : ''}
                      required={f[3] === true}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="modal-footer">
              <span className="muted">Required browser fields must be completed before saving.</span>
              <button type="button" className="secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create record'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
