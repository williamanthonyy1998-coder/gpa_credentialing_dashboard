import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

function monthLabel(d) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function CredentialExpirationCalendar() {
  const nav = useNavigate();
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/automation/calendar', {
        params: {
          view,
          anchor,
          category: category || undefined,
          status: status || undefined
        }
      });
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not load calendar');
    } finally {
      setLoading(false);
    }
  }, [view, anchor, category, status]);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const ev of data?.events || []) {
      const day = String(ev.dueDate).slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(ev);
    }
    return map;
  }, [data]);

  function shift(months) {
    const d = new Date(anchor + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + months);
    setAnchor(d.toISOString().slice(0, 10));
  }

  return (
    <div className="page">
      <PageHeader
        title="Credential expiration calendar"
        subtitle="Licenses, certifications, malpractice, and revalidation deadlines from live database records."
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {['month', 'week', 'upcoming'].map((v) => (
          <button key={v} type="button" className={view === v ? 'primary' : 'secondary'} onClick={() => setView(v)}>
            {v === 'month' ? 'Month' : v === 'week' ? 'Week' : 'Upcoming list'}
          </button>
        ))}
        {view === 'month' && (
          <>
            <button type="button" className="secondary" onClick={() => shift(-1)}>Previous</button>
            <button type="button" className="secondary" onClick={() => shift(1)}>Next</button>
            <span style={{ alignSelf: 'center' }}>{monthLabel(new Date(anchor + 'T00:00:00Z'))}</span>
          </>
        )}
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All credential types</option>
          {['LICENSE', 'MALPRACTICE', 'BOARD_CERT', 'PROFESSIONAL_CERT', 'REVALIDATION', 'OTHER_CREDENTIAL'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="overdue">Overdue</option>
          <option value="alerted">Alerted</option>
        </select>
        <button type="button" className="secondary" onClick={load}>Refresh</button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p>Loading…</p>}

      {!loading && data && (
        <>
          <p className="muted">
            {data.counts.total} events · {data.counts.overdue} overdue · {data.counts.upcoming} upcoming
            {' '}({new Date(data.from).toLocaleDateString()} – {new Date(data.to).toLocaleDateString()})
          </p>

          {!data.events.length && <p className="muted">No expiration events in this range.</p>}

          {view !== 'upcoming' && !!data.events.length && (
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byDay.entries()].map(([day, events]) => (
                    <tr key={day}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(day + 'T00:00:00Z').toLocaleDateString()}</td>
                      <td>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {events.map((ev) => (
                            <li key={`${ev.category}-${ev.recordId}`}>
                              <button type="button" className="secondary" style={{ padding: '2px 8px' }} onClick={() => nav(ev.href)}>
                                {ev.title}
                              </button>
                              {' · '}
                              {ev.providerName || '—'}
                              {' · '}
                              {ev.organizationName || '—'}
                              {' · '}
                              <StatusBadge value={ev.overdue ? 'OVERDUE' : `${ev.daysRemaining}d`} />
                              {ev.alertStatus ? ` · alert ${ev.alertStatus}` : ''}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'upcoming' && !!data.events.length && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Due</th>
                    <th>Title</th>
                    <th>Provider</th>
                    <th>Organization</th>
                    <th>Type</th>
                    <th>Days</th>
                    <th>Alert</th>
                    <th>Assignee</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((ev) => (
                    <tr key={`${ev.category}-${ev.recordId}-${ev.dueDate}`}>
                      <td>{new Date(ev.dueDate).toLocaleDateString()}</td>
                      <td>{ev.title}</td>
                      <td>{ev.providerName || '—'}</td>
                      <td>{ev.organizationName || '—'}</td>
                      <td>{ev.category}</td>
                      <td><StatusBadge value={ev.overdue ? 'OVERDUE' : String(ev.daysRemaining)} /></td>
                      <td>{ev.alertStatus || '—'}</td>
                      <td>{ev.assignedToName || '—'}</td>
                      <td>
                        <button type="button" className="secondary" onClick={() => nav(ev.href)}>Open</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
