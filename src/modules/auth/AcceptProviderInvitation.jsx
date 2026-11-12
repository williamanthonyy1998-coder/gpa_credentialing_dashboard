import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';

export default function AcceptProviderInvitation() {
  const { token } = useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', password: '', confirm: '' });
  const existingToken = localStorage.getItem('credentialing_token');
  const existingUser = JSON.parse(localStorage.getItem('credentialing_user') || 'null');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get(`/provider-invitations/${encodeURIComponent(token)}`);
        if (!cancelled) setInfo(r.data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Invitation is invalid or no longer available');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function acceptNew(e) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const r = await api.post(`/provider-invitations/${encodeURIComponent(token)}/accept`, {
        email: info.email,
        name: form.name,
        password: form.password
      });
      localStorage.setItem('credentialing_token', r.data.token);
      localStorage.setItem('credentialing_user', JSON.stringify(r.data.user));
      localStorage.setItem('credentialing_tenants', JSON.stringify([]));
      localStorage.removeItem('credentialing_tenant_id');
      nav(r.data.redirectTo || '/provider-portal', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept invitation');
    } finally {
      setSaving(false);
    }
  }

  async function acceptAuthenticated() {
    setSaving(true);
    setError('');
    try {
      const r = await api.post(`/provider-invitations/${encodeURIComponent(token)}/accept-authenticated`);
      nav(r.data.redirectTo || '/provider-portal', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept invitation');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={info?.userExists ? (e) => e.preventDefault() : acceptNew}>
        <div className="brand-mark">GPA</div>
        <h1>Provider intake invitation</h1>
        {loading && <p className="muted">Validating invitation…</p>}
        {error && <div className="error banner">{error}</div>}
        {info && !error && (
          <>
            <p className="muted">
              Complete credentialing intake <b>{info.intake?.referenceNo}</b> for <b>{info.tenant?.name}</b>.
              Invitation emailed to <b>{info.email}</b>.
            </p>
            {info.userExists ? (
              existingToken && existingUser?.email?.toLowerCase() === info.email.toLowerCase() ? (
                <button type="button" className="primary" disabled={saving} onClick={acceptAuthenticated}>
                  {saving ? 'Accepting…' : 'Accept with current session'}
                </button>
              ) : (
                <p className="muted">
                  An account already exists for this email.{' '}
                  <Link to="/login">Sign in</Link> then return to this invitation link.
                </p>
              )
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label>Password (min 12 characters)
                  <input required type="password" minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
                </label>
                <label>Confirm password
                  <input required type="password" minLength={12} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" />
                </label>
                <button className="primary" disabled={saving}>{saving ? 'Creating account…' : 'Create account & continue'}</button>
              </div>
            )}
          </>
        )}
        <p className="muted" style={{ marginTop: 16 }}><Link to="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}
