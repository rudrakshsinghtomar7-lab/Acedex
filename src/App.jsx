// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { PROJECTS } from './data/projects.js';
import PhoneFrame from './components/PhoneFrame.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import NotificationsPanel from './components/NotificationsPanel.jsx';
import BottomNav from './components/BottomNav.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useApiKey } from './hooks/useApiKey.js';
import { getUnreadCount } from './lib/notifications.js';
import Home from './screens/Home.jsx';
import Projects from './screens/Projects.jsx';
import AIScreen from './screens/AIScreen.jsx';
import Profile from './screens/Profile.jsx';
import ProfileEdit from './screens/ProfileEdit.jsx';
import ProfileView from './screens/ProfileView.jsx';
import ProjectCreate from './screens/ProjectCreate.jsx';
import ProjectDetail from './screens/ProjectDetail/index.jsx';
import Login from './screens/auth/Login.jsx';
import Signup from './screens/auth/Signup.jsx';
import Reset from './screens/auth/Reset.jsx';
import UpdatePassword from './screens/auth/UpdatePassword.jsx';
import Privacy from './screens/legal/Privacy.jsx';
import Terms from './screens/legal/Terms.jsx';
import { SessionProvider, useAuth } from './providers/SessionProvider.jsx';
import { DemoModeProvider } from './hooks/useDemoMode.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';

function ScreenLayout() {
  return <div className="screen"><Outlet/></div>;
}

function BottomNavLayout({role, insightBadgeCount}) {
  return (
    <>
      <Outlet/>
      <BottomNav role={role} insightBadgeCount={insightBadgeCount}/>
    </>
  );
}

function ProjectDetailRoute({role, apiKey, initialTab}) {
  const { id, pdfId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const onBack = () => {
    if (location.key === 'default') navigate('/projects', {replace: true});
    else navigate(-1);
  };
  const initialPage = Number(searchParams.get('page')) || 1;
  return (
    <ProjectDetail
      id={id}
      role={role}
      apiKey={apiKey}
      onBack={onBack}
      initialTab={initialTab}
      initialPdfId={pdfId}
      initialPage={initialPage}
    />
  );
}

function RootRedirect() {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="empty"><div className="spin" style={{margin:'0 auto 12px'}}/><p className="empty-h">Loading…</p></div>;
  }
  return <Navigate to={session ? '/home' : '/login'} replace/>;
}

function AppShell() {
  const { role, user, supabase } = useAuth();
  const effectiveRole = role || 'student';
  const [showSettings, setShowSettings] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [apiKey, setApiKey] = useApiKey();
  const projects = PROJECTS;
  const refreshUnread = useCallback(async () => {
    if (!user?.id) return;
    try { setNotifUnread(await getUnreadCount(supabase, user.id)); }
    catch { /* badge is non-critical */ }
  }, [supabase, user?.id]);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  const openSettings = () => setShowSettings(true);
  const openNotif = () => { setShowNotif(true); refreshUnread(); };
  const closeNotif = () => { setShowNotif(false); refreshUnread(); };

  const totalInsights = projects.reduce((a, p) => a + p.insights.filter(i => i.type !== "positive").length, 0);

  return (
    <PhoneFrame>
      <Routes>
        <Route path="/" element={<RootRedirect/>}/>
        <Route path="/login"           element={<div className="screen"><Login/></div>}/>
        <Route path="/signup"          element={<div className="screen"><Signup/></div>}/>
        <Route path="/reset"           element={<div className="screen"><Reset/></div>}/>
        <Route path="/update-password" element={<div className="screen"><UpdatePassword/></div>}/>

        <Route path="/legal/privacy" element={<div className="screen"><Privacy/></div>}/>
        <Route path="/legal/terms"   element={<div className="screen"><Terms/></div>}/>

        <Route element={<ProtectedRoute><Outlet/></ProtectedRoute>}>
          <Route path="/projects/create" element={<div className="screen"><ProjectCreate/></div>}/>
          <Route path="/projects/:id"    element={
            <div className="screen"><ProjectDetailRoute role={effectiveRole} apiKey={apiKey}/></div>
          }/>
          <Route path="/projects/:id/pdfs" element={
            <div className="screen"><ProjectDetailRoute role={effectiveRole} apiKey={apiKey} initialTab="pdfs"/></div>
          }/>
          <Route path="/projects/:id/pdfs/:pdfId" element={
            <div className="screen"><ProjectDetailRoute role={effectiveRole} apiKey={apiKey} initialTab="pdfs"/></div>
          }/>
          <Route path="/profile/edit" element={<div className="screen"><ProfileEdit/></div>}/>
          <Route path="/profile/:id"  element={<div className="screen"><ProfileView/></div>}/>
          <Route element={<BottomNavLayout role={effectiveRole} insightBadgeCount={totalInsights}/>}>
            <Route path="/ai" element={<AIScreen role={effectiveRole} projects={projects} apiKey={apiKey}/>}/>
            <Route element={<ScreenLayout/>}>
              <Route path="/home" element={<Home role={effectiveRole} projects={projects} openSettings={openSettings} openNotif={openNotif} notifUnread={notifUnread}/>}/>
              <Route path="/projects" element={<Projects role={effectiveRole}/>}/>
              <Route path="/profile" element={<Profile role={effectiveRole} projects={projects} openSettings={openSettings}/>}/>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} apiKey={apiKey} setApiKey={setApiKey}/>}
      {showNotif && <NotificationsPanel onClose={closeNotif} onChanged={refreshUnread}/>}
    </PhoneFrame>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <DemoModeProvider>
        <ThemeProvider>
          <BrowserRouter basename="/Acedex">
            <AppShell/>
          </BrowserRouter>
        </ThemeProvider>
      </DemoModeProvider>
    </SessionProvider>
  );
}
