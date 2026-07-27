import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import LandingPage from './public/LandingPage';
import AuthLayout from './layouts/AuthLayout';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import ForgotPasswordPage from './auth/ForgotPasswordPage';
import ResetPasswordPage from './auth/ResetPasswordPage';
import VerifyEmailPage from './auth/VerifyEmailPage';
import DashboardLayout from './layouts/DashboardLayout';
import UserDashboardPage from './dashboard/UserDashboardPage';
import BusinessLayout from './layouts/BusinessLayout';
import BusinessDashboardPage from './business/BusinessDashboardPage';
import BusinessEmployeesPage from './business/BusinessEmployeesPage';
import BusinessProductsPage from './business/BusinessProductsPage';
import BusinessServicesPage from './business/BusinessServicesPage';
import BusinessOffersPage from './business/BusinessOffersPage';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboardPage from './admin/AdminDashboardPage';
import AdminUsersPage from './admin/AdminUsersPage';
import AdminBusinessesPage from './admin/AdminBusinessesPage';
import AdminProfessionalsPage from './admin/AdminProfessionalsPage';
import AdminCategoriesPage from './admin/AdminCategoriesPage';
import AdminServicesPage from './admin/AdminServicesPage';
import AdminProductsPage from './admin/AdminProductsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Route>

        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<UserDashboardPage />} />
        </Route>

        <Route path="/business" element={<BusinessLayout />}>
          <Route index element={<BusinessDashboardPage />} />
          <Route path="employees" element={<BusinessEmployeesPage />} />
          <Route path="products" element={<BusinessProductsPage />} />
          <Route path="services" element={<BusinessServicesPage />} />
          <Route path="offers" element={<BusinessOffersPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="businesses" element={<AdminBusinessesPage />} />
          <Route path="professionals" element={<AdminProfessionalsPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="products" element={<AdminProductsPage />} />
        </Route>

        <Route path="*" element={<div className="p-20 text-center text-2xl font-bold">404 - Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
