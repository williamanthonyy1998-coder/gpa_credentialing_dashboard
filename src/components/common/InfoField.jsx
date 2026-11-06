import React from 'react';

export default function InfoField({ label, value, children, className = '' }) {
  return (
    <div className={`info-field ${className}`}>
      <span className="info-label">{label}</span>
      <div className="info-value">{children ?? (value || value === 0 ? value : '—')}</div>
    </div>
  );
}
