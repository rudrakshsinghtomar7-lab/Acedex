// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'acedex-theme';
const MODES = ['system', 'light', 'dark'];
const mq = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : { matches: false, addEventListener() {}, removeEventListener() {} };

function resolveTheme(mode) {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return mq.matches ? 'dark' : 'light';
}

function applyTheme(resolved) {
  document.documentElement.setAttribute('data-theme', resolved);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'light' ? '#F7F5F2' : '#0a0b10');
}

const ThemeContext = createContext({ mode: 'light', theme: 'light', cycle: () => {} });

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(stored) ? stored : 'light';
  });

  const [systemDark, setSystemDark] = useState(mq.matches);

  useEffect(() => {
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const cycle = () => setMode(m => MODES[(MODES.indexOf(m) + 1) % MODES.length]);

  const value = useMemo(() => ({ mode, theme: resolved, cycle }), [mode, resolved]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
