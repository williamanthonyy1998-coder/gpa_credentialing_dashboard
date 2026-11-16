import { useEffect, useState } from 'react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';

export default function NotificationPreferencesPage() {
  const [items, setItems] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [prefs, del] = await Promise.all([
        api.get('/notifications/preferences'),
        api.get('/notifications/deliveries')
      ]);
      setItems(prefs.data.items || []);
      setDeliveries(del.data.items || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateLocal(category, patch) {
    setItems((prev) => prev.map((row) => (
      row.category === category
        ? {
            ...row,
            ...patch,
            channelInApp: row.mandatoryInApp ? true : (patch.channelInApp ?? row.channelInApp)
          }
        : row
    )));
  }

  async function save() {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const r = await api.put('/notifications/preferences', {
        items: items.map((i) => ({
          category: i.category,
          channelInApp: i.channelInApp,
          channelEmail: i.channelEmail
        }))
      });
      setItems(r.data.items || []);
      setSuccess('Preferences saved.');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Notification preferences"
        subtitle="Configure in-app and email reminders. System notifications always remain available in-app."
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="muted">{success}</p>}
      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>In-app</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.category}>
                    <td>
                      {row.category}
                      {row.mandatoryInApp ? ' (required in-app)' : ''}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!row.channelInApp}
                        disabled={row.mandatoryInApp}
                        onChange={(e) => updateLocal(row.category, { channelInApp: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!row.channelEmail}
                        onChange={(e) => updateLocal(row.category, { channelEmail: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="primary" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save preferences'}
            </button>
          </div>

          <section className="panel" style={{ marginTop: 24, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Recent delivery history</h3>
            <p className="muted">Failed emails are shown as failed — never marked delivered when the provider is unavailable.</p>
            {!deliveries.length && <p className="muted">No delivery records yet.</p>}
            {!!deliveries.length && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Channel</th>
                      <th>Status</th>
                      <th>Summary</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id}>
                        <td>{new Date(d.createdAt).toLocaleString()}</td>
                        <td>{d.channel}</td>
                        <td>{d.status}</td>
                        <td>{d.payloadSummary || '—'}</td>
                        <td>{d.lastError || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
