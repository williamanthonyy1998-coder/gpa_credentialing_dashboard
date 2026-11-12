import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

export default function PortalProviderIntakes() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ contactName: '', contactEmail: '', contactPhone: '', invite: true });
  const [saving, setSaving] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  async function load() {
    try {
      setRows((await api.get('/portal/provider-intakes')).data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load provider intakes');
    }
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setInviteResult(null);
    try {
      const r = await api.post('/portal/provider-intakes', form);
      setInviteResult(r.data.invitation);
      setForm({ contactName: '', contactEmail: '', contactPhone: '', invite: true });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create provider intake');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Provider intakes"
        description="Invite external providers to submit credentialing information for your client account."
        breadcrumbs={[{ label: 'Portal', to: '/portal' }, { label: 'Provider intakes' }]}
      />
      {error && <div className="error banner">{error}</div>}
      {inviteResult?.acceptanceUrl && (
        <div className="banner" style={{ background: '#f3f7fb', padding: 12, marginBottom: 12 }}>
          Share this one-time provider invitation link if email delivery is unavailable:
          <div style={{ wordBreak: 'break-all' }}>{inviteResult.acceptanceUrl}</div>
        </div>
      )}

      <form className="panel form-grid" style={{ padding: 16, marginBottom: 16 }} onSubmit={create}>
        <h3 className="span-2" style={{ margin: 0 }}>Invite provider</h3>
        <label>Provider name<input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
        <label>Provider email<input required type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
        <label>Phone<input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
        <div className="span-2">
          <button className="primary" disabled={saving}>{saving ? 'Creating…' : 'Create & invite'}</button>
        </div>
      </form>

      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Email</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.referenceNo}</td>
                  <td>{row.invitedEmail || row.contactEmail}</td>
                  <td><StatusBadge value={row.status} /></td>
                  <td>{new Date(row.updatedAt).toLocaleString()}</td>
                  <td><Link to={`/portal/provider-intakes/${row.id}`}>View</Link></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="5" className="table-empty">No provider intakes yet</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
