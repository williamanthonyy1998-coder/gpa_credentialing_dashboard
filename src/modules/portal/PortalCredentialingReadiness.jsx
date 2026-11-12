import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

/**
 * Client portal: tenant-scoped readiness list (no GPA internal notes).
 */
export default function PortalCredentialingReadiness() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({ missingInformation: false, pendingVerification: false, expiredCredentials: false });

  async function load() {
    setError('');
    try {
      const r = await api.get('/credentialing/readiness', {
        params: {
          missingInformation: filter.missingInformation ? '1' : undefined,
          pendingVerification: filter.pendingVerification ? '1' : undefined,
          expiredCredentials: filter.expiredCredentials ? '1' : undefined,
          limit: 50
        }
      });
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load readiness list');
    }
  }

  useEffect(() => { load(); }, [filter.missingInformation, filter.pendingVerification, filter.expiredCredentials]);

  return (
    <div className="page">
      <PageHeader
        title="Provider credentialing readiness"
        description="Operational readiness for providers in your tenant. Not payer enrollment approval."
        breadcrumbs={[{ label: 'Portal', to: '/portal' }, { label: 'Readiness' }]}
        actions={<button type="button" className="secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>}
      />
      {error && <div className="error banner">{error}</div>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
        <label><input type="checkbox" checked={filter.missingInformation} onChange={(e) => setFilter((f) => ({ ...f, missingInformation: e.target.checked }))} /> Missing information</label>
        <label><input type="checkbox" checked={filter.pendingVerification} onChange={(e) => setFilter((f) => ({ ...f, pendingVerification: e.target.checked }))} /> Pending verification</label>
        <label><input type="checkbox" checked={filter.expiredCredentials} onChange={(e) => setFilter((f) => ({ ...f, expiredCredentials: e.target.checked }))} /> Expired credentials</label>
      </div>
      <p className="muted">{data?.disclaimer}</p>
      <div className="table-scroll panel">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Overall</th>
              <th>Issues</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((row) => (
              <tr key={row.providerId}>
                <td>{row.provider?.firstName} {row.provider?.lastName}</td>
                <td><StatusBadge value={row.overall} /></td>
                <td>{row.issueCount}</td>
                <td>
                  <Link to={`/providers/${row.providerId}/profile?step=readiness`}>Open profile</Link>
                </td>
              </tr>
            ))}
            {!data?.items?.length && (
              <tr><td colSpan={4} className="table-empty">No providers match filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
