import { useState, useEffect } from 'react';

const STORAGE_KEY = 'Acedex_api_key';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setApiKeyState(saved);
  }, []);

  const setApiKey = (value) => {
    const v = value || '';
    setApiKeyState(v);
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
  };

  return [apiKey, setApiKey];
}
