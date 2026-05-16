import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, university_id, role, email, full_name, avatar_url, bio, onboarded_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return;
      setSession(s);
      if (!s) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        let p = await fetchProfile(userId);
        if (cancelled) return;
        if (!p) {
          // Trigger may not have committed yet for a brand-new signup. Retry once.
          await new Promise(r => setTimeout(r, 500));
          if (cancelled) return;
          p = await fetchProfile(userId);
        }
        if (cancelled) return;
        if (!p) {
          console.error('Profile row missing for authenticated user; signing out.');
          await supabase.auth.signOut();
          return;
        }
        setProfile(p);
      } catch (e) {
        if (cancelled) return;
        console.error('Profile fetch failed:', e);
        await supabase.auth.signOut();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const value = useMemo(() => ({
    supabase,
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, meta = {}) =>
      supabase.auth.signUp({ email, password, options: { data: meta } }),
    signOut: () => supabase.auth.signOut(),
    requestPasswordReset: (email, redirectTo) =>
      supabase.auth.resetPasswordForEmail(email, { redirectTo }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
  }), [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <SessionProvider>');
  return ctx;
}
