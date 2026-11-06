import React, { useEffect, useState } from 'react';
import { Plus, ShieldCheck, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

export default function EmployeesPage({ organizationId }) {
  const [rows, setRows] = useState([]);
  const [managers, setManagers] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get('/employees');
      setRows(r.data);
      setManagers(r.data.filter(x => ['ADMIN', 'CREDENTIALING_MANAGER'].includes(x.role)));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load employees.');
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const f = new FormData(e.currentTarget);
    const d = Object.fromEntries(f.entries());
    d.active = d.active === 'on';
    if (!d.managerId) delete d.managerId;
    try {
      if (editing) {
        await api.patch(`/employees/${editing.id}`, d);
      } else {
        const r = await api.post('/employees', d);
        setCreated({
          name: r.data.name,
          email: r.data.email,
          employeeCode: r.data.employeeCode,
          emailSent: r.data.emailSent
        });
      }
      setModal(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details?.map(x => x.message).join(', ') || 'Could not save employee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={organizationId ? 'page org-record-page' : 'page'}>
      <PageHeader
        eyebrow="TEAM ADMINISTRATION"
        title="Employees"
        description={organizationId
          ? 'Employee accounts are managed globally. Organization-specific membership will be added in a later phase without breaking existing authentication.'
          : 'Create team accounts, assign departments and roles, and manage reporting lines.'}
        breadcrumbs={organizationId
          ? [
            { label: 'Directory', to: '/organizations' },
            { label: 'Organization', to: `/organizations/${organizationId}/overview` },
            { label: 'Employees' }
          ]
          : [
            { label: 'Workspace', to: '/' },
            { label: 'Employees' }
          ]}
        back={organizationId
          ? { label: 'Back to Organization', fallbackHref: `/organizations/${organizationId}/overview`, autoLabel: true }
          : { label: 'Back', fallbackHref: null, autoLabel: true, hideIfNoTarget: true, listKey: 'employees' }}
        actions={<button className="primary" onClick={() => { setEditing(null); setModal(true); }}><Plus size={17} /> Add Employee</button>}
      />
      {error && <div className="error banner">{error}</div>}
      {created && (
        <div className="note-strip">
          <ShieldCheck size={18} />
          <div>
            <b>Employee account created</b>
            <span>
              {created.email} · Employee ID: <strong>{created.employeeCode}</strong> · Welcome email with a system-generated temporary password was sent successfully.
            </span>
          </div>
          <button className="small-action" onClick={() => setCreated(null)}>Dismiss</button>
        </div>
      )}
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th><th>Employee ID</th><th>Department</th><th>Job Title</th>
                <th>Role</th><th>Manager</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td><b>{r.name}</b><br /><small>{r.email}</small></td>
                  <td>{r.employeeCode || '—'}</td>
                  <td>{r.department || '—'}</td>
                  <td>{r.jobTitle || '—'}</td>
                  <td>{r.role?.replaceAll('_', ' ')}</td>
                  <td>{r.managerId ? (rows.find(x => x.id === r.managerId)?.name || '—') : '—'}</td>
                  <td><StatusBadge value={r.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td><button className="small-action" onClick={() => { setEditing(r); setModal(true); }}>Edit</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="8" className="table-empty">No employees yet. Add your first employee.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {modal && (
        <div className="modal-backdrop">
          <form className="record-modal" onSubmit={save}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">TEAM ACCOUNT</span>
                <h2>{editing ? 'Edit Employee' : 'Add Employee'}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setModal(false)}><X /></button>
            </div>
            <div className="form-grid">
              <label>Full Name<input name="name" required defaultValue={editing?.name || ''} /></label>
              <label>Email<input type="email" name="email" required defaultValue={editing?.email || ''} /></label>
              {!editing && (
                <div className="field-help span-2">
                  A secure temporary password and unique Employee ID will be generated automatically. Login details will be emailed to the employee.
                </div>
              )}
              {editing && <label>Employee ID<input value={editing?.employeeCode || '—'} readOnly /></label>}
              <label>Phone<input name="phone" defaultValue={editing?.phone || ''} /></label>
              <label>Department<input name="department" required defaultValue={editing?.department || 'Credentialing'} /></label>
              <label>Job Title<input name="jobTitle" required defaultValue={editing?.jobTitle || 'Specialist'} /></label>
              <label>Role
                <select name="role" defaultValue={editing?.role || 'CREDENTIALING_SPECIALIST'}>
                  {['ADMIN', 'CREDENTIALING_MANAGER', 'CREDENTIALING_SPECIALIST', 'ENROLLMENT_SPECIALIST', 'APPROVER', 'AUDITOR', 'READ_ONLY'].map(v => (
                    <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </label>
              <label>Reporting Manager
                <select name="managerId" defaultValue={editing?.managerId || ''}>
                  <option value="">No manager</option>
                  {managers.filter(x => x.id !== editing?.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
              <label className="span-2">
                <span><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Active employee (can sign in)</span>
              </label>
            </div>
            <div className="modal-footer">
              <span className="muted">{editing ? 'Employee ID is system-generated and cannot be edited.' : 'Credentials are generated securely and delivered by email.'}</span>
              <button type="button" className="secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save Employee'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
