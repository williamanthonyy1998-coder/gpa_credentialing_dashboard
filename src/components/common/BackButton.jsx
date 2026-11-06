import React from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { backLabelForPath, fullPath } from '../../navigation/navHistory';
import { useNavHistoryOptional } from '../../navigation/NavigationHistoryContext';
import { readListReturn } from '../../navigation/listReturn';

/**
 * Genuine previous-page Back control.
 * Journey stack → returnTo → listReturn → contextual parent.
 * Never defaults to Dashboard.
 */
export default function BackButton({
  label = 'Back',
  fallbackHref = null,
  listKey,
  className = 'back-btn',
  onBeforeNavigate,
  autoLabel = true,
  hints = {},
  hideIfNoTarget = false
}) {
  const location = useLocation();
  const history = useNavHistoryOptional();

  const stateReturn = location.state?.returnTo;
  const sessionReturn = listKey ? readListReturn(listKey) : null;
  const previous = history?.previous;
  const previousPath = previous ? fullPath(previous.pathname, previous.search) : null;

  const resolvedFallback = history?.resolveFallback
    ? history.resolveFallback(fallbackHref, hints)
    : (fallbackHref && fallbackHref !== '/' ? fallbackHref : null);

  const previewTarget = previousPath
    || (typeof stateReturn === 'string' && stateReturn.startsWith('/') ? stateReturn : null)
    || sessionReturn
    || resolvedFallback;

  const displayLabel = autoLabel
    ? backLabelForPath(previewTarget, label)
    : label;

  if (hideIfNoTarget && !previewTarget) {
    return null;
  }

  function go() {
    if (history?.goBack) {
      history.goBack({
        fallbackHref: fallbackHref && fallbackHref !== '/' ? fallbackHref : null,
        hints,
        listKey,
        onBeforeNavigate
      });
      return;
    }
    if (onBeforeNavigate && onBeforeNavigate() === false) return;
    if (previewTarget) {
      window.location.assign(previewTarget);
    }
  }

  return (
    <button type="button" className={className} onClick={go} aria-label={displayLabel}>
      <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
      <span>{displayLabel}</span>
    </button>
  );
}
