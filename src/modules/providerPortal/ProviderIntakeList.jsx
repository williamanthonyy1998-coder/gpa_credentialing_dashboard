import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

export default function ProviderIntakeList() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setRows((await api.get('/provider-portal/intakes')).data || []);
      } catch (e) {
        setError(e.response?.data?.error || 'Could not load intakes');
      }
    })();
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="My intake requests"
        breadcrumbs={[{ label: 'Provider portal', to: '/provider-portal' }, { label: 'Intakes' }]}
      />
      {error && <div className="error banner">{error}</div>}
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Client</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.referenceNo}</td>
                  <td>{row.tenant?.name || '—'}</td>
                  <td>{row.kind}</td>
                  <td><StatusBadge value={row.status} /></td>
                  <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td>{new Date(row.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <Link to={`/provider-portal/intakes/${row.id}`}>
                      {['CHANGES_REQUESTED', 'IN_PROGRESS', 'INVITED'].includes(row.status) ? 'Continue' : 'View'}
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="7" className="table-empty">No intakes assigned to you</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
