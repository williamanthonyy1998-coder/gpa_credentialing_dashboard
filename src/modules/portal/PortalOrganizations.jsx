import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

export default function PortalOrganizations() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    legalName: '', dba: '', taxId: '', contactName: '', phone: '', email: ''
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get('/portal/organizations');
      setRows(r.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load organizations');
    }
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/portal/organizations', {
        ...form,
        taxId: form.taxId || null,
        email: form.email || null
      });
      setForm({ legalName: '', dba: '', taxId: '', contactName: '', phone: '', email: '' });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create organization');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Organizations"
        description="Legal entities belonging to your client account. Practices and facilities are created separately."
        breadcrumbs={[{ label: 'Portal', to: '/portal' }, { label: 'Organizations' }]}
      />
      {error && <div className="error banner">{error}</div>}

      <form className="panel form-grid" style={{ padding: 16, marginBottom: 16 }} onSubmit={create}>
        <h3 className="span-2" style={{ margin: 0 }}>Add organization</h3>
        <label>Legal name<input required value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></label>
        <label>DBA<input value={form.dba} onChange={(e) => setForm({ ...form, dba: e.target.value })} /></label>
        <label>Tax ID<input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} autoComplete="off" /></label>
        <label>Contact name<input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
        <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <div className="span-2">
          <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Create organization'}</button>
        </div>
      </form>

      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead><tr><th>Legal name</th><th>DBA</th><th>Contact</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.legalName}</td>
                  <td>{r.dba || '—'}</td>
                  <td>{r.contactName || r.email || '—'}</td>
                  <td><StatusBadge value={r.status} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="4" className="table-empty">No organizations yet</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
