import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

/**
 * External provider: own credentialing readiness + correction submission only.
 * Never shows GPA internal notes; cannot verify own records.
 */
export default function ProviderCredentialingProfile() {
  const { providerId } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try {
      const r = await api.get(`/providers/${providerId}/credentialing-profile`);
      setProfile(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load credentialing profile');
    }
  }

  useEffect(() => { load(); }, [providerId]);

  async function submitCorrections() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/providers/${providerId}/review/submit-corrections`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  const review = profile?.profileReview;
  const gaps = profile?.gaps || [];

  return (
    <div className="page">
      <PageHeader
        title="My credentialing profile"
        description="Operational readiness for your file. This is not payer enrollment approval."
        breadcrumbs={[
          { label: 'Provider portal', to: '/provider-portal' },
          { label: 'Credentialing profile' }
        ]}
        actions={<Link className="secondary" to="/provider-portal">Back</Link>}
      />
      {error && <div className="error banner">{error}</div>}
      {profile && (
        <>
          <div className="banner" style={{ background: '#f4f7fb', padding: 12, marginBottom: 12 }}>
            <strong>Overall: {profile.readiness?.overall || '—'}</strong>
            <div className="muted" style={{ marginTop: 4 }}>{profile.disclaimer}</div>
          </div>
          {review?.status === 'CORRECTIONS_REQUESTED' && (
            <section className="panel" style={{ padding: 16, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Corrections requested</h3>
              <p>{review.clientVisibleNotes || 'Please update the requested information.'}</p>
              <p className="muted">Internal GPA notes are never shown here. Submitting does not verify your own records.</p>
              <button type="button" className="btn" disabled={busy} onClick={submitCorrections}>
                Mark corrections submitted
              </button>
            </section>
          )}
          <section className="panel" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Open gaps</h3>
            {!gaps.length && <p className="muted">No open gaps.</p>}
            <ul>
              {gaps.map((g) => (
                <li key={g.id}>
                  <StatusBadge value={g.priority} /> {g.title}
                  <div className="muted">{g.recommendedNextAction}</div>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to={`/provider-portal/providers/${providerId}/history`}>Professional history</Link>
            </div>
          </section>
          <section className="panel" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Dimensions</h3>
            <ul>
              {(profile.readiness?.dimensions || []).map((d) => (
                <li key={d.key}>
                  {d.label}: <StatusBadge value={d.status} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
