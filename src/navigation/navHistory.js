/**
 * Pure helpers for in-app navigation history.
 * Persists in sessionStorage so refresh keeps the journey; never defaults to Dashboard.
 */

const STACK_KEY = 'eClinicAssist:navStack:v2';
const SCROLL_PREFIX = 'eClinicAssist:scroll:';
const MAX_STACK = 40;

export function fullPath(pathname, search = '') {
  const s = search || '';
  const q = !s ? '' : s.startsWith('?') ? s : `?${s}`;
  return `${pathname}${q}`;
}

/** Strip wizard-only params so Previous/Next steps don't pollute Back. */
export function logicalKey(pathname, search = '') {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (/^\/(practices|facilities)\/[^/]+\/profile/.test(pathname)) {
    params.delete('step');
  }
  // edit= is a deep-link opener, not a distinct page for Back
  params.delete('edit');
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function sameLogicalRoute(a, b) {
  if (!a || !b) return false;
  return logicalKey(a.pathname, a.search || '') === logicalKey(b.pathname, b.search || '');
}

export function parsePath(pathWithSearch) {
  if (!pathWithSearch || typeof pathWithSearch !== 'string') return null;
  if (!pathWithSearch.startsWith('/')) return null;
  const i = pathWithSearch.indexOf('?');
  if (i === -1) return { pathname: pathWithSearch, search: '' };
  return { pathname: pathWithSearch.slice(0, i), search: pathWithSearch.slice(i) };
}

export function readStack() {
  try {
    const raw = sessionStorage.getItem(STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(e => e?.pathname?.startsWith('/')) : [];
  } catch {
    return [];
  }
}

export function writeStack(stack) {
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-MAX_STACK)));
  } catch { /* ignore */ }
}

export function saveScroll(pathname, search, y) {
  try {
    sessionStorage.setItem(SCROLL_PREFIX + logicalKey(pathname, search), String(y || 0));
  } catch { /* ignore */ }
}

export function readScroll(pathname, search) {
  try {
    const v = sessionStorage.getItem(SCROLL_PREFIX + logicalKey(pathname, search));
    return v != null ? Number(v) : null;
  } catch {
    return null;
  }
}

/**
 * Contextual parent when there is no in-app previous page (bookmark / refresh).
 * Returns null when there is no sensible parent (e.g. top-level listing).
 * NEVER returns '/' (Dashboard) as a universal fallback.
 */
export function contextualParent(pathname, hints = {}) {
  if (!pathname || pathname === '/') return null;

  const cred = pathname.match(/^\/facilities\/([^/]+)\/credentials\/?$/);
  if (cred) return `/facilities/${cred[1]}/profile`;

  const facNew = pathname.match(/^\/facilities\/new\/profile/);
  if (facNew) return '/facilities';

  const fac = pathname.match(/^\/facilities\/([^/]+)\/profile/);
  if (fac) {
    if (hints.practiceId) return `/practices/${hints.practiceId}/profile`;
    return '/facilities';
  }

  const pracNew = pathname.match(/^\/practices\/new\/profile/);
  if (pracNew) return '/practices';

  const prac = pathname.match(/^\/practices\/([^/]+)\/profile/);
  if (prac) {
    // Only use org parent when entry context says so (not merely because practice has an org)
    if (hints.organizationId) return `/organizations/${hints.organizationId}/practices`;
    return '/practices';
  }

  const org = pathname.match(/^\/organizations\/([^/]+)/);
  if (org) return '/organizations';

  // Top-level module listings: no parent (hide Back or stay) — not Dashboard
  const listings = [
    '/organizations', '/practices', '/facilities', '/providers', '/payers',
    '/enrollments', '/cases', '/documents', '/credentials', '/employees',
    '/tasks', '/audit', '/plans', '/licenses'
  ];
  if (listings.includes(pathname)) return null;

  return null;
}

export function backLabelForPath(path, fallback = 'Back') {
  if (!path || typeof path !== 'string') return fallback;
  const p = path.split('?')[0];
  if (/\/organizations\/[^/]+/.test(p)) return 'Back to Organization';
  if (p.startsWith('/practices/') && p.includes('/profile')) return 'Back to Practice';
  if (p.startsWith('/facilities/') && p.includes('/credentials')) return 'Back to Facility Credentials';
  if (p.startsWith('/facilities/') && p.includes('/profile')) return 'Back to Facility';
  if (p === '/organizations') return 'Back to Organizations';
  if (p === '/practices') return 'Back to Practices';
  if (p === '/facilities') return 'Back to Facilities';
  if (p === '/providers') return 'Back to Providers';
  if (p === '/enrollments') return 'Back to Enrollment List';
  if (p === '/payers') return 'Back to Payers';
  if (p === '/credentials') return 'Back to Credentials';
  if (p === '/tasks') return 'Back to Tasks';
  if (p === '/employees') return 'Back to Employees';
  if (p === '/documents') return 'Back to Documents';
  if (p === '/cases') return 'Back to Cases';
  if (p === '/audit') return 'Back to Audit Log';
  if (p === '/' || p === '') return 'Back to Dashboard';
  return fallback;
}
