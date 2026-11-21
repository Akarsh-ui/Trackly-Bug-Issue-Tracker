import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { IssuesPage } from './pages/IssuesPage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { KanbanPage } from './pages/KanbanPage';
import { TeamPage } from './pages/TeamPage';
import { InvitationsPage } from './pages/InvitationsPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F2] dark:bg-[#181817] flex items-center justify-center">
        <div className="text-xs font-mono text-[#6B6964]">Loading Trackly workspace...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const safeRedirect =
    rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : '/';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F2] dark:bg-[#181817] flex items-center justify-center">
        <div className="text-xs font-mono text-[#6B6964]">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={safeRedirect} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1F1F1E',
                color: '#F3F0EE',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #3A3835',
              },
            }}
          />
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              }
            />
            <Route path="/invite" element={<AcceptInvitePage />} />
            <Route path="/invite/:token" element={<AcceptInvitePage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="issues" element={<IssuesPage />} />
              <Route path="issues/:id" element={<IssueDetailPage />} />
              <Route path="board" element={<KanbanPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="invitations" element={<InvitationsPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
