// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/SessionProvider.jsx';

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="empty"><div className="spin" style={{margin:'0 auto 12px'}}/><p className="empty-h">Loading…</p></div>;
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace/>;
  }
  return children;
}
