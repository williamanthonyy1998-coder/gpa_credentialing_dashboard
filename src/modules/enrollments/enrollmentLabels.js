/** Prisma EnrollmentStatus → human-readable labels */
export const ENROLLMENT_STATUS_ORDER = [
  'NOT_STARTED',
  'PREPARING',
  'READY_TO_SUBMIT',
  'SUBMITTED',
  'PAYER_REVIEW',
  'ADDITIONAL_INFORMATION_NEEDED',
  'APPROVED',
  'DENIED',
  'WITHDRAWN'
];

export const enrollmentStatusLabel = {
  NOT_STARTED: 'Not started',
  PREPARING: 'Preparing',
  READY_TO_SUBMIT: 'Ready to submit',
  SUBMITTED: 'Submitted',
  PAYER_REVIEW: 'Payer review',
  ADDITIONAL_INFORMATION_NEEDED: 'Additional info needed',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  WITHDRAWN: 'Withdrawn'
};

export function labelForEnrollmentStatus(status) {
  if (!status) return '—';
  return enrollmentStatusLabel[status] || String(status).replaceAll('_', ' ');
}
