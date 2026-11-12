import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { directoryConfig } from '../../config/directories';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import IconButton, { RowActions } from '../../components/common/IconButton';
import CellText from '../../components/common/CellText';
import { fmt, nested } from '../../utils/format';

function parseFieldValue(field, raw) {
  if (raw === null || raw === '') return undefined;
  if (field[2] === 'date') return new Date(`${raw}T12:00:00`).toISOString();
  if (field[0] === 'requiredDefault' || field[0] === 'tracksExpiration' || field[0] === 'appliesToFacility' || field[0] === 'appliesToGroup') {
    return raw === 'true' || raw === true;
  }
  if (field[0] === 'defaultWarningDays' || field[0] === 'sortOrder') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return raw;
}

export default function DirectoryRecordPage() {
  const { resource } = useParams();
  const cfg = directoryConfig[resource];
  const [rows, setRows] = useState([]);
  const [refs, setRefs] = useState({});
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  async function load() {
    if (!cfg) return;
    setLoading(true);
    setError('');
    try {
      const relationFields = cfg.fields.filter(f => f[2] === 'relation');
      const [r, ...related] = await Promise.all([
        api.get(`/directories/${cfg.resource}`, {
          params: { q, status: status || undefined, page, pageSize }
        }),
        ...relationFields.map(f => api.get(`/${f[3]}`, { params: { limit: 200 } }))
      ]);
      const payload = r.data;
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      setRows(list);
      setTotal(payload?.total ?? list.length);
      setRefs(Object.fromEntries(relationFields.map((f, i) => {
        const data = related[i]?.data;
        return [f[3], Array.isArray(data) ? data : (data?.data || [])];
      })));
    } catch (e) {
      setError(e.response?.data?.error || `Could not load ${cfg.title.toLowerCase()}.`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q, status, resource, page]);

  if (!cfg) {
    return (
      <div className="page">
        <PageHeader title="Unknown directory" breadcrumbs={[{ label: 'Reference Data', to: '/directories' }, { label: resource }]} />
        <div className="error">This directory resource is not configured.</div>
      </div>
    );
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const body = {};
    cfg.fields.forEach(f => {
      const v = parseFieldValue(f, fd.get(f[0]));
      if (v !== undefined) body[f[0]] = v;
    });
    try {
      if (editing) await api.patch(`/directories/${cfg.resource}/${editing.id}`, body);
      else await api.post(`/directories/${cfg.resource}`, body);
      setModal(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details?.map(x => x.message).join(', ') || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!confirm(`Remove or deactivate this ${cfg.singular.toLowerCase()}? Referenced records are deactivated instead of deleted.`)) return;
    try {
      await api.delete(`/directories/${cfg.resource}/${row.id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  }

  function fieldOptions(f) {
    if (f[2] === 'select' && Array.isArray(f[3])) return f[3];
    return null;
  }

  function relationOptions(f) {
    const list = refs[f[3]] || [];
    return list.map(r => ({
      id: r.id,
      label: r.name || r.legalName || `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.code || r.id
    }));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page">
      <PageHeader
        title={cfg.title}
        breadcrumbs={[
          { label: 'Reference Data', to: '/directories' },
          { label: cfg.title }
        ]}
        actions={(
          <button type="button" className="primary" onClick={() => { setEditing(null); setModal(true); }}>
            <Plus size={16} /> New {cfg.singular}
          </button>
        )}
      />

      <div className="table-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input value={q} onChange={e => { setPage(1); setQ(e.target.value); }} placeholder={cfg.search} />
        </label>
        <select value={status} onChange={e => { setPage(1); setStatus(e.target.value); }} aria-label="Status filter">
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="PENDING">PENDING</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {loading ? <div className="muted">Loading…</div> : null}

      {!loading && !rows.length ? (
        <div className="muted" style={{ padding: '24px 0' }}>No {cfg.title.toLowerCase()} found.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {cfg.columns.map(([key, label]) => <th key={key}>{label}</th>)}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  {cfg.columns.map(([key]) => (
                    <td key={key}>
                      {key === 'status' || key.endsWith('.status')
                        ? <StatusBadge value={nested(row, key)} />
                        : <CellText>{fmt(nested(row, key))}</CellText>}
                    </td>
                  ))}
                  <td>
                    <RowActions>
                      <IconButton title="Edit" onClick={() => { setEditing(row); setModal(true); }}><Pencil size={15} /></IconButton>
                      <IconButton title="Delete / deactivate" onClick={() => remove(row)}><Trash2 size={15} /></IconButton>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="enr-pager">
          <button type="button" className="ghost-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span className="muted">Page {page} of {totalPages}</span>
          <button type="button" className="ghost-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && !saving && setModal(false)}>
          <form className="record-modal" onSubmit={save}>
            <h3>{editing ? `Edit ${cfg.singular}` : `New ${cfg.singular}`}</h3>
            <div className="form-grid">
              {cfg.fields.map(f => {
                const opts = fieldOptions(f);
                const rel = f[2] === 'relation' ? relationOptions(f) : null;
                const current = editing ? nested(editing, f[0]) : '';
                return (
                  <label key={f[0]}>
                    {f[1]}{f[4] ? ' *' : ''}
                    {opts ? (
                      <select name={f[0]} defaultValue={current === true ? 'true' : current === false ? 'false' : (current || '')} required={!!f[4]}>
                        <option value="">Select…</option>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : rel ? (
                      <select name={f[0]} defaultValue={current || ''} required={!!f[4]}>
                        <option value="">Select…</option>
                        {rel.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    ) : f[2] === 'textarea' ? (
                      <textarea name={f[0]} defaultValue={current || ''} rows={3} required={!!f[4]} />
                    ) : (
                      <input
                        name={f[0]}
                        type={f[2] === 'email' ? 'email' : f[2] === 'date' ? 'date' : 'text'}
                        defaultValue={f[2] === 'date' && current ? String(current).slice(0, 10) : (current ?? '')}
                        required={!!f[4]}
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setModal(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
