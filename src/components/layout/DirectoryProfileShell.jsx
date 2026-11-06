import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, Bell, FileText, Plus, Send, Settings, Share2,
  UserPlus, Users, ChevronRight
} from 'lucide-react';
import ProgressBar from '../common/ProgressBar';
import WizardFooter from '../common/WizardFooter';
import BackButton from '../common/BackButton';
import { DirectoryEntityNav } from './AppSidebar';
import { useShell } from './ShellContext';

export default function DirectoryProfileShell({
  entityType = 'PRACTICE',
  title,
  status = 'ACTIVE',
  npi,
  taxId,
  completion = 0,
  breadcrumb = [],
  practices = [],
  selectedPracticeId,
  onSelectPractice,
  facilities = [],
  selectedFacilityId,
  onSelectFacility,
  onAddFacility,
  steps = [],
  activeStepKey,
  onStepChange,
  rightMode = 'practice',
  owners = [],
  onAddOwner,
  onSelectOwner,
  selectedOwnerId,
  attention,
  onRequestInfo,
  quickActions,
  children,
  stepIndex,
  stepCount,
  stepLabel,
  onPrev,
  onNext,
  centerActions,
  backLabel,
  backFallback,
  listKey,
  dirty,
  onConfirmLeave,
  backHints = {}
}) {
  const nav = useNavigate();
  const location = useLocation();
  const { setContextualNav, clearContextualNav, setHideTopbar } = useShell();
  const isActive = String(status).toUpperCase() === 'ACTIVE';
  const handlers = useRef({});
  handlers.current = { onSelectPractice, onSelectFacility, onAddFacility, onStepChange };

  const resolvedListKey = listKey || location.state?.listKey || (entityType === 'FACILITY' ? 'facilities' : 'practices');
  const resolvedFallback = backFallback
    || (entityType === 'FACILITY' ? '/facilities' : '/practices');
  const resolvedBackLabel = backLabel
    || (entityType === 'FACILITY' ? 'Back to Facilities' : 'Back to Practices');

  useEffect(() => {
    setHideTopbar(true);
    setContextualNav(
      <DirectoryEntityNav
        entityType={entityType}
        practices={practices}
        selectedPracticeId={selectedPracticeId}
        onSelectPractice={(id) => handlers.current.onSelectPractice?.(id)}
        facilities={facilities}
        selectedFacilityId={selectedFacilityId}
        onSelectFacility={(id) => handlers.current.onSelectFacility?.(id)}
        onAddFacility={() => handlers.current.onAddFacility?.()}
        steps={steps}
        activeStepKey={activeStepKey}
        onStepChange={(key) => handlers.current.onStepChange?.(key)}
      />
    );
  }, [
    entityType, practices, selectedPracticeId, facilities, selectedFacilityId,
    steps, activeStepKey, setContextualNav, setHideTopbar
  ]);

  useEffect(() => () => clearContextualNav(), [clearContextualNav]);

  const practiceQuick = quickActions || [
    { key: 'intent', label: 'Intent Letter', icon: FileText },
    { key: 'roster', label: 'Roster', icon: Users },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'alerts', label: 'Alerts', icon: Bell },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'addProvider', label: 'Add Provider', icon: UserPlus },
    { key: 'share', label: 'Share', icon: Share2 }
  ];

  const facilityQuick = quickActions || [
    { key: 'w9', label: 'W-9 Form', icon: FileText },
    { key: 'credentials', label: 'Credentials', icon: FileText },
    { key: 'enrollments', label: 'Enrollments', icon: FileText },
    { key: 'share', label: 'Share', icon: Share2 },
    { key: 'alerts', label: 'Alerts', icon: Bell },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'settings', label: 'Settings', icon: Settings }
  ];

  const actions = rightMode === 'facility' ? facilityQuick : practiceQuick;

  return (
    <div className="dir-main">
      <header className="dir-top">
        <div className="dir-top-left">
          <BackButton
            label={resolvedBackLabel}
            autoLabel
            fallbackHref={resolvedFallback}
            listKey={resolvedListKey}
            hints={backHints}
            className="back-btn dir-back-btn"
            onBeforeNavigate={() => {
              if (dirty && onConfirmLeave) return onConfirmLeave();
              if (dirty && !window.confirm('You have unsaved changes. Leave this page?')) return false;
              return true;
            }}
          />
          <div className="dir-avatar">{(title || 'P').slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="dir-entity-tag">
              {entityType} <span className="dot">•</span>
              <span className={`status-dot ${isActive ? 'on' : ''}`} />
              {isActive ? 'ACTIVE' : String(status).replaceAll('_', ' ')}
            </div>
            <h1 className="dir-title">{title || 'Untitled'}</h1>
          </div>
        </div>
        <div className="dir-meta-cards">
          <div className="dir-meta"><span>NPI</span><b>{npi || '—'}</b></div>
          <div className="dir-meta"><span>TAX ID</span><b>{taxId || '—'}</b></div>
          <div className={`dir-meta profile ${rightMode === 'facility' ? 'ring' : ''}`}>
            <span>PROFILE</span>
            <b className="accent">{Math.round(completion)}% complete</b>
            {rightMode === 'facility' ? (
              <div
                className="dir-meta-ring"
                style={{
                  background: `conic-gradient(var(--color-accent) ${Math.min(100, completion)}%, var(--color-accent-soft) 0)`
                }}
              >
                <i />
              </div>
            ) : (
              <div className="dir-meta-bar"><i style={{ width: `${Math.min(100, completion)}%` }} /></div>
            )}
          </div>
        </div>
      </header>

      <div className="dir-workspace">
        <div className="dir-center">
          <div className="dir-breadcrumb">
            {breadcrumb.map((b, i) => (
              <React.Fragment key={`${b.label}-${i}`}>
                {i > 0 && <ChevronRight size={12} />}
                {b.to ? <Link to={b.to}>{b.label}</Link> : <span>{b.label}</span>}
              </React.Fragment>
            ))}
          </div>
          {centerActions && <div className="dir-center-actions">{centerActions}</div>}
          <div className="dir-card">
            {children}
          </div>
          <WizardFooter
            stepIndex={stepIndex}
            stepCount={stepCount}
            stepLabel={stepLabel}
            onPrev={onPrev}
            onNext={onNext}
          />
        </div>

        <aside className="dir-right">
          <div className="dir-right-card">
            <div className="dir-right-head">
              <span>{rightMode === 'facility' ? 'Facility' : 'Practice'}</span>
              <b>{Math.round(completion)}%</b>
            </div>
            <ProgressBar value={completion} showPercent={false} />
            <p className="dir-right-copy">
              {Math.round(completion)}% profile completion. Incomplete {rightMode === 'facility' ? 'facilities' : 'practices'} remain usable and can receive targeted completion requests.
            </p>
          </div>

          <div className="dir-right-card">
            <div className="quick-grid">
              {actions.map(a => {
                const Icon = a.icon;
                return (
                  <button key={a.key} type="button" className="quick-tile" onClick={a.onClick}>
                    <Icon size={16} />
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {rightMode === 'practice' ? (
            <div className="dir-right-card">
              <div className="dir-right-head">
                <span>Practice Owners</span>
                <button type="button" className="icon-mini" onClick={onAddOwner} aria-label="Add owner"><Plus size={14} /></button>
              </div>
              <div className="owner-pills">
                {owners.map(o => (
                  <button
                    key={o.id || o.name}
                    type="button"
                    className={`owner-pill ${selectedOwnerId === o.id ? 'active' : ''}`}
                    onClick={() => onSelectOwner?.(o)}
                  >
                    {o.name}
                  </button>
                ))}
                {!owners.length && <div className="dir-empty">No owners yet</div>}
              </div>
            </div>
          ) : (
            <div className="dir-right-card attention">
              <div className="dir-right-head">
                <span>Credential attention</span>
              </div>
              <div className="attn-box">
                <div className="attn-title">
                  <AlertTriangle size={14} /> Expiring Soon
                  <b>{attention?.counts?.expiringSoon ?? 0}</b>
                </div>
                {(attention?.expiringSoon || []).slice(0, 3).map(d => (
                  <div key={d.id} className="attn-row">
                    <span>{d.title}</span>
                    <small>Expires: {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : '—'}</small>
                  </div>
                ))}
                {!attention?.expiringSoon?.length && <div className="dir-empty">No expiring credentials</div>}
              </div>
            </div>
          )}

          <button type="button" className="request-info-btn" onClick={onRequestInfo}>
            <Send size={16} /> Request {rightMode === 'facility' ? 'facility' : 'practice'} info
          </button>
        </aside>
      </div>
    </div>
  );
}
