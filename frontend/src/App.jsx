import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';

// Layout components (keep eager - needed for shell)
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Lazy load all page components
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PublicLeaguePage = lazy(() => import('./pages/PublicLeaguePage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const SupportTicketPage = lazy(() => import('./pages/SupportTicketPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LeaguesPage = lazy(() => import('./pages/LeaguesPage'));
const LeagueDetailPage = lazy(() => import('./pages/LeagueDetailPage'));
const MatchesPage = lazy(() => import('./pages/MatchesPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const RecordMatchPage = lazy(() => import('./pages/RecordMatchPage'));
const MatchDetailPage = lazy(() => import('./pages/MatchDetailPage'));
const QuickMatchPage = lazy(() => import('./pages/QuickMatchPage'));
const TtcBadenWettingenWikiPage = lazy(() => import('./pages/TtcBadenWettingenWikiPage'));

import './App.css';

// Suspense wrapper component for better UX
const SuspenseRoute = ({ children }) => (
  <Suspense fallback={
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" />
    </div>
  }>
    {children}
  </Suspense>
);

// Protected Route component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <SuspenseRoute>{children}</SuspenseRoute>;
};

// Public Route component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <SuspenseRoute>{children}</SuspenseRoute>;
};

function AppRoutes() {
  const { ready } = useTranslation();

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Landing page - public, redirects to dashboard if logged in */}
        <Route path="/" element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        } />

        {/* Auth routes */}
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />

        {/* Public league view - accessible to everyone */}
        <Route path="/league/:id" element={
          <SuspenseRoute>
            <PublicLeaguePage />
          </SuspenseRoute>
        } />
        <Route path="/contact" element={
          <SuspenseRoute>
            <ContactPage />
          </SuspenseRoute>
        } />
        <Route path="/support" element={
          <SuspenseRoute>
            <SupportTicketPage />
          </SuspenseRoute>
        } />
        <Route element={<Layout />}>
          <Route path="/wiki/ttc-baden-wettingen" element={
            <SuspenseRoute>
              <TtcBadenWettingenWikiPage />
            </SuspenseRoute>
          } />
        </Route>

        {/* Protected routes */}
        <Route path="/app" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="leagues" element={<LeaguesPage />} />
          <Route path="leagues/:id" element={<LeagueDetailPage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="matches/record" element={<RecordMatchPage />} />
          <Route path="quick-match" element={<QuickMatchPage />} />
          <Route path="matches/:id" element={<MatchDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:username" element={<ProfilePage />} />
          <Route path="admin" element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          } />
        </Route>

        {/* Legacy redirects for old paths */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/leagues" element={<Navigate to="/app/leagues" replace />} />
        <Route path="/leagues/:id" element={<Navigate to="/app/leagues/:id" replace />} />
        <Route path="/matches" element={<Navigate to="/app/matches" replace />} />
        <Route path="/matches/record" element={<Navigate to="/app/matches/record" replace />} />
        <Route path="/matches/:id" element={<Navigate to="/app/matches/:id" replace />} />
        <Route path="/notifications" element={<Navigate to="/app/notifications" replace />} />
        <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
        <Route path="/profile/:username" element={<Navigate to="/app/profile/:username" replace />} />
        <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
        <Route path="/app/wiki/ttc-baden-wettingen" element={<Navigate to="/wiki/ttc-baden-wettingen" replace />} />

        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
