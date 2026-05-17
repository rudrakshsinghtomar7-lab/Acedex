import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'acedex.demoMode';
const DEV = import.meta.env.DEV;

const DemoModeContext = createContext([false, () => {}]);

export function DemoModeProvider({ children }) {
  const [demoMode, setState] = useState(false);

  useEffect(() => {
    if (!DEV) return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') setState(true);
  }, []);

  // Hard prod guarantee: in non-dev builds, setDemoMode is a no-op and the
  // initial state is always false. Even with a tampered localStorage entry,
  // the effect above doesn't read it in prod.
  const setDemoMode = (value) => {
    if (!DEV) return;
    const v = !!value;
    setState(v);
    if (v) localStorage.setItem(STORAGE_KEY, 'true');
    else localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <DemoModeContext.Provider value={[demoMode, setDemoMode]}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}

export const DEMO_MODE_AVAILABLE = DEV;
