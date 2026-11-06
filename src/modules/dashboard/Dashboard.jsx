import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle, Building2, CheckCircle2, ClipboardCheck, CreditCard, Landmark,
  MapPin, RefreshCw, ShieldCheck, Stethoscope, Users
} from 'lucide-react';
import api from '../../api/client';
import StatCard from '../../components/common/StatCard';
import { todayLabel } from '../../utils/format';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('credentialing_user') || '{}');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  async function load() {
    setLoading(true);
    setError('');
    try { setData((await api.get('/dashboard')).data); }
    catch (e) { setError(e.response?.data?.error || 'Unable to load dashboard.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const m = data?.metrics || {};
  const v = (n) => (loading ? '—' : (n ?? 0));

  return (
    <div className="page dash-page">
      {error && <div className="error banner">{error}</div>}

      <section className="dash-hero">
        <div className="dash-hero-left">
          <div className="dash-kicker">✦ YOUR WORKSPACE AT A GLANCE</div>
          <h1>{greet}. See what needs your <span>attention</span>.</h1>
          <p>Your directory, revenue cycle, business development and credentialing summaries in one place.</p>
          <div className="dash-hero-links">
            <NavLink to="/organizations" className="ghost-link">Directory →</NavLink>
            <NavLink to="/cases" className="ghost-link">Credentialing →</NavLink>
          </div>
          <div className="muted" style={{ marginTop: 14, fontSize: 10 }}>{todayLabel()} · {user.name || 'Workspace user'}</div>
        </div>
        <div className="dash-hero-right">
          <div className="dash-kicker light">YOUR NEXT STEP</div>
          <h2>Continue your work</h2>
          <p>Open a dashboard or select a KPI below to review the records behind it.</p>
          <NavLink to="/organizations" className="primary">View Directory →</NavLink>
          <NavLink to="/enrollments" className="dash-sublink">View enrollments →</NavLink>
        </div>
      </section>

      <div className="dash-section-head">
        <h3>Directory</h3>
        <NavLink to="/organizations" className="text-link">View dashboard →</NavLink>
      </div>
      <div className="metric-grid dash-kpi">
        <StatCard label="Practices" value={v(m.practices)} icon={Landmark} to="/practices" tone="navy" hint="active vs inactive" />
        <StatCard label="Facilities" value={v(m.facilities)} icon={MapPin} to="/facilities" tone="green" hint="active vs inactive" />
        <StatCard label="Providers" value={v(m.providers)} icon={Stethoscope} to="/providers" tone="blue" hint="directory master records" />
        <StatCard label="Organizations" value={v(m.organizations)} icon={Building2} to="/organizations" tone="warning" hint="legal entities" />
      </div>

      <div className="dash-section-head">
        <h3>Credentialing</h3>
        <NavLink to="/enrollments" className="text-link">View dashboard →</NavLink>
      </div>
      <div className="metric-grid dash-kpi">
        <StatCard label="Open Enrollments" value={v(m.pendingEnrollments)} icon={ClipboardCheck} to="/enrollments" tone="navy" hint="not finalized" />
        <StatCard label="Overdue Follow-ups" value={v(m.overdueTasks)} icon={AlertTriangle} to="/tasks" tone="danger" hint="require action" />
        <StatCard label="Action Required" value={v(m.activeCases)} icon={RefreshCw} to="/cases" tone="warning" hint="open cases" />
        <StatCard label="Documents Expiring" value={v(m.expiringDocuments)} icon={CheckCircle2} to="/credentials" tone="green" hint="next 30 days" />
      </div>

      <div className="dash-section-head">
        <h3>Workspace</h3>
        <button className="secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className="metric-grid dash-kpi" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <StatCard label="Payers" value={v(m.payers)} icon={ShieldCheck} to="/payers" tone="danger" hint="payer directory" />
        <StatCard label="Employees" value={v(data?.metrics?.employees)} icon={Users} to="/employees" tone="navy" hint="team accounts" />
        <StatCard label="Pending Enrollments" value={v(m.pendingEnrollments)} icon={CreditCard} to="/enrollments" tone="blue" hint="follow-ups" />
      </div>
    </div>
  );
}
