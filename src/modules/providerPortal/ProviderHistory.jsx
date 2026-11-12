import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import ProfessionalHistoryPanel from '../providers/ProfessionalHistoryPanel';

/**
 * External provider view of their own converted provider professional history.
 * Providers can submit/update records but cannot verify themselves.
 */
export default function ProviderHistory() {
  const { providerId } = useParams();
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.get(`/provider-portal/providers/${providerId}/professional-history/summary`);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Could not load professional history');
      }
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  return (
    <div className="page">
      <PageHeader
        title="My professional history"
        description="Submit and update your professional history. GPA must verify records before they are trusted."
        breadcrumbs={[
          { label: 'Provider portal', to: '/provider-portal' },
          { label: 'Professional history' }
        ]}
        actions={<Link className="secondary" to="/provider-portal">Back to intakes</Link>}
      />
      {error && <div className="error banner">{error}</div>}
      {ready && (
        <ProfessionalHistoryPanel
          providerId={providerId}
          canVerify={false}
          readOnly={false}
          basePathOverride={`/provider-portal/providers/${providerId}/professional-history`}
        />
      )}
    </div>
  );
}
