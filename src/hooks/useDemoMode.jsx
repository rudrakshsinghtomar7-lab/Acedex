import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'acedex.demoMode';
const DEV = import.meta.env.DEV;

// Static ternary so Vite resolves at build time: in prod, loadDemo is a function
// that returns Promise.resolve(null) and the demo.js import literal never appears
// in the bundle. In dev, this is a dynamic import that Vite code-splits into a
// separate chunk loaded only when demoMode is on.
const loadDemo = DEV
  ? () => import('../data/demo.js')
  : () => Promise.resolve(null);

const DemoModeContext = createContext({
  demoMode: false,
  setDemoMode: () => {},
  demoData: null,
});

export function DemoModeProvider({ children }) {
  const [demoMode, setState] = useState(false);
  const [demoData, setDemoData] = useState(null);

  useEffect(() => {
    if (!DEV) return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') setState(true);
  }, []);

  useEffect(() => {
    if (!demoMode) {
      setDemoData(null);
      return;
    }
    let cancelled = false;
    loadDemo().then(m => {
      if (!cancelled && m) setDemoData(m);
    });
    return () => { cancelled = true; };
  }, [demoMode]);

  // Hard prod guarantee: in non-dev builds, setDemoMode is a no-op. Even with
  // a tampered localStorage entry, the read in the first effect is gated by
  // DEV and never fires.
  const setDemoMode = (value) => {
    if (!DEV) return;
    const v = !!value;
    setState(v);
    if (v) localStorage.setItem(STORAGE_KEY, 'true');
    else localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <DemoModeContext.Provider value={{ demoMode, setDemoMode, demoData }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}

export const DEMO_MODE_AVAILABLE = DEV;
