import React from 'react';

export default function StatusBadge({ value }) {
  const v = String(value || 'UNKNOWN');
  let kind = 'neutral';
  if (['ACTIVE', 'APPROVED', 'VERIFIED', 'COMPLETED', 'CREATE', 'UPLOAD_FILE'].includes(v)) kind = 'green';
  else if (['REJECTED', 'DENIED', 'EXPIRED', 'URGENT', 'DELETE', 'INACTIVE'].includes(v)) kind = 'red';
  else if (['INFORMATION_NEEDED', 'ADDITIONAL_INFORMATION_NEEDED', 'ON_HOLD', 'BLOCKED', 'HIGH', 'MISSING'].includes(v)) kind = 'amber';
  else if (['SUBMITTED', 'PAYER_REVIEW', 'UNDER_REVIEW', 'IN_PROGRESS', 'VERIFICATION_PENDING', 'PENDING'].includes(v)) kind = 'blue';
  else if (['UPDATE', 'SEED_CREATE'].includes(v)) kind = 'blue';
  return <span className={`status ${kind}`}>{v.replaceAll('_', ' ')}</span>;
}
