import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';

export default function ResetPassword() {
  const [search] = useSearchParams();
  const nav = useNavigate();
  const token = useMemo(() => search.get('token') || '', [search]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Reset link is invalid or missing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/password-reset/confirm', { token, password });
      setDone(true);
      setTimeout(() => nav('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset password. The link may have expired.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">GPA</div>
        <h1>Choose new password</h1>
        {done ? (
          <p className="muted" role="status">Password updated. Redirecting to sign in…</p>
        ) : !token ? (
          <p className="muted">This reset link is invalid. Request a new one from the sign-in page.</p>
        ) : (
          <>
            <p className="muted">Enter a new password (at least 10 characters).</p>
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
            </label>
            {error && <div className="error banner" role="alert">{error}</div>}
            <button className="primary full" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
          </>
        )}
        <p className="muted" style={{ marginTop: 16 }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
