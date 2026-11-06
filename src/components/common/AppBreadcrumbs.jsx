import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * @param {{ crumbs: Array<{ label: string, to?: string }> }} props
 */
export default function AppBreadcrumbs({ crumbs = [] }) {
  if (!crumbs.length) return null;
  return (
    <nav className="app-breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <React.Fragment key={`${c.label}-${i}`}>
          {i > 0 && <ChevronRight size={12} className="crumb-sep" aria-hidden />}
          {c.to && i < crumbs.length - 1 ? (
            <Link to={c.to}>{c.label}</Link>
          ) : (
            <span className={i === crumbs.length - 1 ? 'crumb-current' : ''}>{c.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
