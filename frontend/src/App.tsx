import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import { AdminLayout } from './components/layout/AdminLayout';
import { EmployeeLayout } from './components/layout/EmployeeLayout';

// Auth Page
import { LoginPage } from './pages/auth/LoginPage';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { EmployeeManagement } from './pages/admin/EmployeeManagement';
import { DepartmentManagement } from './pages/admin/DepartmentManagement';
import { PollManagement } from './pages/admin/PollManagement';
import { CreateEditPoll } from './pages/admin/CreateEditPoll';
import { PollResultsPage } from './pages/admin/PollResultsPage';
import { AnalyticsPage } from './pages/admin/AnalyticsPage';
import { NotificationsPage } from './pages/admin/NotificationsPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SettingsPage } from './pages/admin/SettingsPage';

// Employee Pages
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { EmployeeVotingPage } from './pages/employee/EmployeeVotingPage';
import { EmployeeVotingHistory } from './pages/employee/EmployeeVotingHistory';
import { EmployeeNotifications } from './pages/employee/EmployeeNotifications';

const ProtectedRoute: React.FC<{ allowedRole: 'admin' | 'employee'; children: React.ReactNode }> = ({
  allowedRole,
  children,
}) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400 font-mono text-sm">
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
