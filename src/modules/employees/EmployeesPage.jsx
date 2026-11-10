import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Plus, ShieldCheck, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { fmt } from '../../utils/format';

const MANAGER_ROLES = ['ADMIN', 'CREDENTIALING_MANAGER'];

function LeaveAttendancePanel({ user, isManager, activeTab }) {
  const [leaveRows, setLeaveRows] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tabError, setTabError] = useState('');
  const [leaveBusy, setLeaveBusy] = useState('');
  const [attBusy, setAttBusy] = useState('');
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });

  async function loadLeave() {
    try {
      const params = isManager ? {} : { mine: 1 };
      const [list, types, bal] = await Promise.all([
        api.get('/leave', { params }),
        api.get('/leave/types'),
        api.get('/leave/balances')
      ]);
      setLeaveRows(list.data);
      setLeaveTypes(types.data);
      setBalances(bal.data);
    } catch (e) {
      setTabError(e.response?.data?.error || 'Could not load leave data.');
    }
  }

  async function loadAttendance() {
    try {
      const params = isManager ? { limit: 100 } : { mine: 1, limit: 100 };
      const r = await api.get('/attendance', { params });
      setAttendance(r.data);
    } catch (e) {
      setTabError(e.response?.data?.error || 'Could not load attendance.');
    }
  }

  useEffect(() => {
    setTabError('');
    if (activeTab === 'leave') loadLeave();
    if (activeTab === 'attendance') loadAttendance();
  }, [isManager, activeTab]);

  async function submitLeave(e) {
    e.preventDefault();
    setLeaveBusy('apply');
    setTabError('');
    try {
      await api.post('/leave', leaveForm);
      setLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      await loadLeave();
    } catch (err) {
      setTabError(err.response?.data?.error || 'Could not submit leave request.');
    } finally {
      setLeaveBusy('');
    }
  }

  async function decideLeave(id, status) {
    setLeaveBusy(id);
    setTabError('');
    try {
      const reviewNote = status === 'REJECTED' ? 'Declined by manager' : undefined;
      await api.post(`/leave/${id}/decide`, { status, reviewNote });
      await loadLeave();
    } catch (err) {
      setTabError(err.response?.data?.error || 'Could not update leave request.');
    } finally {
      setLeaveBusy('');
    }
  }

  async function checkIn() {
    setAttBusy('in');
    setTabError('');
    try {
      await api.post('/attendance/check-in');
      await loadAttendance();
    } catch (err) {
      setTabError(err.response?.data?.error || 'Check-in failed.');
    } finally {
      setAttBusy('');
    }
  }

  async function checkOut() {
    setAttBusy('out');
    setTabError('');
    try {
      await api.post('/attendance/check-out');
      await loadAttendance();
    } catch (err) {
      setTabError(err.response?.data?.error || 'Check-out failed.');
    } finally {
      setAttBusy('');
    }
  }

  return (
    <>
      {tabError && <div className="error banner">{tabError}</div>}

      {activeTab === 'leave' && (
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-heading">
          <div>
            <h2>Leave</h2>
            <p>Submit requests and track balances.</p>
          </div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          {balances.length > 0 && (
            <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: 14 }}>
              {balances.map((b) => (
                <div key={b.id} className="metric-card">
                  <span>{b.leaveType?.name || 'Leave'}</span>
                  <strong>{Math.max(0, Number(b.entitled || 0) - Number(b.used || 0))}</strong>
                  <small>{Number(b.used || 0)} used of {Number(b.entitled || 0)}</small>
                </div>
              ))}
            </div>
          )}
          <form className="form-grid" onSubmit={submitLeave}>
            <label>Leave type
              <select
                required
                value={leaveForm.leaveTypeId}
                onChange={(e) => setLeaveForm(f => ({ ...f, leaveTypeId: e.target.value }))}
              >
                <option value="">Select type</option>
                {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label>Start date
              <input type="date" required value={leaveForm.startDate} onChange={(e) => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} />
            </label>
            <label>End date
              <input type="date" required value={leaveForm.endDate} onChange={(e) => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} />
            </label>
            <label className="span-2">Reason
              <textarea rows={2} value={leaveForm.reason} onChange={(e) => setLeaveForm(f => ({ ...f, reason: e.target.value }))} />
            </label>
            <p className="span-2">
              <button type="submit" className="primary" disabled={leaveBusy === 'apply'}>
                {leaveBusy === 'apply' ? 'Submitting…' : 'Apply for leave'}
              </button>
            </p>
          </form>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th><th>Type</th><th>Dates</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaveRows.map(r => (
                <tr key={r.id}>
                  <td><b>{r.user?.name}</b><br /><small>{r.user?.department}</small></td>
                  <td>{r.leaveType?.name}</td>
                  <td>{fmt(r.startDate)} → {fmt(r.endDate)}</td>
                  <td><StatusBadge value={r.status} /></td>
                  <td>
                    {isManager && r.status === 'PENDING' ? (
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <button type="button" className="small-action" disabled={!!leaveBusy} onClick={() => decideLeave(r.id, 'APPROVED')}>Approve</button>
                        <button type="button" className="small-action" disabled={!!leaveBusy} onClick={() => decideLeave(r.id, 'REJECTED')}>Reject</button>
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {!leaveRows.length && <tr><td colSpan="5" className="table-empty">No leave requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'attendance' && (
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>Attendance</h2>
            <p>Check in for today and review recent history{isManager ? ' (all employees).' : '.'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="secondary" disabled={!!attBusy} onClick={checkIn}>
              <Clock size={14} /> {attBusy === 'in' ? 'Checking in…' : 'Check in'}
            </button>
            <button type="button" className="primary" disabled={!!attBusy} onClick={checkOut}>
              {attBusy === 'out' ? 'Checking out…' : 'Check out'}
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Employee</th><th>Check in</th><th>Check out</th><th>Worked (min)</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map(r => (
                <tr key={r.id}>
                  <td>{fmt(r.workDate)}</td>
                  <td><b>{r.user?.name || user.name}</b></td>
                  <td>{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—'}</td>
                  <td>{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : '—'}</td>
                  <td>{r.workedMinutes ?? '—'}</td>
                </tr>
              ))}
              {!attendance.length && <tr><td colSpan="5" className="table-empty">No attendance records yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </>
  );
}

export default function EmployeesPage({ organizationId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'directory';
  const user = useMemo(() => JSON.parse(localStorage.getItem('credentialing_user') || '{}'), []);
  const isManager = MANAGER_ROLES.includes(user.role);

  const [rows, setRows] = useState([]);
  const [managers, setManagers] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [saving, setSaving] = useState(false);

  function setTab(next) {
    const p = new URLSearchParams(searchParams);
    if (next === 'directory') p.delete('tab');
    else p.set('tab', next);
    setSearchParams(p, { replace: true });
  }

  async function load() {
    try {
      const r = await api.get('/employees');
      setRows(r.data);
      setManagers(r.data.filter(x => MANAGER_ROLES.includes(x.role)));
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
        actions={tab === 'directory' ? (
          <button type="button" className="primary" onClick={() => { setEditing(null); setModal(true); }}><Plus size={17} /> Add Employee</button>
        ) : null}
      />

      {!organizationId && (
        <div className="tab-row" role="tablist" aria-label="Employee sections">
          <button type="button" className={`tab-btn ${tab === 'directory' ? 'active' : ''}`} onClick={() => setTab('directory')}>Directory</button>
          <button type="button" className={`tab-btn ${tab === 'leave' ? 'active' : ''}`} onClick={() => setTab('leave')}>Leave</button>
          <button type="button" className={`tab-btn ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>Attendance</button>
        </div>
      )}

      {error && <div className="error banner">{error}</div>}
      {created && tab === 'directory' && (
        <div className="note-strip">
          <ShieldCheck size={18} />
          <div>
            <b>Employee account created</b>
            <span>
              {created.email} · Employee ID: <strong>{created.employeeCode}</strong> · Welcome email with a system-generated temporary password was sent successfully.
            </span>
          </div>
          <button type="button" className="small-action" onClick={() => setCreated(null)}>Dismiss</button>
        </div>
      )}

      {(tab === 'leave' || tab === 'attendance') && !organizationId && (
        <LeaveAttendancePanel user={user} isManager={isManager} activeTab={tab} />
      )}

      {tab === 'directory' && (
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
                    <td><button type="button" className="small-action" onClick={() => { setEditing(r); setModal(true); }}>Edit</button></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan="8" className="table-empty">No employees yet. Add your first employee.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
