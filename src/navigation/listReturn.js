const PREFIX = 'eClinicAssist:listReturn:';

export function saveListReturn(listKey, pathWithSearch) {
  if (!listKey || !pathWithSearch) return;
  try {
    sessionStorage.setItem(PREFIX + listKey, pathWithSearch);
  } catch { /* ignore quota */ }
}

export function readListReturn(listKey) {
  if (!listKey) return null;
  try {
    return sessionStorage.getItem(PREFIX + listKey);
  } catch {
    return null;
  }
}

export function clearListReturn(listKey) {
  if (!listKey) return;
  try {
    sessionStorage.removeItem(PREFIX + listKey);
  } catch { /* ignore */ }
}

/** Build a return path for the current list page (pathname + search). */
export function currentListPath(pathname, search = '') {
  const q = search && !search.startsWith('?') ? `?${search}` : search;
  return `${pathname}${q || ''}`;
}

export const LIST_KEYS = {
  organizations: 'organizations',
  practices: 'practices',
  facilities: 'facilities',
  providers: 'providers',
  payers: 'payers',
  enrollments: 'enrollments',
  cases: 'cases',
  credentials: 'credentials',
  documents: 'documents',
  employees: 'employees',
  tasks: 'tasks',
  audit: 'audit'
};

export { backLabelForPath } from './navHistory';
