import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

export default function PortalProviderIntakeDetail() {
  const { id } = useParams();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setRow((await api.get(`/portal/provider-intakes/${id}`)).data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load intake');
    }
  }

  useEffect(() => { load(); }, [id]);

  async function resend(invitationId) {
    setBusy(true);
    try {
      const r = await api.post(`/intake/provider-invitations/${invitationId}/resend`);
      if (r.data.acceptanceUrl) setError(`Email not delivered. Share: ${r.data.acceptanceUrl}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Resend failed');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invitationId) {
    setBusy(true);
    try {
      await api.post(`/intake/provider-invitations/${invitationId}/revoke`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Revoke failed');
    } finally {
      setBusy(false);
    }
  }

  if (!row && !error) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <PageHeader
        title={row?.referenceNo || 'Provider intake'}
        breadcrumbs={[
          { label: 'Portal', to: '/portal' },
          { label: 'Provider intakes', to: '/portal/provider-intakes' },
          { label: row?.referenceNo || 'Detail' }
        ]}
      />
      {error && <div className="error banner">{error}</div>}
      {row && (
        <>
          <p>Status: <StatusBadge value={row.status} /> · Email: {row.invitedEmail || row.contactEmail}</p>
          {row.reviewerComments && <p>Reviewer comments: {row.reviewerComments}</p>}
          {row.rejectionReason && <p className="error">Rejection: {row.rejectionReason}</p>}
          <p className="muted">GPA internal notes are not shown in the client portal.</p>

          <section className="panel" style={{ padding: 16, marginBottom: 16 }}>
            <h3>Submitted profile (read-only)</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
              {JSON.stringify(row.submittedPayload || row.payload || {}, null, 2)}
            </pre>
          </section>

          <section className="panel table-panel" style={{ marginBottom: 16 }}>
            <h3 style={{ padding: '12px 16px', margin: 0 }}>Invitations</h3>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Email</th><th>Status</th><th>Delivery</th><th>Actions</th></tr></thead>
                <tbody>
                  {(row.invitations || []).map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.email}</td>
                      <td><StatusBadge value={inv.status} /></td>
                      <td>{inv.deliveryStatus}</td>
                      <td>
                        {inv.status === 'PENDING' && (
                          <>
                            <button type="button" className="small-action" disabled={busy} onClick={() => resend(inv.id)}>Resend</button>
                            {' '}
                            <button type="button" className="small-action" disabled={busy} onClick={() => revoke(inv.id)}>Revoke</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" style={{ padding: 16 }}>
            <h3>Documents</h3>
            <ul>
              {(row.documents || []).map((d) => (
                <li key={d.id}>{d.title} — {d.securityStatus}</li>
              ))}
              {!row.documents?.length && <li className="muted">No documents</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
