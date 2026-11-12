import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

export default function PortalProfile() {
  const [form, setForm] = useState({
    name: '', primaryContactName: '', primaryContactEmail: '', primaryContactPhone: '',
    status: '', onboardingStatus: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setError('');
    try {
      const r = await api.get('/portal/profile');
      setForm({
        name: r.data.name || '',
        primaryContactName: r.data.primaryContactName || '',
        primaryContactEmail: r.data.primaryContactEmail || '',
        primaryContactPhone: r.data.primaryContactPhone || '',
        status: r.data.status || '',
        onboardingStatus: r.data.onboardingStatus || ''
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load profile');
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.patch('/portal/profile', {
        primaryContactName: form.primaryContactName || null,
        primaryContactEmail: form.primaryContactEmail || null,
        primaryContactPhone: form.primaryContactPhone || null
      });
      setMessage('Profile updated. GPA may review changes before full activation.');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Client profile"
        breadcrumbs={[{ label: 'Portal', to: '/portal' }, { label: 'Profile' }]}
      />
      {error && <div className="error banner">{error}</div>}
      {message && <div className="banner" style={{ background: '#eef8f1', padding: 12 }}>{message}</div>}
      <form className="panel form-grid" style={{ padding: 16 }} onSubmit={save}>
        <label>Account name<input value={form.name} disabled /></label>
        <label>Status<div><StatusBadge value={form.status} /></div></label>
        <label>Onboarding<div><StatusBadge value={form.onboardingStatus} /></div></label>
        <label>Primary contact<input value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} /></label>
        <label>Contact email<input type="email" value={form.primaryContactEmail} onChange={(e) => setForm({ ...form, primaryContactEmail: e.target.value })} /></label>
        <label>Contact phone<input value={form.primaryContactPhone} onChange={(e) => setForm({ ...form, primaryContactPhone: e.target.value })} /></label>
        <div className="span-2">
          <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        </div>
      </form>
    </div>
  );
}
