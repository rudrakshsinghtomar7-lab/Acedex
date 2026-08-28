// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/SessionProvider.jsx';
import Loading from './Loading.jsx';

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  // `loading` spans the auth check plus the profile fetch. getSession() is local
  // and returns immediately; the profile query is the one that can stall when
  // the Supabase project is paused and restoring — which is the wait this
  // screen exists for.
  if (loading) return <Loading />;
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace/>;
  }
  return children;
}
