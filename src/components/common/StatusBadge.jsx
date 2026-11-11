import React from 'react';

const KIND_MAP = {
  ACTIVE: 'green',
  APPROVED: 'green',
  VERIFIED: 'green',
  COMPLETED: 'green',
  CREATE: 'green',
  UPLOAD_FILE: 'green',
  AVAILABLE: 'green',
  REJECTED: 'red',
  DENIED: 'red',
  EXPIRED: 'red',
  URGENT: 'red',
  DELETE: 'red',
  INACTIVE: 'red',
  INFORMATION_NEEDED: 'amber',
  ADDITIONAL_INFORMATION_NEEDED: 'amber',
  ON_HOLD: 'amber',
  BLOCKED: 'amber',
  HIGH: 'amber',
  MISSING: 'amber',
  EXPIRING_SOON: 'amber',
  SUBMITTED: 'blue',
  PAYER_REVIEW: 'blue',
  UNDER_REVIEW: 'blue',
  IN_PROGRESS: 'blue',
  VERIFICATION_PENDING: 'blue',
  PENDING: 'blue',
  UPDATE: 'blue',
  SEED_CREATE: 'blue',
  RECEIVED: 'blue',
  IGNORED: 'neutral'
};

const PILL_KIND = {
  AVAILABLE: 'status-ok',
  MISSING: 'status-miss',
  EXPIRING_SOON: 'status-soon',
  EXPIRED: 'status-exp',
  IGNORED: 'status-ign'
};

export default function StatusBadge({ value, variant = 'badge' }) {
  const v = String(value || 'UNKNOWN').toUpperCase();
  const label = v.replaceAll('_', ' ').toLowerCase();

  if (variant === 'pill' && PILL_KIND[v]) {
    return (
      <span className={`status-pill ${PILL_KIND[v]}`} title={label}>
        {label}
      </span>
    );
  }

  const kind = KIND_MAP[v] || 'neutral';
  return <span className={`status ${kind}`} title={label}>{label}</span>;
}
