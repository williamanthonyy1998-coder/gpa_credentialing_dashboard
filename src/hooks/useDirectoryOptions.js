import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

/** Tenant-scoped in-memory cache to avoid duplicate directory fetches. */
const cache = new Map();

function cacheKey(resource, tenantId, status, extra) {
  return `${tenantId || 'none'}::${resource}::${status || 'ALL'}::${extra || ''}`;
}

function currentTenantId() {
  try {
    return localStorage.getItem('credentialing_tenant_id') || '';
  } catch {
    return '';
  }
}

function labelFor(row, resource) {
  if (!row) return '';
  if (resource === 'usStates') {
    return row.abbreviation ? `${row.abbreviation} — ${row.name}` : row.name;
  }
  if (resource === 'credentialCategories') return row.name || row.label || row.code;
  if (resource === 'licenseTypes') return row.name || row.code;
  if (resource === 'payerPlans' || resource === 'plans') {
    return row.planType ? `${row.name} (${row.planType})` : row.name;
  }
  return row.name || row.legalName || row.label || row.code || row.id;
}

/**
 * Load directory/reference options with tenant-scoped caching.
 * @param {string|null} resource - directories resource key, or 'payers'/'plans' for /api resources
 * @param {{ status?: string, enabled?: boolean, params?: object, source?: 'directories'|'resources' }} opts
 */
export function useDirectoryOptions(resource, opts = {}) {
  const {
    status = 'ACTIVE',
    enabled = true,
    params = {},
    source = 'directories',
    valueField = 'id'
  } = opts;
  const tenantId = currentTenantId();
  const paramsKey = JSON.stringify(params || {});
  const extra = `${paramsKey}::${valueField}`;
  const key = cacheKey(resource, tenantId, status, `${source}:${extra}`);
  const [options, setOptions] = useState(() => cache.get(key)?.data || []);
  const [loading, setLoading] = useState(Boolean(enabled && resource && !cache.get(key)));
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    if (!enabled || !resource) {
      setOptions([]);
      setLoading(false);
      return;
    }
    const hit = cache.get(key);
    if (!force && hit) {
      setOptions(hit.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const parsedParams = JSON.parse(paramsKey || '{}');
      const path = source === 'resources' ? `/${resource}` : `/directories/${resource}`;
      const r = await api.get(path, {
        params: {
          limit: 200,
          ...(status ? { status } : {}),
          ...parsedParams
        }
      });
      const raw = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
      const data = raw.map((row) => {
        const value = row[valueField] || row.id || row.key || row.code;
        return {
          ...row,
          value,
          label: labelFor(row, resource)
        };
      });
      cache.set(key, { data, at: Date.now() });
      setOptions(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load options');
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, resource, key, status, paramsKey, source, valueField]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onTenantChange() {
      cache.clear();
      load(true);
    }
    window.addEventListener('credentialing:tenant-changed', onTenantChange);
    return () => window.removeEventListener('credentialing:tenant-changed', onTenantChange);
  }, [load]);

  return { options, loading, error, reload: () => load(true) };
}

export function clearDirectoryOptionsCache() {
  cache.clear();
}

/**
 * Merge a historical (possibly inactive) selected option into the active list for edit forms.
 */
export function withSelectedOption(options, selected, fallbackLabel) {
  if (!selected) return options;
  const id = typeof selected === 'object' ? (selected.id || selected.value) : selected;
  if (!id) return options;
  if (options.some((o) => o.value === id || o.id === id)) return options;
  const label = typeof selected === 'object'
    ? (selected.label || selected.name || fallbackLabel || id)
    : (fallbackLabel || id);
  return [
    { id, value: id, label: `${label} (inactive)`, status: 'INACTIVE', __historical: true },
    ...options
  ];
}

export function useMergedDirectoryOptions(resource, selected, opts = {}) {
  const { options, loading, error, reload } = useDirectoryOptions(resource, opts);
  const merged = useMemo(
    () => withSelectedOption(options, selected, opts.fallbackLabel),
    [options, selected, opts.fallbackLabel]
  );
  return { options: merged, loading, error, reload };
}

/** For address JSON fields that store USPS abbreviations rather than UsState IDs. */
export function useUsStateAbbrevOptions(opts = {}) {
  return useDirectoryOptions('usStates', { ...opts, valueField: 'abbreviation' });
}
