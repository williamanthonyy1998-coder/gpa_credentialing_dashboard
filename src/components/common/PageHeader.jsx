import React from 'react';
import AppBreadcrumbs from './AppBreadcrumbs';
import BackButton from './BackButton';

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  back
}) {
  return (
    <div className="page-heading">
      <div>
        {back && (
          <BackButton
            label={back.label || 'Back'}
            fallbackHref={back.fallbackHref && back.fallbackHref !== '/' ? back.fallbackHref : null}
            listKey={back.listKey}
            autoLabel={back.autoLabel !== false}
            hints={back.hints}
            hideIfNoTarget={back.hideIfNoTarget}
            className="back-btn page-back"
            onBeforeNavigate={back.onBeforeNavigate}
          />
        )}
        {breadcrumbs?.length > 0 && <AppBreadcrumbs crumbs={breadcrumbs} />}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </div>
  );
}
