import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Login from '../modules/auth/Login';
import Dashboard from '../modules/dashboard/Dashboard';
import RecordPage from '../modules/records/RecordPage';
import OrganizationWorkspace from '../modules/organizations/OrganizationWorkspace';
import EmployeesPage from '../modules/employees/EmployeesPage';
import AuditPage from '../modules/audit/AuditPage';
import PracticeProfile from '../modules/practices/PracticeProfile';
import FacilityProfile from '../modules/facilities/FacilityProfile';
import CredentialsCenter from '../modules/documents/CredentialsCenter';
import FacilityCredentials from '../modules/documents/FacilityCredentials';
import { config } from '../config/resources';

function Protected({ children }) {
  return localStorage.getItem('credentialing_token') ? children : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={(
          <Protected>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/practices/new/profile" element={<PracticeProfile />} />
                <Route path="/practices/:id/profile" element={<PracticeProfile />} />
                <Route path="/facilities/new/profile" element={<FacilityProfile />} />
                <Route path="/facilities/:id/profile" element={<FacilityProfile />} />
                <Route path="/facilities/:id/credentials" element={<FacilityCredentials />} />
                <Route path="/organizations/:id/*" element={<OrganizationWorkspace />} />
                <Route path="/credentials" element={<CredentialsCenter />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                {Object.keys(config).map(type => (
                  <Route key={type} path={`/${type}`} element={<RecordPage type={type} />} />
                ))}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </Protected>
        )}
      />
    </Routes>
  );
}
