import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import PublicLayout from './layouts/PublicLayout';
import LandingPage from './public/LandingPage';
import ServicesPage from './public/ServicesPage';
import BusinessesPage from './public/BusinessesPage';
import JobsPage from './public/JobsPage';
import HospitalDirectory from './hospital/HospitalDirectory';
import HospitalProfile from './hospital/HospitalProfile';
import PublicAppointmentBooking from './hospital/PublicAppointmentBooking';
import BusinessRegistrationPage from './public/BusinessRegistrationPage';
import ManageServices from './hospital/admin/ManageServices';
import ManageDoctors from './hospital/admin/ManageDoctors';
import ManageSchedules from './hospital/admin/ManageSchedules';
import AuthLayout from './layouts/AuthLayout';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import ForgotPasswordPage from './auth/ForgotPasswordPage';
import ResetPasswordPage from './auth/ResetPasswordPage';
import VerifyEmailPage from './auth/VerifyEmailPage';
import DashboardLayout from './layouts/DashboardLayout';
import UserDashboardPage from './dashboard/UserDashboardPage';
import UserBookingsPage from './dashboard/UserBookingsPage';
import UserProfilePage from './dashboard/UserProfilePage';
import BusinessLayout from './layouts/BusinessLayout';
import ManageRoles from './business/ManageRoles';
import BusinessDashboardPage from './business/BusinessDashboardPage';
import BusinessEmployeesPage from './business/BusinessEmployeesPage';
import BusinessProductsPage from './business/BusinessProductsPage';
import BusinessServicesPage from './business/BusinessServicesPage';
import BusinessOffersPage from './business/BusinessOffersPage';
import BusinessOrdersPage from './business/BusinessOrdersPage';
import BusinessBookingsPage from './business/BusinessBookingsPage';
import BusinessProfilePage from './business/BusinessProfilePage';
import BusinessSettingsPage from './business/BusinessSettingsPage';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboardPage from './admin/AdminDashboardPage';
import AdminUsersPage from './admin/AdminUsersPage';
import AdminBusinessesPage from './admin/AdminBusinessesPage';
import AdminProfessionalsPage from './admin/AdminProfessionalsPage';
import AdminCategoriesPage from './admin/AdminCategoriesPage';
import AdminServicesPage from './admin/AdminServicesPage';
import AdminProductsPage from './admin/AdminProductsPage';
import AdminOrdersPage from './admin/AdminOrdersPage';
import AdminPaymentsPage from './admin/AdminPaymentsPage';
import AdminLocationsPage from './admin/AdminLocationsPage';
import AdminSettingsPage from './admin/AdminSettingsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="businesses" element={<BusinessesPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="hospitals" element={<HospitalDirectory />} />
            <Route path="hospitals/:id" element={<HospitalProfile />} />
            <Route path="hospital/book-appointment" element={<PublicAppointmentBooking />} />
            <Route path="register-business" element={<BusinessRegistrationPage />} />
          </Route>

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Route>

          {/* Protected Routes for logged in users */}
          <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'PROFESSIONAL', 'BUSINESS_OWNER', 'SUPER_ADMIN']} />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<UserDashboardPage />} />
              <Route path="bookings" element={<UserBookingsPage />} />
              <Route path="profile" element={<UserProfilePage />} />
            </Route>
          </Route>

          {/* Protected Routes for Business Owners & Super Admin */}
          <Route element={<ProtectedRoute allowedRoles={['BUSINESS_OWNER', 'SUPER_ADMIN']} />}>
            <Route path="/business" element={<BusinessLayout />}>
              <Route index element={<BusinessDashboardPage />} />
              <Route path="roles" element={<ManageRoles />} />
              <Route path="employees" element={<BusinessEmployeesPage />} />
              <Route path="products" element={<BusinessProductsPage />} />
              <Route path="services" element={<BusinessServicesPage />} />
              <Route path="offers" element={<BusinessOffersPage />} />
              <Route path="orders" element={<BusinessOrdersPage />} />
              <Route path="bookings" element={<BusinessBookingsPage />} />
              <Route path="profile" element={<BusinessProfilePage />} />
              <Route path="settings" element={<BusinessSettingsPage />} />
            </Route>
            
            {/* Hospital Admin Routes (Using BusinessLayout) */}
            <Route path="/hospital/admin" element={<BusinessLayout />}>
              <Route path="services" element={<ManageServices />} />
              <Route path="doctors" element={<ManageDoctors />} />
              <Route path="schedules" element={<ManageSchedules />} />
            </Route>
          </Route>

          {/* Protected Routes for Super Admin */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="businesses" element={<AdminBusinessesPage />} />
              <Route path="professionals" element={<AdminProfessionalsPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="locations" element={<AdminLocationsPage />} />
              <Route path="services" element={<AdminServicesPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<div className="p-20 text-center text-2xl font-bold">404 - Page Not Found</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

