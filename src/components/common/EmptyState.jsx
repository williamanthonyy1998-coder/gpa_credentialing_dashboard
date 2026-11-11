import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty" role="status">
      {Icon && <Icon size={28} aria-hidden="true" />}
      {title && <b>{title}</b>}
      {description && <span>{description}</span>}
      {action}
    </div>
  );
}
