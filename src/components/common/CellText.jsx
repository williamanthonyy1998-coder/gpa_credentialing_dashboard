import React from 'react';

/**
 * Truncates overflowing cell text and exposes the full value via title/tooltip.
 * Use inside table cells so long names never widen the table.
 */
export default function CellText({
  children,
  title,
  className = '',
  as: Tag = 'span',
  strong = false,
  multiline = false
}) {
  const text = children == null || children === '' ? '—' : children;
  const tip = title != null ? title : (typeof text === 'string' || typeof text === 'number' ? String(text) : undefined);
  const classes = [
    multiline ? 'cell-wrap' : 'cell-clip',
    strong ? 'cell-strong' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <Tag className={classes} title={tip && tip !== '—' ? tip : undefined}>
      {text}
    </Tag>
  );
}
