import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/password-reset/request', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit request. Try again later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">GPA</div>
        <h1>Reset password</h1>
        {sent ? (
          <p className="muted" role="status">
            If an account exists for that email, password reset instructions have been sent.
          </p>
        ) : (
          <>
            <p className="muted">Enter your email and we will send reset instructions if an account exists.</p>
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="you@organization.com"
              />
            </label>
            {error && <div className="error banner" role="alert">{error}</div>}
            <button className="primary full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          </>
        )}
        <p className="muted" style={{ marginTop: 16 }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
