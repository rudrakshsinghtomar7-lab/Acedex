import { createContext, useContext } from 'react';
import { supabase } from '../lib/supabase.js';

const SessionContext = createContext(null);

const stubValue = {
  session: null,
  profile: null,
  role: 'student',
  loading: false,
  signIn: async () => {},
  signOut: async () => {},
  signUp: async () => {},
  requestPasswordReset: async () => {},
  supabase,
};

export function SessionProvider({children}) {
  return <SessionContext.Provider value={stubValue}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
