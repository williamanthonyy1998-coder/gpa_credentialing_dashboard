import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={28} />}
      {title && <b>{title}</b>}
      {description && <span>{description}</span>}
      {action}
    </div>
  );
}
