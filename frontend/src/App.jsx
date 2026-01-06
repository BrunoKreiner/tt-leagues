import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';

// Layout components
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Auth components
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Landing page (public)
import LandingPage from './pages/LandingPage';
import PublicLeaguePage from './pages/PublicLeaguePage';
import ContactPage from './pages/ContactPage';

// Main pages
import DashboardPage from './pages/DashboardPage';
import LeaguesPage from './pages/LeaguesPage';
import LeagueDetailPage from './pages/LeagueDetailPage';
import MatchesPage from './pages/MatchesPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import NotificationsPage from './pages/NotificationsPage';
import RecordMatchPage from './pages/RecordMatchPage';
import MatchDetailPage from './pages/MatchDetailPage';

import './App.css';

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

  return children;
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

  return children;
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
        <Route path="/league/:id" element={<PublicLeaguePage />} />
        <Route path="/contact" element={<ContactPage />} />

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
