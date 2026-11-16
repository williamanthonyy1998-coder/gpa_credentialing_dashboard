import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Search, UserMinus } from 'lucide-react';
import api from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'PENDING', 'TERMINATED'];

export default function OrganizationEmployeesPanel({ organizationId, orgName }) {
  const user = useMemo(() => JSON.parse(localStorage.getItem('credentialing_user') || '{}'), []);
  const [items, setItems] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [assignable, setAssignable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/organizations/${organizationId}/employees`, {
        params: {
          q: q || undefined,
          employmentStatus: status || undefined,
          department: department || undefined
        }
      });
      setItems(r.data.items || []);
      setCanManage(Boolean(r.data.canManage));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load organization employees.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [organizationId]);

  async function openAssign() {
    setEditing(null);
    setError('');
    setModal(true);
    try {
      const r = await api.get(`/organizations/${organizationId}/employees/assignable`);
      setAssignable(r.data.items || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load assignable employees.');
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null; });
    try {
      if (editing) {
        await api.patch(`/organizations/${organizationId}/employees/${editing.id}`, body);
      } else {
        await api.post(`/organizations/${organizationId}/employees`, body);
      }
      setModal(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save assignment.');
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(row) {
    if (!window.confirm(`Remove ${row.user?.name || 'employee'} from this organization HR roster? This does not change login access.`)) return;
    try {
      await api.delete(`/organizations/${organizationId}/employees/${row.id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not remove assignment.');
    }
  }

  async function openDetail(row) {
    try {
      const r = await api.get(`/organizations/${organizationId}/employees/${row.id}`);
      setDetail(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load assignment detail.');
    }
  }

  const assignedIds = new Set(items.map((x) => x.userId));
  const available = assignable.filter((u) => !assignedIds.has(u.id));

  return (
    <div className="page org-record-page">
      <div className="panel-heading">
        <div>
          <h2>Employees &amp; HR</h2>
          <p>
            Organization HR assignments for {orgName || 'this organization'}. Assignments do not grant
            portal access — authorization remains on UserOrganization membership.
          </p>
        </div>
        <div className="row gap">
          <button type="button" className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {canManage && (
            <button type="button" className="primary" onClick={openAssign}><Plus size={16} /> Assign employee</button>
          )}
        </div>
      </div>

      <div className="toolbar row gap wrap" style={{ marginBottom: '1rem' }}>
        <label className="grow">
          <span className="sr-only">Search</span>
          <div className="row gap" style={{ alignItems: 'center' }}>
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, title…" />
          </div>
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Employment status">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" />
        <button type="button" className="secondary" onClick={load}>Apply</button>
      </div>

      {error && <div className="error banner">{error}</div>}

      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Job title</th>
              <th>Platform role</th>
              <th>Status</th>
              <th>Effective</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" className="table-empty">Loading…</td></tr>}
            {!loading && !items.length && (
              <tr><td colSpan="7" className="table-empty">No employees assigned to this organization yet.</td></tr>
            )}
            {!loading && items.map((row) => (
              <tr key={row.id}>
                <td>
                  <button type="button" className="linkish" onClick={() => openDetail(row)}>
                    <b>{row.user?.name || '—'}</b>
                  </button>
                  <div className="muted small">{row.user?.email}</div>
                  {row.user?.employeeCode && <div className="muted small">{row.user.employeeCode}</div>}
                </td>
                <td>{row.department || row.user?.department || '—'}</td>
                <td>{row.jobTitle || row.user?.jobTitle || '—'}</td>
                <td>{row.user?.role || '—'}</td>
                <td><StatusBadge value={row.employmentStatus} /></td>
                <td>
                  {row.effectiveFrom ? new Date(row.effectiveFrom).toLocaleDateString() : '—'}
                  {row.effectiveTo ? ` → ${new Date(row.effectiveTo).toLocaleDateString()}` : ''}
                </td>
                <td className="row gap">
                  {canManage && (
                    <>
                      <button type="button" className="ghost-btn" onClick={() => { setEditing(row); setModal(true); }}>Edit</button>
                      <button type="button" className="ghost-btn" onClick={() => removeAssignment(row)} title="Remove assignment">
                        <UserMinus size={15} />
                      </button>
                    </>
                  )}
                  {['ADMIN', 'CREDENTIALING_MANAGER'].includes(user.role) && (
                    <Link className="ghost-btn" to="/employees">Open directory</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <div className="panel-heading">
            <div>
              <h3>{detail.user?.name}</h3>
              <p className="muted">Assignment detail · grantsOrganizationAccess: {String(detail.grantsOrganizationAccess)}</p>
            </div>
            <button type="button" className="ghost-btn" onClick={() => setDetail(null)}>Close</button>
          </div>
          <p>{detail.responsibilities || 'No organization-specific responsibilities recorded.'}</p>
          <h4>Open tasks in this organization</h4>
          <ul>
            {(detail.organizationTasks || []).map((t) => (
              <li key={t.id}>{t.title} · {t.status}{t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ''}</li>
            ))}
            {!detail.organizationTasks?.length && <li className="muted">No open tasks assigned.</li>}
          </ul>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal panel" onSubmit={save}>
            <h3>{editing ? 'Update assignment' : 'Assign existing employee'}</h3>
            {!editing && (
              <label>Employee
                <select name="userId" required defaultValue="">
                  <option value="" disabled>Select employee…</option>
                  {available.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.email} · {u.role}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>Department
              <input name="department" defaultValue={editing?.department || ''} />
            </label>
            <label>Job title
              <input name="jobTitle" defaultValue={editing?.jobTitle || ''} />
            </label>
            <label>Status
              <select name="employmentStatus" defaultValue={editing?.employmentStatus || 'ACTIVE'}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Responsibilities
              <textarea name="responsibilities" rows={3} defaultValue={editing?.responsibilities || ''} />
            </label>
            <div className="row gap">
              <label className="grow">Effective from
                <input type="date" name="effectiveFrom" defaultValue={editing?.effectiveFrom ? String(editing.effectiveFrom).slice(0, 10) : ''} />
              </label>
              <label className="grow">Effective to
                <input type="date" name="effectiveTo" defaultValue={editing?.effectiveTo ? String(editing.effectiveTo).slice(0, 10) : ''} />
              </label>
            </div>
            <div className="row gap end">
              <button type="button" className="ghost-btn" onClick={() => { setModal(false); setEditing(null); }}>Cancel</button>
              <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
