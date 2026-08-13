import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import NewTicketPage from './pages/NewTicketPage';
import TicketDetailPage from './pages/TicketDetailPage';
import AdminPage from './pages/AdminPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import CreateUserPage from './pages/admin/CreateUserPage';
import ClientManagementPage from './pages/admin/ClientManagementPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import PMEmployeeManagementPage from './pages/manager/PMEmployeeManagementPage';
import PMCreateEmployeePage from './pages/manager/PMCreateEmployeePage';
import PMClientListPage from './pages/manager/PMClientListPage';

function Layout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              
              <Route element={<ProtectedRoute roles={['client']} />}>
                <Route path="/tickets/new" element={<NewTicketPage />} />
              </Route>
              
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/users" element={<UserManagementPage />} />
                <Route path="/admin/users/new" element={<CreateUserPage />} />
                <Route path="/admin/users/:id" element={<UserDetailPage />} />
                <Route path="/admin/clients" element={<ClientManagementPage />} />
                <Route path="/admin/audit-logs" element={<AuditLogPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={['pm']} />}>
                <Route path="/manager/employees" element={<PMEmployeeManagementPage />} />
                <Route path="/manager/employees/new" element={<PMCreateEmployeePage />} />
                <Route path="/manager/clients" element={<PMClientListPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
