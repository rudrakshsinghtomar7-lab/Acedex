// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { PROJECTS } from './data/projects.js';
import PhoneFrame from './components/PhoneFrame.jsx';
import Screen from './components/Screen.jsx';
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
import { DemoModeProvider, useDemoMode } from './hooks/useDemoMode.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';

function ScreenLayout() {
  return <Screen><Outlet/></Screen>;
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
  const { demoMode, demoRole } = useDemoMode();
  // Strictly fenced to demo mode: demoRole only takes effect while demoMode is
  // on. With demo off, this is exactly `role || 'student'` — demoRole has zero
  // influence on a real user and strips cleanly with the rest of demo mode.
  const effectiveRole = (demoMode && demoRole) ? demoRole : (role || 'student');
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
        <Route path="/login"           element={<Screen><Login/></Screen>}/>
        <Route path="/signup"          element={<Screen><Signup/></Screen>}/>
        <Route path="/reset"           element={<Screen><Reset/></Screen>}/>
        <Route path="/update-password" element={<Screen><UpdatePassword/></Screen>}/>

        <Route path="/legal/privacy" element={<Screen><Privacy/></Screen>}/>
        <Route path="/legal/terms"   element={<Screen><Terms/></Screen>}/>

        <Route element={<ProtectedRoute><Outlet/></ProtectedRoute>}>
          <Route path="/projects/create" element={<Screen><ProjectCreate/></Screen>}/>
          <Route path="/projects/:id"    element={
            <Screen><ProjectDetailRoute role={effectiveRole} apiKey={apiKey}/></Screen>
          }/>
          <Route path="/projects/:id/pdfs" element={
            <Screen><ProjectDetailRoute role={effectiveRole} apiKey={apiKey} initialTab="pdfs"/></Screen>
          }/>
          <Route path="/projects/:id/pdfs/:pdfId" element={
            <Screen><ProjectDetailRoute role={effectiveRole} apiKey={apiKey} initialTab="pdfs"/></Screen>
          }/>
          <Route path="/profile/edit" element={<Screen><ProfileEdit/></Screen>}/>
          <Route path="/profile/:id"  element={<Screen><ProfileView/></Screen>}/>
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
