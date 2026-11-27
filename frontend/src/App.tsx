import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import { AdminLayout } from './components/layout/AdminLayout';
import { EmployeeLayout } from './components/layout/EmployeeLayout';

// Lightweight Route Loading Fallback
const PageLoadingFallback: React.FC = () => (
  <div className="flex-1 min-h-[60vh] flex items-center justify-center p-6">
    <div className="flex flex-col items-center gap-3">
      <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      <span className="text-xs font-mono text-slate-400">Loading module...</span>
    </div>
  </div>
);

// Lazy Loaded Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const EmployeeManagement = lazy(() => import('./pages/admin/EmployeeManagement').then(m => ({ default: m.EmployeeManagement })));
const DepartmentManagement = lazy(() => import('./pages/admin/DepartmentManagement').then(m => ({ default: m.DepartmentManagement })));
const PollManagement = lazy(() => import('./pages/admin/PollManagement').then(m => ({ default: m.PollManagement })));
const CreateEditPoll = lazy(() => import('./pages/admin/CreateEditPoll').then(m => ({ default: m.CreateEditPoll })));
const PollResultsPage = lazy(() => import('./pages/admin/PollResultsPage').then(m => ({ default: m.PollResultsPage })));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const NotificationsPage = lazy(() => import('./pages/admin/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Employee Pages
const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard').then(m => ({ default: m.EmployeeDashboard })));
const EmployeeVotingPage = lazy(() => import('./pages/employee/EmployeeVotingPage').then(m => ({ default: m.EmployeeVotingPage })));
const EmployeeVotingHistory = lazy(() => import('./pages/employee/EmployeeVotingHistory').then(m => ({ default: m.EmployeeVotingHistory })));
const EmployeeNotifications = lazy(() => import('./pages/employee/EmployeeNotifications').then(m => ({ default: m.EmployeeNotifications })));

const ProtectedRoute: React.FC<{ allowedRole: 'admin' | 'employee'; children: React.ReactNode }> = ({
  allowedRole,
  children,
}) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400 font-mono text-sm">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        Authenticating SG ONE Session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== allowedRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/employee'} replace />;
  }

  return <>{children}</>;
};

const RootRedirect: React.FC = () => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400 font-mono text-sm">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={role === 'admin' ? '/admin' : '/employee'} replace />;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {/* Public Root & Login */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="employees" element={<EmployeeManagement />} />
              <Route path="departments" element={<DepartmentManagement />} />
              <Route path="polls" element={<PollManagement />} />
              <Route path="polls/create" element={<CreateEditPoll />} />
              <Route path="results" element={<PollResultsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Employee Routes */}
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRole="employee">
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<EmployeeDashboard />} />
              <Route path="polls/:id" element={<EmployeeVotingPage />} />
              <Route path="history" element={<EmployeeVotingHistory />} />
              <Route path="notifications" element={<EmployeeNotifications />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
