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
import AdminLayout from './layouts/AdminLayout';
import AdminDashboardPage from './admin/AdminDashboardPage';

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
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
        </Route>

        <Route path="*" element={<div className="p-20 text-center text-2xl font-bold">404 - Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
