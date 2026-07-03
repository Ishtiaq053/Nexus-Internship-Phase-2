import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Layouts
import { DashboardLayout } from './components/layout/DashboardLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Dashboard Pages
import { EntrepreneurDashboard } from './pages/dashboard/EntrepreneurDashboard';
import { InvestorDashboard } from './pages/dashboard/InvestorDashboard';

// Profile Pages
import { EntrepreneurProfile } from './pages/profile/EntrepreneurProfile';
import { InvestorProfile } from './pages/profile/InvestorProfile';

// Feature Pages
import { InvestorsPage } from './pages/investors/InvestorsPage';
import { EntrepreneursPage } from './pages/entrepreneurs/EntrepreneursPage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { DocumentsPage } from './pages/documents/DocumentsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { HelpPage } from './pages/help/HelpPage';
import { DealsPage } from './pages/deals/DealsPage';
import { MeetingsPage } from './pages/meetings/MeetingsPage';

// Chat Pages
import { ChatPage } from './pages/chat/ChatPage';
import { BackendStatusBadge } from './components/ui/BackendStatusBadge';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <BackendStatusBadge />
        <Routes>
          {/* ── Public routes ─────────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ── Protected: Dashboard ──────────────────────────────────── */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="entrepreneur"
              element={
                <ProtectedRoute role="entrepreneur">
                  <EntrepreneurDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="investor"
              element={
                <ProtectedRoute role="investor">
                  <InvestorDashboard />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* ── Protected: Profiles ───────────────────────────────────── */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="entrepreneur/:id" element={<EntrepreneurProfile />} />
            <Route path="investor/:id" element={<InvestorProfile />} />
          </Route>

          {/* ── Protected: Feature pages (any authenticated role) ─────── */}
          {(
            [
              ['/investors', <InvestorsPage />],
              ['/entrepreneurs', <EntrepreneursPage />],
              ['/meetings', <MeetingsPage />],
              ['/messages', <MessagesPage />],
              ['/notifications', <NotificationsPage />],
              ['/documents', <DocumentsPage />],
              ['/settings', <SettingsPage />],
              ['/help', <HelpPage />],
              ['/deals', <DealsPage />],
            ] as [string, React.ReactNode][]
          ).map(([path, page]) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={page} />
            </Route>
          ))}

          {/* ── Protected: Chat ───────────────────────────────────────── */}
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ChatPage />} />
            <Route path=":userId" element={<ChatPage />} />
          </Route>

          {/* ── Redirects ─────────────────────────────────────────────── */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;