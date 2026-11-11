import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Ellipsis } from 'lucide-react';

const TONE_CLASS = {
  view: 'icon-btn--view',
  open: 'icon-btn--view',
  edit: 'icon-btn--edit',
  delete: 'icon-btn--delete',
  activate: 'icon-btn--activate',
  deactivate: 'icon-btn--deactivate',
  download: 'icon-btn--download',
  upload: 'icon-btn--upload',
  history: 'icon-btn--history',
  approve: 'icon-btn--approve',
  reject: 'icon-btn--reject',
  alert: 'icon-btn--alert',
  neutral: 'icon-btn--neutral',
  default: 'icon-btn--neutral'
};

/**
 * Professional icon-only action control for table Actions columns.
 * Always provide `label` for tooltip + aria-label.
 */
const IconButton = forwardRef(function IconButton(
  {
    icon: Icon,
    label,
    tone = 'neutral',
    onClick,
    disabled = false,
    loading = false,
    active = false,
    badge,
    className = '',
    as = 'button',
    children,
    type = 'button',
    size = 17,
    ...rest
  },
  ref
) {
  const toneClass = TONE_CLASS[tone] || TONE_CLASS.neutral;
  const isDisabled = disabled || loading;
  const classes = [
    'icon-btn',
    toneClass,
    active ? 'is-active' : '',
    isDisabled ? 'is-disabled' : '',
    as === 'label' ? 'icon-btn--label' : '',
    className
  ].filter(Boolean).join(' ');

  const shared = {
    ref,
    className: classes,
    title: label,
    'aria-label': label,
    'data-tooltip': label,
    ...rest
  };

  if (as === 'label') {
    return (
      <label
        {...shared}
        aria-disabled={isDisabled || undefined}
        onClick={isDisabled ? (e) => e.preventDefault() : onClick}
      >
        {Icon ? <Icon size={size} strokeWidth={2} aria-hidden="true" /> : null}
        {badge != null && badge !== false && Number(badge) > 0 ? (
          <span className="icon-btn-badge" aria-hidden="true">{Number(badge) > 99 ? '99+' : badge}</span>
        ) : null}
        {children}
      </label>
    );
  }

  return (
    <button
      {...shared}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-pressed={active || undefined}
      onClick={onClick}
    >
      {Icon ? <Icon size={size} strokeWidth={2} aria-hidden="true" /> : null}
      {badge != null && badge !== false && Number(badge) > 0 ? (
        <span className="icon-btn-badge" aria-hidden="true">{Number(badge) > 99 ? '99+' : badge}</span>
      ) : null}
      {children}
    </button>
  );
});

export default IconButton;

/**
 * Overflow menu for less-frequent row actions (icon + text items).
 */
export function MoreActions({ label = 'More actions', items = [], disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = (items || []).filter(Boolean);
  if (!visible.length) return null;

  return (
    <div className={`more-actions${open ? ' is-open' : ''}`} ref={rootRef}>
      <IconButton
        icon={Ellipsis}
        label={label}
        tone="neutral"
        disabled={disabled}
        active={open}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(v => !v)}
      />
      {open ? (
        <div className="more-actions-menu" id={menuId} role="menu">
          {visible.map((item) => {
            const ItemIcon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`more-actions-item${item.tone ? ` more-actions-item--${item.tone}` : ''}`}
                disabled={item.disabled || disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {ItemIcon ? <ItemIcon size={15} strokeWidth={2} aria-hidden="true" /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Horizontal Actions column layout wrapper */
export function RowActions({ children, className = '' }) {
  return <div className={`row-actions ${className}`.trim()}>{children}</div>;
}
