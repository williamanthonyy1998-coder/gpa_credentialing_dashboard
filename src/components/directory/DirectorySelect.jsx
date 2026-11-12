import React from 'react';
import { useMergedDirectoryOptions } from '../../hooks/useDirectoryOptions';

/**
 * Shared searchable-ish select for master directories.
 * Keeps inactive selected values visible on edit without allowing new inactive picks.
 */
export default function DirectorySelect({
  resource,
  value,
  onChange,
  selectedOption,
  fallbackLabel,
  status = 'ACTIVE',
  params,
  source = 'directories',
  valueField = 'id',
  placeholder = 'Select…',
  disabled = false,
  required = false,
  allowEmpty = true,
  emptyLabel = '—',
  className,
  id,
  name,
  'aria-label': ariaLabel
}) {
  const selected = selectedOption || (value
    ? { id: value, value, label: fallbackLabel || value }
    : null);
  const { options, loading, error } = useMergedDirectoryOptions(resource, selected, {
    status,
    params,
    source,
    valueField,
    fallbackLabel,
    enabled: Boolean(resource) && !disabled
  });

  return (
    <span className={className} style={{ display: 'contents' }}>
      <select
        id={id}
        name={name}
        aria-label={ariaLabel}
        required={required}
        disabled={disabled || loading}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value || null, options.find((o) => o.value === e.target.value))}
      >
        {allowEmpty ? <option value="">{loading ? 'Loading…' : emptyLabel || placeholder}</option> : null}
        {!loading && !options.length ? (
          <option value="" disabled>{error || 'No options available'}</option>
        ) : null}
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
            disabled={o.__historical || (o.status && o.status !== 'ACTIVE' && o.value !== value)}
          >
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="muted" style={{ fontSize: 11 }}>{error}</span> : null}
    </span>
  );
}
