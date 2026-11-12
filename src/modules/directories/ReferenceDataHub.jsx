import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpen, Building2, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { directoryMenu } from '../../config/directories';

const scopeLabel = {
  platform: 'Platform-global',
  tenant: 'Tenant-specific',
  hybrid: 'Platform + tenant'
};

export default function ReferenceDataHub() {
  const nav = useNavigate();
  const platform = directoryMenu.filter(i => i.scope === 'platform' || i.scope === 'hybrid');
  const tenant = directoryMenu.filter(i => i.scope === 'tenant');

  function Card({ item, icon: Icon }) {
    return (
      <button type="button" className="ref-data-card" onClick={() => nav(item.path)}>
        <Icon size={18} aria-hidden="true" />
        <div>
          <b>{item.label}</b>
          <small>{scopeLabel[item.scope] || item.scope}</small>
        </div>
      </button>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Reference Data"
        breadcrumbs={[{ label: 'Reference Data' }]}
        actions={(
          <button type="button" className="secondary" onClick={() => nav('/directories/quality')}>
            <AlertTriangle size={15} /> Directory quality
          </button>
        )}
      />
      <p className="muted">
        Platform catalogs are shared across clients and maintained by GPA administrators.
        Tenant directories (contacts, billing entities, custom categories) stay isolated to the active client account.
      </p>

      <h3 className="section-title">Platform catalogs</h3>
      <div className="ref-data-grid">
        {platform.map(item => (
          <Card key={item.key} item={item} icon={item.key.includes('payer') || item.key === 'plans' ? ShieldCheck : BookOpen} />
        ))}
      </div>

      <h3 className="section-title">Tenant directories</h3>
      <div className="ref-data-grid">
        {tenant.map(item => (
          <Card key={item.key} item={item} icon={Building2} />
        ))}
      </div>
    </div>
  );
}
