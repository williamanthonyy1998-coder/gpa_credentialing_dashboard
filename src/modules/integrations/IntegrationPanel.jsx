import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';

function statusLabel(status) {
  switch (status) {
    case 'CONNECTED': return 'API connected';
    case 'PENDING_APPROVAL': return 'Approval required';
    case 'PENDING_CREDENTIALS': return 'Credentials missing';
    case 'READY_FOR_CONNECTION_TEST': return 'Connection test required';
    case 'MANUAL_ONLY': return 'Manual portal only';
    case 'NOT_SUPPORTED': return 'Not supported';
    case 'NOT_CONFIGURED': return 'Not configured';
    case 'DEGRADED': return 'Degraded';
    case 'DISABLED': return 'Disabled';
    default: return status || '—';
  }
}

/**
 * Phase 4D — integration registry / authorization / manual fallback panel.
 * Green "API connected" only when status is CONNECTED after a real successful test.
 */
export default function IntegrationPanel({
  providerId = null,
  enrollmentId = null,
  canConfigure = false,
  canManageAuth = false
}) {
  const [items, setItems] = useState([]);
  const [auths, setAuths] = useState([]);
  const [ops, setOps] = useState([]);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.get('/integrations');
      const rows = list.data.items || [];
      setItems(rows);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
      if (providerId) {
        const a = await api.get(`/providers/${providerId}/integration-authorizations`);
        setAuths(a.data.items || []);
      }
      if (selectedId || rows[0]?.id) {
        const id = selectedId || rows[0].id;
        try {
          const o = await api.get(`/integrations/${id}/operations`);
          setOps(o.data.items || []);
        } catch {
          setOps([]);
        }
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [providerId, selectedId]);

  useEffect(() => { load(); }, [load]);

  const selected = items.find((i) => i.id === selectedId) || items[0];

  async function testConnection() {
    if (!selected) return;
    try {
      await api.post(`/integrations/${selected.id}/test-connection`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  async function grantAuth() {
    if (!providerId || !selected) return;
    try {
      await api.post(`/providers/${providerId}/integration-authorizations`, {
        integrationId: selected.id,
        notes: 'Staff-recorded provider authorization/delegation'
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  async function revokeAuth(id) {
    if (!providerId) return;
    try {
      await api.post(`/providers/${providerId}/integration-authorizations/${id}/revoke`, {
        reason: 'Revoked by staff'
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  async function recordManual() {
    if (!enrollmentId || !selected || !manualSummary.trim()) return;
    try {
      await api.post(`/enrollments/${enrollmentId}/integrations/manual-action`, {
        integrationId: selected.id,
        actionType: 'PORTAL_ACTION',
        summary: manualSummary,
        externalReference: externalRef || null,
        channel: 'PAYER_PORTAL_MANUAL'
      });
      setManualSummary('');
      setExternalRef('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  const caps = selected?.capabilities && typeof selected.capabilities === 'object'
    ? Object.entries(selected.capabilities)
    : [];

  return (
    <section style={{ marginTop: 20 }}>
      <div className="section-head">
        <h3 style={{ margin: 0 }}>External integrations</h3>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Registry and manual fallback only. API connected requires a successful connection test —
          CAQH / PECOS / Availity are not claimed operational without verified authorized access.
        </p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <label>
        Integration
        <select value={selected?.id || ''} onChange={(e) => setSelectedId(e.target.value)}>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.displayName} ({i.tenantId ? 'tenant' : 'platform'}) — {statusLabel(i.status)}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '12px 0' }}>
          <div>
            <div><b>{selected.displayName}</b></div>
            <div className="muted">Status <StatusBadge value={selected.status} /> — {statusLabel(selected.status)}</div>
            <div className="muted">Mode {selected.connectionMode}</div>
            <div className="muted">
              Last test {selected.lastTestedAt ? new Date(selected.lastTestedAt).toLocaleString() : '—'}
            </div>
            <div className="muted">
              Last sync {selected.lastSuccessfulSyncAt ? new Date(selected.lastSuccessfulSyncAt).toLocaleString() : '—'}
            </div>
            <div className="muted">Credentials {selected.credentialConfigured ? 'referenced' : 'missing'}</div>
            {selected.status === 'CONNECTED' ? (
              <div><b>API connected</b> (verified test)</div>
            ) : selected.status === 'MANUAL_ONLY' ? (
              <div>Manual portal only — not an API connection</div>
            ) : null}
          </div>
          <div>
            <b>Capabilities</b>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
              {caps.slice(0, 8).map(([name, meta]) => (
                <li key={name}>{name}: {meta?.status || '—'}</li>
              ))}
              {!caps.length && <li>None recorded</li>}
            </ul>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {canConfigure && selected?.tenantId && (
          <button type="button" className="secondary" disabled={loading} onClick={testConnection}>
            Test connection
          </button>
        )}
        {canManageAuth && providerId && selected && (
          <button type="button" className="secondary" onClick={grantAuth}>
            Record provider authorization
          </button>
        )}
      </div>

      {providerId && (
        <>
          <h4>Provider authorizations</h4>
          <ul className="muted">
            {auths.map((a) => (
              <li key={a.id}>
                {a.integration?.displayName || a.integrationId}: <StatusBadge value={a.status} />
                {a.active ? ' (active)' : ''}
                {canManageAuth && a.status === 'GRANTED' && (
                  <>
                    {' '}
                    <button type="button" className="ghost" onClick={() => revokeAuth(a.id)}>Revoke</button>
                  </>
                )}
              </li>
            ))}
            {!auths.length && <li>No authorizations recorded.</li>}
          </ul>
        </>
      )}

      {enrollmentId && canManageAuth && (
        <>
          <h4>Manual workflow</h4>
          <p className="muted">
            Opens a recorded staff action only. Does not mark the enrollment submitted or approved.
            Use Phase 4C submission confirmation for actual send attestation.
          </p>
          <div style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
            <input
              placeholder="Action summary"
              value={manualSummary}
              onChange={(e) => setManualSummary(e.target.value)}
            />
            <input
              placeholder="External reference (optional)"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
            />
            <button type="button" className="secondary" disabled={!manualSummary.trim()} onClick={recordManual}>
              Record manual portal action
            </button>
          </div>
        </>
      )}

      <h4>Recent operations</h4>
      <ul className="muted">
        {ops.slice(0, 10).map((o) => (
          <li key={o.id}>
            {new Date(o.createdAt).toLocaleString()} — {o.operationType}: <StatusBadge value={o.operationStatus} />
            {o.safeErrorSummary ? ` — ${o.safeErrorSummary}` : ''}
          </li>
        ))}
        {!ops.length && <li>No operations yet.</li>}
      </ul>
    </section>
  );
}
