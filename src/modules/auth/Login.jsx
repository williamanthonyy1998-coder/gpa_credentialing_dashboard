import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import api from '../../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/auth/login', { email, password });
      localStorage.setItem('credentialing_token', r.data.token);
      localStorage.setItem('credentialing_user', JSON.stringify(r.data.user));
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not connect to the API. Check that the backend is running.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-art">
        <div className="brand-mark"><ShieldCheck size={28} aria-hidden="true" /></div>
        <h1>eClinicAssist</h1>
        <p>Enterprise healthcare directory, credentialing, and payer enrollment — connected master records, clear ownership, auditable decisions.</p>
        <div className="login-art-foot">Secure workflows · Organization-centered directory · Operational excellence</div>
      </div>
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">WORKSPACE ACCESS</span>
        <h2>Welcome back</h2>
        <p className="muted">Sign in to continue to your directory and credentialing workspace.</p>
        <label>Email address
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" placeholder="you@organization.com" />
        </label>
        <label>Password
          <div className="login-password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="ghost-btn login-password-toggle"
              onClick={() => setShowPassword(v => !v)}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
