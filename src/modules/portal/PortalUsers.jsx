import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const ROLES = [
  'TENANT_ADMIN', 'CREDENTIALING_MANAGER', 'CREDENTIALING_SPECIALIST',
  'ENROLLMENT_SPECIALIST', 'APPROVER', 'AUDITOR', 'READ_ONLY'
];

export default function PortalUsers() {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', role: 'CREDENTIALING_SPECIALIST', send: true });
  const [inviteResult, setInviteResult] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError('');
    try {
      const [m, i] = await Promise.all([
        api.get('/portal/members'),
        api.get('/portal/invitations')
      ]);
      setMembers(m.data || []);
      setInvites(i.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load users');
    }
  }

  useEffect(() => { load(); }, []);

  async function invite(e) {
    e.preventDefault();
    setSaving(true);
    setInviteResult(null);
    try {
      const r = await api.post('/portal/invitations', form);
      setInviteResult(r.data);
      setForm({ email: '', role: 'CREDENTIALING_SPECIALIST', send: true });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Invite failed');
    } finally {
      setSaving(false);
    }
  }

  async function setMemberStatus(id, status) {
    setSaving(true);
    try {
      await api.patch(`/portal/members/${id}`, { status });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Users & invitations"
        breadcrumbs={[{ label: 'Portal', to: '/portal' }, { label: 'Users' }]}
      />
      {error && <div className="error banner">{error}</div>}
      {inviteResult?.acceptanceUrl && (
        <div className="banner" style={{ background: '#f3f7fb', padding: 12, marginBottom: 12 }}>
          Share this one-time link if email delivery is unavailable:
          <div style={{ wordBreak: 'break-all' }}>{inviteResult.acceptanceUrl}</div>
        </div>
      )}

      <form className="panel form-grid" style={{ padding: 16, marginBottom: 16 }} onSubmit={invite}>
        <h3 className="span-2" style={{ margin: 0 }}>Invite user</h3>
        <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <div className="span-2">
          <button className="primary" disabled={saving}>{saving ? 'Sending…' : 'Send invitation'}</button>
        </div>
      </form>

      <section className="panel table-panel" style={{ marginBottom: 16 }}>
        <h3 style={{ padding: '12px 16px', margin: 0 }}>Members</h3>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user?.name}</td>
                  <td>{m.user?.email}</td>
                  <td>{m.role}</td>
                  <td><StatusBadge value={m.status} /></td>
                  <td>
                    {m.status === 'ACTIVE' ? (
                      <button type="button" className="small-action" disabled={saving} onClick={() => setMemberStatus(m.id, 'SUSPENDED')}>Suspend</button>
                    ) : (
                      <button type="button" className="small-action" disabled={saving} onClick={() => setMemberStatus(m.id, 'ACTIVE')}>Reactivate</button>
                    )}
                  </td>
                </tr>
              ))}
              {!members.length && <tr><td colSpan="5" className="table-empty">No members</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <h3 style={{ padding: '12px 16px', margin: 0 }}>Invitations</h3>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Delivery</th><th>Expires</th></tr></thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td>{i.role}</td>
                  <td><StatusBadge value={i.status} /></td>
                  <td>{i.deliveryStatus}</td>
                  <td>{i.expiresAt ? new Date(i.expiresAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {!invites.length && <tr><td colSpan="5" className="table-empty">No invitations</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
