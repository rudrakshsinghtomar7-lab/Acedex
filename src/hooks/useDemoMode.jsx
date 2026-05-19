import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../providers/SessionProvider.jsx';

const STORAGE_KEY = 'acedex.demoMode';

// Demo mode is gated on profile.role === 'admin' at the live-DB level. The
// dynamic import below is code-split by Vite — the demo chunk only loads
// after demoMode flips true, which itself only happens for admins, so a
// non-admin's bundle never pulls the demo data even though the import isn't
// statically dead.
const loadDemo = () => import('../data/demo.js');

const DemoModeContext = createContext({
  demoMode: false,
  setDemoMode: () => {},
  demoData: null,
  available: false,
});

export function DemoModeProvider({ children }) {
  const { role } = useAuth() ?? {};
  const isAdmin = role === 'admin';
  const [demoMode, setState] = useState(false);
  const [demoData, setDemoData] = useState(null);

  // Honor the saved preference, but only for admins. If the user isn't admin
  // (logged-out, regular user, or stale role) wipe any tampered "true" flag
  // so it can't auto-enable later when they switch accounts.
  useEffect(() => {
    if (!isAdmin) {
      setState(false);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') setState(true);
    } catch { /* ignore */ }
  }, [isAdmin]);

  useEffect(() => {
    if (!demoMode) { setDemoData(null); return; }
    let cancelled = false;
    loadDemo().then(m => {
      if (!cancelled && m) setDemoData(m);
    });
    return () => { cancelled = true; };
  }, [demoMode]);

  // setDemoMode is a hard no-op for non-admins. The UI hides the toggle too,
  // but enforcing in the hook is the load-bearing security check — a non-
  // admin who manually flips localStorage or evaluates a setter in DevTools
  // still gets nothing.
  const setDemoMode = (value) => {
    if (!isAdmin) return;
    const v = !!value;
    setState(v);
    try {
      if (v) localStorage.setItem(STORAGE_KEY, 'true');
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  };

  return (
    <DemoModeContext.Provider value={{ demoMode, setDemoMode, demoData, available: isAdmin }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}

// Legacy export kept for any callers that still import it; resolves to false
// at module load because the admin check runs per-user. Prefer the context
// value `available` from useDemoMode().
export const DEMO_MODE_AVAILABLE = false;
