import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ShellContext = createContext(null);

export function ShellProvider({ children }) {
  const [contextualNav, setContextualNavState] = useState(null);
  const [hideTopbar, setHideTopbar] = useState(false);

  const setContextualNav = useCallback((node) => {
    setContextualNavState(node);
  }, []);

  const clearContextualNav = useCallback(() => {
    setContextualNavState(null);
    setHideTopbar(false);
  }, []);

  const value = useMemo(() => ({
    contextualNav,
    setContextualNav,
    clearContextualNav,
    hideTopbar,
    setHideTopbar
  }), [contextualNav, setContextualNav, clearContextualNav, hideTopbar]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
