import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import RoleGuard, { GPA_ADMIN_ROLES, GPA_OPS_ROLES, GPA_STAFF_ROLES } from '../components/auth/RoleGuard';
import Login from '../modules/auth/Login';
import AcceptInvitation from '../modules/auth/AcceptInvitation';
import AcceptProviderInvitation from '../modules/auth/AcceptProviderInvitation';
import Dashboard from '../modules/dashboard/Dashboard';
import RecordPage from '../modules/records/RecordPage';
import OrganizationWorkspace from '../modules/organizations/OrganizationWorkspace';
import EmployeesPage from '../modules/employees/EmployeesPage';
import AuditPage from '../modules/audit/AuditPage';
import PracticeProfile from '../modules/practices/PracticeProfile';
import FacilityProfile from '../modules/facilities/FacilityProfile';
import ProviderProfile from '../modules/providers/ProviderProfile';
import CredentialsCenter from '../modules/documents/CredentialsCenter';
import FacilityCredentials from '../modules/documents/FacilityCredentials';
import EnrollmentsPage from '../modules/enrollments/EnrollmentsPage';
import RevalidationOpsPage from '../modules/credentialing/RevalidationOpsPage';
import IntakePage from '../modules/intake/IntakePage';
import ReferenceDataHub from '../modules/directories/ReferenceDataHub';
import DirectoryRecordPage from '../modules/directories/DirectoryRecordPage';
import DirectoryQualityPage from '../modules/directories/DirectoryQualityPage';
import ClientsPage from '../modules/clients/ClientsPage';
import ClientDetailPage from '../modules/clients/ClientDetailPage';
import PortalDashboard from '../modules/portal/PortalDashboard';
import PortalProfile from '../modules/portal/PortalProfile';
import PortalUsers from '../modules/portal/PortalUsers';
import PortalOrganizations from '../modules/portal/PortalOrganizations';
import PortalProviderIntakes from '../modules/portal/PortalProviderIntakes';
import PortalProviderIntakeDetail from '../modules/portal/PortalProviderIntakeDetail';
import ProviderDashboard from '../modules/providerPortal/ProviderDashboard';
import ProviderIntakeList from '../modules/providerPortal/ProviderIntakeList';
import ProviderIntakeDetail from '../modules/providerPortal/ProviderIntakeDetail';
import ProviderHistory from '../modules/providerPortal/ProviderHistory';
import ProviderCredentialingProfile from '../modules/providerPortal/ProviderCredentialingProfile';
import PortalCredentialingReadiness from '../modules/portal/PortalCredentialingReadiness';
import CredentialingQaDashboard from '../modules/credentialing/CredentialingQaDashboard';
import { config } from '../config/resources';

const GENERIC_RECORD_TYPES = Object.keys(config).filter(t => t !== 'enrollments');

function Protected({ children }) {
  return localStorage.getItem('credentialing_token') ? children : <Navigate to="/login" replace />;
}

function guard(allow, element) {
  return <RoleGuard allow={allow}>{element}</RoleGuard>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invitation/:token" element={<AcceptInvitation />} />
      <Route path="/accept-provider-invitation/:token" element={<AcceptProviderInvitation />} />
      <Route
        path="/*"
        element={(
          <Protected>
            <AppLayout>
              <Routes>
                <Route path="/" element={guard(GPA_STAFF_ROLES, <Dashboard />)} />
                <Route path="/portal" element={guard(['CLIENT_USER'], <PortalDashboard />)} />
                <Route path="/portal/profile" element={guard(['CLIENT_USER'], <PortalProfile />)} />
                <Route path="/portal/users" element={guard(['CLIENT_USER'], <PortalUsers />)} />
                <Route path="/portal/organizations" element={guard(['CLIENT_USER'], <PortalOrganizations />)} />
                <Route path="/portal/provider-intakes" element={guard(['CLIENT_USER'], <PortalProviderIntakes />)} />
                <Route path="/portal/provider-intakes/:id" element={guard(['CLIENT_USER'], <PortalProviderIntakeDetail />)} />
                <Route path="/portal/credentialing-readiness" element={guard(['CLIENT_USER'], <PortalCredentialingReadiness />)} />
                <Route path="/provider-portal" element={guard(['EXTERNAL_PROVIDER'], <ProviderDashboard />)} />
                <Route path="/provider-portal/intakes" element={guard(['EXTERNAL_PROVIDER'], <ProviderIntakeList />)} />
                <Route path="/provider-portal/intakes/:id" element={guard(['EXTERNAL_PROVIDER'], <ProviderIntakeDetail />)} />
                <Route path="/provider-portal/providers/:providerId/history" element={guard(['EXTERNAL_PROVIDER'], <ProviderHistory />)} />
                <Route path="/provider-portal/providers/:providerId/credentialing" element={guard(['EXTERNAL_PROVIDER'], <ProviderCredentialingProfile />)} />
                <Route path="/clients" element={guard(GPA_ADMIN_ROLES, <ClientsPage />)} />
                <Route path="/clients/:id" element={guard(GPA_ADMIN_ROLES, <ClientDetailPage />)} />
                <Route path="/practices/new/profile" element={guard(GPA_STAFF_ROLES, <PracticeProfile />)} />
                <Route path="/practices/:id/profile" element={guard([...GPA_STAFF_ROLES, 'CLIENT_USER'], <PracticeProfile />)} />
                <Route path="/facilities/new/profile" element={guard(GPA_STAFF_ROLES, <FacilityProfile />)} />
                <Route path="/facilities/:id/profile" element={guard([...GPA_STAFF_ROLES, 'CLIENT_USER'], <FacilityProfile />)} />
                <Route path="/providers/new/profile" element={guard(GPA_STAFF_ROLES, <ProviderProfile />)} />
                <Route path="/providers/:id/profile" element={guard([...GPA_STAFF_ROLES, 'CLIENT_USER'], <ProviderProfile />)} />
                <Route path="/facilities/:id/credentials" element={guard([...GPA_STAFF_ROLES, 'CLIENT_USER'], <FacilityCredentials />)} />
                <Route path="/organizations/:id/*" element={guard([...GPA_STAFF_ROLES, 'CLIENT_USER'], <OrganizationWorkspace />)} />
                <Route path="/credentials" element={guard(GPA_STAFF_ROLES, <CredentialsCenter />)} />
                <Route path="/audit" element={guard(GPA_STAFF_ROLES, <AuditPage />)} />
                <Route path="/employees" element={guard(GPA_ADMIN_ROLES, <EmployeesPage />)} />
                <Route path="/enrollments" element={guard([...GPA_STAFF_ROLES, 'CLIENT_USER'], <EnrollmentsPage />)} />
                <Route path="/revalidation-ops" element={guard(GPA_OPS_ROLES, <RevalidationOpsPage />)} />
                <Route path="/intake" element={guard(GPA_OPS_ROLES, <IntakePage />)} />
                <Route path="/directories" element={guard(GPA_STAFF_ROLES, <ReferenceDataHub />)} />
                <Route path="/directories/quality" element={guard(GPA_OPS_ROLES, <DirectoryQualityPage />)} />
                <Route path="/credentialing-qa" element={guard(GPA_OPS_ROLES, <CredentialingQaDashboard />)} />
                <Route path="/directories/:resource" element={guard(GPA_STAFF_ROLES, <DirectoryRecordPage />)} />
                {GENERIC_RECORD_TYPES.map(type => (
                  <Route
                    key={type}
                    path={`/${type}`}
                    element={guard([...GPA_STAFF_ROLES, 'CLIENT_USER'], <RecordPage type={type} />)}
                  />
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
