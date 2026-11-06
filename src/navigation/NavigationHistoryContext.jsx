import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  contextualParent,
  fullPath,
  logicalKey,
  parsePath,
  readScroll,
  readStack,
  sameLogicalRoute,
  saveScroll,
  writeStack
} from './navHistory';
import { readListReturn } from './listReturn';

const NavigationHistoryContext = createContext(null);

function entryFromLocation(location, extra = {}) {
  return {
    pathname: location.pathname,
    search: location.search || '',
    key: location.key,
    organizationId: extra.organizationId || location.state?.organizationId || null,
    practiceId: extra.practiceId || location.state?.practiceId || null,
    facilityId: extra.facilityId || location.state?.facilityId || null,
    providerId: extra.providerId || location.state?.providerId || null,
    at: Date.now()
  };
}

export function NavigationHistoryProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const stackRef = useRef(readStack());
  const skippingRef = useRef(false);
  const lastTrackedKey = useRef('');

  // Track every in-app route as the user journey (wizard step-only changes replace).
  useEffect(() => {
    if (location.pathname === '/login') return;

    const entry = entryFromLocation(location);
    const trackId = `${location.key}|${logicalKey(entry.pathname, entry.search)}`;

    if (skippingRef.current) {
      skippingRef.current = false;
      lastTrackedKey.current = trackId;
      // Ensure current page is top of stack after a programmatic back
      const stack = stackRef.current;
      const top = stack[stack.length - 1];
      if (!top || !sameLogicalRoute(top, entry)) {
        stackRef.current = [...stack, entry].slice(-40);
        writeStack(stackRef.current);
      } else {
        stackRef.current = [...stack.slice(0, -1), { ...top, ...entry }];
        writeStack(stackRef.current);
      }
      return;
    }

    if (lastTrackedKey.current === trackId) return;
    lastTrackedKey.current = trackId;

    let stack = [...stackRef.current];
    const top = stack[stack.length - 1];

    // Hard load / refresh (RR key "default"): re-anchor stack to this page to avoid stale jumps
    if (location.key === 'default') {
      const idx = stack.map((e, i) => (sameLogicalRoute(e, entry) ? i : -1)).filter(i => i >= 0).pop();
      if (idx != null && idx >= 0) {
        stack = stack.slice(0, idx);
        stack.push({ ...entry });
      } else if (top && sameLogicalRoute(top, entry)) {
        stack[stack.length - 1] = { ...top, ...entry };
      } else {
        // Direct URL — start clean; Back will use contextual parent
        stack = [{ ...entry }];
      }
      stackRef.current = stack.slice(-40);
      writeStack(stackRef.current);
      return;
    }

    if (top && sameLogicalRoute(top, entry)) {
      // Same logical page (e.g. wizard step) — replace top, keep journey parent
      stack[stack.length - 1] = { ...top, ...entry, search: entry.search };
      stackRef.current = stack;
      writeStack(stack);
      return;
    }

    // Browser Back landed on previous entry already in stack — truncate forward branch
    const existingIdx = stack.map((e, i) => (sameLogicalRoute(e, entry) ? i : -1)).filter(i => i >= 0).pop();
    if (existingIdx != null && existingIdx >= 0) {
      stack = stack.slice(0, existingIdx);
      stack.push({ ...entry });
      stackRef.current = stack.slice(-40);
      writeStack(stackRef.current);
      return;
    }

    stack.push(entry);
    stackRef.current = stack.slice(-40);
    writeStack(stackRef.current);
  }, [location.pathname, location.search, location.key]);

  // Persist scroll before leaving
  useEffect(() => {
    const onHide = () => {
      saveScroll(location.pathname, location.search, window.scrollY);
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      onHide();
      window.removeEventListener('pagehide', onHide);
    };
  }, [location.pathname, location.search]);

  const peekPrevious = useCallback(() => {
    const stack = stackRef.current;
    const current = entryFromLocation(location);
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const e = stack[i];
      if (!sameLogicalRoute(e, current)) return e;
    }
    return null;
  }, [location]);

  const canGoBack = useMemo(() => !!peekPrevious(), [peekPrevious, location.pathname, location.search]);

  const resolveFallback = useCallback((fallbackHref, hints = {}) => {
    if (fallbackHref && fallbackHref !== '/') {
      const parsed = parsePath(fallbackHref);
      if (parsed && !sameLogicalRoute(parsed, location)) return fullPath(parsed.pathname, parsed.search);
    }
    const parent = contextualParent(location.pathname, {
      organizationId: hints.organizationId || location.state?.organizationId,
      practiceId: hints.practiceId || location.state?.practiceId,
      facilityId: hints.facilityId || location.state?.facilityId
    });
    return parent;
  }, [location]);

  const goBack = useCallback((options = {}) => {
    const {
      fallbackHref,
      hints = {},
      listKey,
      onBeforeNavigate
    } = options;

    if (onBeforeNavigate && onBeforeNavigate() === false) return false;

    saveScroll(location.pathname, location.search, window.scrollY);

    const current = entryFromLocation(location);
    const currentFull = fullPath(location.pathname, location.search);
    let stack = [...stackRef.current];

    // Drop current logical page(s) from the tip
    while (stack.length && sameLogicalRoute(stack[stack.length - 1], current)) {
      stack.pop();
    }

    const candidates = [];

    // 1) In-app journey previous page (genuine Back)
    if (stack.length) {
      const prev = stack[stack.length - 1];
      candidates.push(fullPath(prev.pathname, prev.search));
    }

    // 2) Explicit returnTo from the navigation that opened this page
    const stateReturn = location.state?.returnTo;
    if (typeof stateReturn === 'string' && stateReturn.startsWith('/') && stateReturn !== '/') {
      candidates.push(stateReturn);
    }

    // 3) Caller fallback / contextual parent (e.g. Facility → Practice) — before generic list
    const parent = resolveFallback(fallbackHref, hints);
    if (parent && parent !== '/') candidates.push(parent);

    // 4) Saved list filters / search for this module
    if (listKey) {
      const listPath = readListReturn(listKey);
      if (listPath && listPath !== '/') candidates.push(listPath);
    }

    let target = candidates.find((c) => {
      const parsed = parsePath(c);
      return parsed && !sameLogicalRoute(parsed, current) && c !== currentFull;
    }) || null;

    if (!target) {
      stackRef.current = stack;
      writeStack(stack);
      return false;
    }

    stackRef.current = stack;
    writeStack(stack);
    skippingRef.current = true;

    const targetParsed = parsePath(target);
    const scrollY = targetParsed ? readScroll(targetParsed.pathname, targetParsed.search) : null;
    navigate(target, { state: { restoredFromBack: true } });

    if (scrollY != null && !Number.isNaN(scrollY)) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    }
    return true;
  }, [location, navigate, resolveFallback]);

  const pushIntent = useCallback((to, state = {}) => {
    // Soft helper for callers that navigate with context ids
    navigate(to, {
      state: {
        ...state,
        returnTo: state.returnTo || fullPath(location.pathname, location.search)
      }
    });
  }, [navigate, location]);

  const value = useMemo(() => ({
    canGoBack,
    previous: peekPrevious(),
    goBack,
    pushIntent,
    resolveFallback,
    currentPath: fullPath(location.pathname, location.search)
  }), [canGoBack, peekPrevious, goBack, pushIntent, resolveFallback, location]);

  return (
    <NavigationHistoryContext.Provider value={value}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavHistory() {
  const ctx = useContext(NavigationHistoryContext);
  if (!ctx) {
    throw new Error('useNavHistory must be used within NavigationHistoryProvider');
  }
  return ctx;
}

/** Safe hook when provider may be absent (e.g. login). */
export function useNavHistoryOptional() {
  return useContext(NavigationHistoryContext);
}
