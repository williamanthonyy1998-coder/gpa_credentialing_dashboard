import React from 'react';
import { Link } from 'react-router-dom';

export default function StatCard({ label, value, icon: Icon, to, hint, tone = 'default' }) {
  const body = (
    <>
      {Icon && (
        <div className={`metric-icon tone-${tone}`}>
          <Icon size={19} />
        </div>
      )}
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
      {hint && <small>{hint}</small>}
    </>
  );
  if (to) {
    return <Link to={to} className="metric-card metric-card-link">{body}</Link>;
  }
  return <div className="metric-card">{body}</div>;
}
