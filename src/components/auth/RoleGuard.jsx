import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Defense-in-depth route guard. Backend authorization remains authoritative.
 * localStorage role is UX-only and must never be trusted for API access.
 */
function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('credentialing_user') || '{}');
  } catch {
    return {};
  }
}

function homeForRole(role) {
  if (role === 'EXTERNAL_PROVIDER') return '/provider-portal';
  if (role === 'CLIENT_USER') return '/portal';
  return '/';
}

export default function RoleGuard({ allow, deny, children, redirectTo }) {
  const user = useMemo(() => readStoredUser(), []);
  const role = user?.role;

  if (deny && deny.includes(role)) {
    return <Navigate to={redirectTo || homeForRole(role)} replace />;
  }
  if (allow && allow.length && !allow.includes(role)) {
    return <Navigate to={redirectTo || homeForRole(role)} replace />;
  }
  return children;
}

export const GPA_STAFF_ROLES = [
  'ADMIN',
  'CREDENTIALING_MANAGER',
  'CREDENTIALING_SPECIALIST',
  'ENROLLMENT_SPECIALIST',
  'APPROVER',
  'AUDITOR',
  'READ_ONLY'
];

export const GPA_OPS_ROLES = [
  'ADMIN',
  'CREDENTIALING_MANAGER',
  'CREDENTIALING_SPECIALIST',
  'ENROLLMENT_SPECIALIST',
  'APPROVER'
];

export const GPA_ADMIN_ROLES = ['ADMIN', 'CREDENTIALING_MANAGER'];
