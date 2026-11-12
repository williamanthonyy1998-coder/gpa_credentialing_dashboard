/** Prisma EnrollmentStatus → human-readable labels */
export const ENROLLMENT_STATUS_ORDER = [
  'NOT_STARTED',
  'PREPARING',
  'READY_TO_SUBMIT',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'PAYER_REVIEW',
  'ADDITIONAL_INFORMATION_NEEDED',
  'APPROVED',
  'EFFECTIVE',
  'DENIED',
  'WITHDRAWN',
  'TERMINATED',
  'CLOSED'
];

export const enrollmentStatusLabel = {
  NOT_STARTED: 'Not started',
  PREPARING: 'Preparing',
  READY_TO_SUBMIT: 'Ready to submit',
  SUBMITTED: 'Submitted',
  ACKNOWLEDGED: 'Acknowledged',
  PAYER_REVIEW: 'Payer review',
  ADDITIONAL_INFORMATION_NEEDED: 'Additional info needed',
  APPROVED: 'Approved',
  EFFECTIVE: 'Effective',
  DENIED: 'Denied',
  WITHDRAWN: 'Withdrawn',
  TERMINATED: 'Terminated',
  CLOSED: 'Closed'
};

/** Semantic KPI tones for VIP Light status cards */
export const enrollmentStatusTone = {
  NOT_STARTED: 'neutral',
  PREPARING: 'info',
  READY_TO_SUBMIT: 'info',
  SUBMITTED: 'info',
  ACKNOWLEDGED: 'info',
  PAYER_REVIEW: 'warning',
  ADDITIONAL_INFORMATION_NEEDED: 'warning',
  APPROVED: 'success',
  EFFECTIVE: 'success',
  DENIED: 'danger',
  WITHDRAWN: 'neutral',
  TERMINATED: 'danger',
  CLOSED: 'neutral'
};

export function labelForEnrollmentStatus(status) {
  if (!status) return '—';
  return enrollmentStatusLabel[status] || String(status).replaceAll('_', ' ');
}
