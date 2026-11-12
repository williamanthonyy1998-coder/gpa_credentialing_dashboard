import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import CellText from '../../components/common/CellText';

export default function ClientsPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', primaryContactName: '', primaryContactEmail: '', primaryContactPhone: '', internalNotes: ''
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/clients', { params: { q: q || undefined, pageSize: 50 } });
      setRows(r.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load client accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function createClient(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = (await api.post('/clients', {
        ...form,
        primaryContactEmail: form.primaryContactEmail || null,
        slug: form.slug || undefined
      })).data;
      setModal(false);
      nav(`/clients/${created.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create client');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="GPA PLATFORM"
        title="Client accounts"
        description="Onboard external client tenants, manage invitations, and track onboarding status."
        breadcrumbs={[{ label: 'Clients' }]}
        actions={(
          <>
            <button type="button" className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
            <button type="button" className="primary" onClick={() => setModal(true)}><Plus size={16} /> New client</button>
          </>
        )}
      />
      {error && <div className="error banner">{error}</div>}
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" />
          </div>
          <span className="record-count">{loading ? 'Loading…' : `${rows.length} clients`}</span>
        </div>
        <div className="table-scroll table-cards">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th className="col-narrow">Slug</th>
                <th className="col-status">Status</th>
                <th className="col-status">Onboarding</th>
                <th className="col-narrow">Members</th>
                <th className="col-narrow">Orgs</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="table-empty">Loading…</td></tr>
              ) : !rows.length ? (
                <tr><td colSpan="6" className="table-empty">No client accounts yet</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/clients/${row.id}`)}>
                  <td data-label="Client"><CellText strong><Link to={`/clients/${row.id}`}>{row.name}</Link></CellText></td>
                  <td className="col-narrow" data-label="Slug">{row.slug}</td>
                  <td className="col-status" data-label="Status"><StatusBadge value={row.status} /></td>
                  <td className="col-status" data-label="Onboarding"><StatusBadge value={row.onboardingStatus} /></td>
                  <td className="col-narrow" data-label="Members">{row._count?.memberships ?? '—'}</td>
                  <td className="col-narrow" data-label="Orgs">{row._count?.organizations ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModal(false)}>
          <form className="record-modal" onSubmit={createClient}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">NEW CLIENT</span>
                <h2>Create client account</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="form-grid" style={{ padding: '0 24px 12px' }}>
              <label>Client name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Slug / code<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto from name" /></label>
              <label>Primary contact<input value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} /></label>
              <label>Contact email<input type="email" value={form.primaryContactEmail} onChange={(e) => setForm({ ...form, primaryContactEmail: e.target.value })} /></label>
              <label>Contact phone<input value={form.primaryContactPhone} onChange={(e) => setForm({ ...form, primaryContactPhone: e.target.value })} /></label>
              <label className="span-2">Internal GPA notes<textarea rows={3} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} /></label>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="primary" disabled={saving}>{saving ? 'Creating…' : 'Create client'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
