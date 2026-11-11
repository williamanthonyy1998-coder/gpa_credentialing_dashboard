import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  AlertTriangle, Building2, Cake, CalendarClock, CheckCircle2, ClipboardCheck, ClipboardList,
  CreditCard, FileWarning, Gift, Inbox, Landmark, ListTodo, MapPin, RefreshCw, ShieldCheck,
  Stethoscope, UserCheck, UserMinus, Users
} from 'lucide-react';
import api from '../../api/client';
import StatCard from '../../components/common/StatCard';
import { fmt, todayLabel } from '../../utils/format';

function WidgetPanel({ title, to, children, empty }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {to ? <NavLink to={to} className="text-link">View all →</NavLink> : null}
      </div>
      {empty ? (
        <div className="empty">
          <b>Nothing here yet</b>
          <span>Counts and lists update from live workspace data.</span>
        </div>
      ) : (
        <div className="queue-list">{children}</div>
      )}
    </section>
  );
}

function QueueRow({ to, icon: Icon, title, meta, date, badge }) {
  const inner = (
    <div className="queue-row">
      <div className={`queue-avatar${badge === 'teal' ? ' teal' : ''}`}>
        {Icon ? <Icon size={15} /> : <ClipboardList size={15} />}
      </div>
      <div className="queue-main">
        <b>{title}</b>
        {meta ? <span>{meta}</span> : null}
      </div>
      {date ? <div className="queue-date">{date}</div> : null}
    </div>
  );
  if (to) {
    return <Link to={to} className="queue-row-link">{inner}</Link>;
  }
  return inner;
}

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

  const recentAudit = data?.recentAudit || [];
  const upcomingFollowUps = data?.upcomingFollowUps || [];
  const expiringList = data?.expiringList || [];
  const birthdays = data?.birthdays || [];
  const anniversaries = data?.anniversaries || [];
  const taskQueue = data?.tasks || [];
  const openCases = data?.cases || [];
  const openEnrollments = data?.enrollments || [];

  return (
    <div className="page dash-page">
      {error && <div className="error banner">{error}</div>}

      <section className="dash-hero">
        <div className="dash-hero-left">
          <div className="dash-kicker">YOUR WORKSPACE AT A GLANCE</div>
          <h1>{greet}. See what needs your <span>attention</span>.</h1>
          <p>Live metrics from directory, credentialing, enrollments, and team operations—select any KPI to open the filtered workspace view.</p>
          <div className="dash-hero-links">
            <NavLink to="/organizations" className="ghost-link">Directory →</NavLink>
            <NavLink to="/enrollments" className="ghost-link">Enrollments →</NavLink>
          </div>
          <div className="muted dash-hero-meta">{todayLabel()} · {user.name || 'Workspace user'}</div>
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
        <StatCard label="Practices" value={v(m.practices)} icon={Landmark} to="/practices" tone="navy" hint="in directory" />
        <StatCard label="Facilities" value={v(m.facilities)} icon={MapPin} to="/facilities" tone="green" hint="in directory" />
        <StatCard label="Providers" value={v(m.providers)} icon={Stethoscope} to="/providers" tone="blue" hint="all records" />
        <StatCard label="Active Providers" value={v(m.activeProviders)} icon={UserCheck} to="/providers" tone="green" hint="status active" />
        <StatCard label="Organizations" value={v(m.organizations)} icon={Building2} to="/organizations" tone="navy" hint="legal entities" />
        <StatCard label="Payers" value={v(m.payers)} icon={ShieldCheck} to="/payers" tone="blue" hint="payer directory" />
        <StatCard label="Employees" value={v(m.employees)} icon={Users} to="/employees" tone="navy" hint="active accounts" />
        <StatCard label="On leave today" value={v(m.onLeaveToday)} icon={UserMinus} to="/employees?tab=leave" tone="warning" hint="approved leave" />
        <StatCard label="Checked in today" value={v(m.checkedInToday)} icon={UserCheck} to="/employees?tab=attendance" tone="blue" hint="open attendance" />
      </div>

      <div className="dash-section-head">
        <h3>Credentialing & enrollments</h3>
        <NavLink to="/enrollments" className="text-link">View enrollments →</NavLink>
      </div>
      <div className="metric-grid dash-kpi">
        <StatCard label="Open cases" value={v(m.activeCases)} icon={RefreshCw} to="/cases" tone="warning" hint="not finalized" />
        <StatCard label="Open enrollments" value={v(m.pendingEnrollments)} icon={ClipboardCheck} to="/enrollments" tone="navy" hint="in progress" />
        <StatCard label="Approved enrollments" value={v(m.approvedEnrollments)} icon={CheckCircle2} to="/enrollments?status=APPROVED" tone="green" hint="finalized" />
        <StatCard label="Denied enrollments" value={v(m.rejectedEnrollments)} icon={AlertTriangle} to="/enrollments?status=DENIED" tone="danger" hint="denied" />
        <StatCard label="Overdue follow-ups" value={v(m.overdueFollowUps)} icon={CalendarClock} to="/enrollments?overdue=1" tone="danger" hint="enrollment follow-ups" />
        <StatCard label="Pending intake" value={v(m.pendingIntake)} icon={Inbox} to="/intake" tone="blue" hint="provider intake" />
        <StatCard label="Documents expiring" value={v(m.expiringDocuments)} icon={FileWarning} to="/credentials" tone="warning" hint="next 30 days" />
        <StatCard label="Missing credentials" value={v(m.missingCredentials)} icon={CreditCard} to="/credentials" tone="danger" hint="required docs" />
      </div>

      <div className="dash-section-head">
        <h3>Tasks & workflow</h3>
        <button type="button" className="secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className="metric-grid dash-kpi dash-kpi-tasks">
        <StatCard label="My open tasks" value={v(m.myTasks)} icon={ListTodo} to="/tasks" tone="navy" hint="assigned to you" />
        <StatCard label="Overdue tasks" value={v(m.overdueTasks)} icon={AlertTriangle} to="/tasks" tone="danger" hint="past due" />
      </div>

      <div className="dash-section-head">
        <h3>Queues & activity</h3>
      </div>
      <div className="dashboard-grid">
        <WidgetPanel title="Open credentialing cases" to="/cases" empty={!openCases.length}>
          {openCases.map((c) => {
            const p = c.provider;
            const name = p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : 'Case';
            return (
              <QueueRow
                key={c.id}
                to="/cases"
                icon={RefreshCw}
                title={c.caseNumber || name}
                meta={[name, c.practice?.name].filter(Boolean).join(' · ')}
                date={fmt(c.dueAt)}
              />
            );
          })}
        </WidgetPanel>

        <WidgetPanel title="Open enrollments" to="/enrollments" empty={!openEnrollments.length}>
          {openEnrollments.map((e) => {
            const p = e.provider;
            const name = p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : e.applicationNo;
            return (
              <QueueRow
                key={e.id}
                to={`/enrollments?q=${encodeURIComponent(e.applicationNo || '')}`}
                icon={ClipboardCheck}
                title={e.applicationNo || name}
                meta={[name, e.payerPlan?.payer?.name].filter(Boolean).join(' · ')}
                date={fmt(e.nextFollowUpAt)}
              />
            );
          })}
        </WidgetPanel>

        <WidgetPanel title="Task queue" to="/tasks" empty={!taskQueue.length}>
          {taskQueue.map((t) => (
            <QueueRow
              key={t.id}
              to="/tasks"
              icon={ListTodo}
              title={t.title}
              meta={t.assignedTo?.name ? `Assignee: ${t.assignedTo.name}` : undefined}
              date={fmt(t.dueAt)}
            />
          ))}
        </WidgetPanel>

        <WidgetPanel title="Upcoming follow-ups" to="/enrollments" empty={!upcomingFollowUps.length}>
          {upcomingFollowUps.map((e) => (
            <QueueRow
              key={e.id}
              to={`/enrollments?q=${encodeURIComponent(e.applicationNo || '')}`}
              icon={CalendarClock}
              title={e.applicationNo}
              meta={e.status?.replaceAll('_', ' ')}
              date={fmt(e.nextFollowUpAt)}
            />
          ))}
        </WidgetPanel>

        <WidgetPanel title="Expiring credentials" to="/credentials" empty={!expiringList.length}>
          {expiringList.map((d) => (
            <QueueRow
              key={d.id}
              to="/credentials"
              icon={FileWarning}
              title={d.title}
              meta={d.type}
              date={fmt(d.expiresAt)}
            />
          ))}
        </WidgetPanel>

        <WidgetPanel title="Recent audit activity" to="/audit" empty={!recentAudit.length}>
          {recentAudit.map((a) => (
            <QueueRow
              key={a.id}
              to="/audit"
              icon={ShieldCheck}
              title={`${a.action} · ${a.entityType || 'record'}`}
              meta={a.actor?.name || a.actor?.email}
              date={fmt(a.createdAt)}
            />
          ))}
        </WidgetPanel>

        <WidgetPanel title="Birthdays today" to="/providers" empty={!birthdays.length}>
          {birthdays.map((p) => (
            <QueueRow
              key={p.id}
              to={`/providers?q=${encodeURIComponent(p.name || '')}`}
              icon={Cake}
              title={p.name}
              meta="Provider birthday"
              badge="teal"
            />
          ))}
        </WidgetPanel>

        <WidgetPanel title="Anniversaries today" to="/organizations" empty={!anniversaries.length}>
          {anniversaries.map((o) => (
            <QueueRow
              key={o.id}
              to={`/organizations/${o.id}/overview`}
              icon={Gift}
              title={o.name}
              meta="Organization established"
              badge="teal"
            />
          ))}
        </WidgetPanel>
      </div>
    </div>
  );
}
