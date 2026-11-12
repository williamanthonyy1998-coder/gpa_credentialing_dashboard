import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, Send, Ban } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import InfoField from '../../components/common/InfoField';

const TENANT_ROLES = [
  'TENANT_ADMIN', 'CREDENTIALING_MANAGER', 'CREDENTIALING_SPECIALIST',
  'ENROLLMENT_SPECIALIST', 'APPROVER', 'AUDITOR', 'READ_ONLY'
];

export default function ClientDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', role: 'TENANT_ADMIN', send: true });
  const [inviteResult, setInviteResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  async function load() {
    setError('');
    try {
      const r = await api.get(`/clients/${id}`);
      setDetail(r.data);
      setNotes(r.data.internalNotes || '');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load client');
    }
  }

  useEffect(() => { load(); }, [id]);

  async function saveNotes() {
    setSaving(true);
    try {
      await api.patch(`/clients/${id}`, { internalNotes: notes });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not save notes');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status) {
    setSaving(true);
    try {
      await api.patch(`/clients/${id}`, { status });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not update status');
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(e) {
    e.preventDefault();
    setSaving(true);
    setInviteResult(null);
    setError('');
    try {
      const r = await api.post(`/clients/${id}/invitations`, invite);
      setInviteResult(r.data);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create invitation');
    } finally {
      setSaving(false);
    }
  }

  async function resend(invitationId) {
    setSaving(true);
    try {
      const r = await api.post(`/clients/invitations/${invitationId}/resend`);
      setInviteResult(r.data);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Resend failed');
    } finally {
      setSaving(false);
    }
  }

  async function revoke(invitationId) {
    setSaving(true);
    try {
      await api.post(`/clients/invitations/${invitationId}/revoke`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Revoke failed');
    } finally {
      setSaving(false);
    }
  }

  if (!detail && !error) return <div className="page"><p className="muted">Loading client…</p></div>;

  return (
    <div className="page">
      <PageHeader
        title={detail?.name || 'Client'}
        description={`Slug ${detail?.slug || '—'}`}
        breadcrumbs={[{ label: 'Clients', to: '/clients' }, { label: detail?.name || 'Detail' }]}
        back={{ label: 'Back to Clients', fallbackHref: '/clients' }}
        actions={(
          <>
            <button type="button" className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
            <button type="button" className="primary" onClick={() => setInviteOpen(true)}><Send size={15} /> Invite user</button>
          </>
        )}
      />
      {error && <div className="error banner">{error}</div>}
      {inviteResult?.acceptanceUrl && (
        <div className="banner" style={{ background: '#f3f7fb', padding: 12, marginBottom: 12 }}>
          Email was not delivered (check RESEND configuration). Share this one-time acceptance link securely:
          <div style={{ wordBreak: 'break-all', marginTop: 6 }}>{inviteResult.acceptanceUrl}</div>
        </div>
      )}

      {detail && (
        <>
          <section className="panel" style={{ padding: 16, marginBottom: 16 }}>
            <div className="info-grid">
              <InfoField label="STATUS" value={<StatusBadge value={detail.status} />} />
              <InfoField label="ONBOARDING" value={<StatusBadge value={detail.onboardingStatus} />} />
              <InfoField label="PRIMARY CONTACT" value={detail.primaryContactName} />
              <InfoField label="CONTACT EMAIL" value={detail.primaryContactEmail} />
              <InfoField label="CONTACT PHONE" value={detail.primaryContactPhone} />
              <InfoField label="CREATED" value={detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {detail.status !== 'ACTIVE' && (
                <button type="button" className="secondary" disabled={saving} onClick={() => setStatus('ACTIVE')}>Activate</button>
              )}
              {detail.status !== 'SUSPENDED' && (
                <button type="button" className="secondary" disabled={saving} onClick={() => setStatus('SUSPENDED')}><Ban size={14} /> Suspend</button>
              )}
              {detail.status !== 'INACTIVE' && (
                <button type="button" className="secondary" disabled={saving} onClick={() => setStatus('INACTIVE')}>Deactivate</button>
              )}
            </div>
            <label style={{ display: 'block', marginTop: 16 }}>
              Internal GPA notes
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%' }} />
            </label>
            <button type="button" className="secondary" style={{ marginTop: 8 }} disabled={saving} onClick={saveNotes}>Save notes</button>
          </section>

          <section className="panel table-panel" style={{ marginBottom: 16 }}>
            <h3 style={{ padding: '12px 16px', margin: 0 }}>Members ({detail.memberships?.length || 0})</h3>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Tenant role</th><th>Status</th></tr></thead>
                <tbody>
                  {(detail.memberships || []).map((m) => (
                    <tr key={m.id}>
                      <td>{m.user?.name}</td>
                      <td>{m.user?.email}</td>
                      <td>{m.role}</td>
                      <td><StatusBadge value={m.status} /></td>
                    </tr>
                  ))}
                  {!detail.memberships?.length && <tr><td colSpan="4" className="table-empty">No members yet</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel" style={{ marginBottom: 16 }}>
            <h3 style={{ padding: '12px 16px', margin: 0 }}>Invitations</h3>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Delivery</th><th>Expires</th><th>Actions</th></tr></thead>
                <tbody>
                  {(detail.invitations || []).map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.email}</td>
                      <td>{inv.role}</td>
                      <td><StatusBadge value={inv.status} /></td>
                      <td>{inv.deliveryStatus}</td>
                      <td>{inv.expiresAt ? new Date(inv.expiresAt).toLocaleString() : '—'}</td>
                      <td>
                        {inv.status === 'PENDING' && (
                          <>
                            <button type="button" className="small-action" disabled={saving} onClick={() => resend(inv.id)}>Resend</button>
                            {' '}
                            <button type="button" className="small-action" disabled={saving} onClick={() => revoke(inv.id)}>Revoke</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!detail.invitations?.length && <tr><td colSpan="6" className="table-empty">No invitations</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel">
            <h3 style={{ padding: '12px 16px', margin: 0 }}>Organizations</h3>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Legal name</th><th>DBA</th><th>Status</th></tr></thead>
                <tbody>
                  {(detail.organizations || []).map((o) => (
                    <tr key={o.id}>
                      <td>{o.legalName}</td>
                      <td>{o.dba || '—'}</td>
                      <td><StatusBadge value={o.status} /></td>
                    </tr>
                  ))}
                  {!detail.organizations?.length && <tr><td colSpan="3" className="table-empty">No organizations</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {inviteOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setInviteOpen(false)}>
          <form className="record-modal" onSubmit={sendInvite}>
            <div className="modal-heading">
              <div><span className="eyebrow">INVITE</span><h2>Invite client user</h2></div>
              <button type="button" className="icon-button" onClick={() => setInviteOpen(false)}>×</button>
            </div>
            <div className="form-grid" style={{ padding: '0 24px' }}>
              <label>Email<input required type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
              <label>Tenant role
                <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                  {TENANT_ROLES.map((r) => <option key={r} value={r}>{r.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label className="span-2">
                <input type="checkbox" checked={invite.send} onChange={(e) => setInvite({ ...invite, send: e.target.checked })} />
                {' '}Attempt email delivery via Resend
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => setInviteOpen(false)}>Cancel</button>
              <button className="primary" disabled={saving}>{saving ? 'Sending…' : 'Create invitation'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
