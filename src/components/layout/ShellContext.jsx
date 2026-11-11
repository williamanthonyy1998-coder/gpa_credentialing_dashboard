import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ShellContext = createContext(null);

const SECONDARY_SIDEBAR_COLLAPSED_KEY = 'credentialing_secondary_sidebar_collapsed';

function readSecondarySidebarCollapsed() {
  try {
    return localStorage.getItem(SECONDARY_SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistSecondarySidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(SECONDARY_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

export function ShellProvider({ children }) {
  const [contextualNav, setContextualNavState] = useState(null);
  const [hideTopbar, setHideTopbar] = useState(false);
  const [secondarySidebarCollapsed, setSecondarySidebarCollapsedState] = useState(readSecondarySidebarCollapsed);

  const setContextualNav = useCallback((node) => {
    setContextualNavState(node);
  }, []);

  const clearContextualNav = useCallback(() => {
    setContextualNavState(null);
    setHideTopbar(false);
  }, []);

  const setSecondarySidebarCollapsed = useCallback((next) => {
    setSecondarySidebarCollapsedState((prev) => {
      const value = Boolean(typeof next === 'function' ? next(prev) : next);
      persistSecondarySidebarCollapsed(value);
      return value;
    });
  }, []);

  const toggleSecondarySidebar = useCallback(() => {
    setSecondarySidebarCollapsed((prev) => !prev);
  }, [setSecondarySidebarCollapsed]);

  const value = useMemo(() => ({
    contextualNav,
    setContextualNav,
    clearContextualNav,
    hideTopbar,
    setHideTopbar,
    secondarySidebarCollapsed,
    setSecondarySidebarCollapsed,
    toggleSecondarySidebar
  }), [
    contextualNav,
    setContextualNav,
    clearContextualNav,
    hideTopbar,
    secondarySidebarCollapsed,
    setSecondarySidebarCollapsed,
    toggleSecondarySidebar
  ]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
