export function fmt(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return '';
  if (String(value).includes('T') && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleDateString();
  }
  return String(value).replaceAll('_', ' ');
}

export function nested(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

export function roleLabel(role) {
  return String(role || '').replaceAll('_', ' ');
}

export function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
