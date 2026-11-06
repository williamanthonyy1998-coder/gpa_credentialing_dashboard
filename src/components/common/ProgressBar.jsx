import React from 'react';

export default function ProgressBar({ value = 0, label, showPercent = true }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-block">
      {(label || showPercent) && (
        <div className="progress-meta">
          {label && <span>{label}</span>}
          {showPercent && <b>{Math.round(pct)}%</b>}
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
