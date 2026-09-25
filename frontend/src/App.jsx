import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import { ZONE_ACCESS } from './auth/roleAccess';
import PublicLayout from './layouts/PublicLayout';
import HospitalStaffLayout from './layouts/HospitalStaffLayout';
import LandingPage from './public/LandingPage';
import ServicesPage from './public/ServicesPage';
import BusinessesPage from './public/BusinessesPage';
import JobsPage from './public/JobsPage';
import HospitalDirectory from './hospital/HospitalDirectory';
import HospitalProfile from './hospital/HospitalProfile';
import PublicAppointmentBooking from './hospital/PublicAppointmentBooking';
import BusinessRegistrationPage from './public/BusinessRegistrationPage';
import ManageServices from './hospital/admin/ManageServices';
import ManageExams from './hospital/admin/ManageExams';
import ManageServiceCategories from './hospital/admin/ManageServiceCategories';
import ManageDoctors from './hospital/admin/ManageDoctors';
import ManageSchedules from './hospital/admin/ManageSchedules';
import ManageAppointments from './hospital/admin/ManageAppointments';
import ManageMedicalRecords from './hospital/admin/ManageMedicalRecords';
import ManageInvoices from './hospital/admin/ManageInvoices';
import ManageLabResults from './hospital/admin/ManageLabResults';
import HospitalDashboard from './hospital/admin/HospitalDashboard';
import ManageReports from './hospital/admin/ManageReports';
import ManagePatients from './hospital/admin/ManagePatients';
import PatientDetail from './hospital/admin/PatientDetail';
import ManageAdmissions from './hospital/admin/ManageAdmissions';
import LegacyHospitalAdminRedirect from './hospital/LegacyHospitalAdminRedirect';
import PermissionGuard from './auth/PermissionGuard';
import { PERMISSIONS } from './lib/permissions';
import LabTechnicianDashboard from './hospital/staff/LabTechnicianDashboard';
import DoctorDashboard from './hospital/staff/DoctorDashboard';
import NurseDashboard from './hospital/staff/NurseDashboard';
import HospitalCashierDashboard from './hospital/staff/CashierDashboard';
import ReceptionistDashboard from './hospital/staff/ReceptionistDashboard';
import HotelDashboard from './hotel/admin/HotelDashboard';
import HotelCompany from './hotel/admin/HotelCompany';
import ManageRoomTypes from './hotel/admin/ManageRoomTypes';
import ManageRooms from './hotel/admin/ManageRooms';
import ManageRates from './hotel/admin/ManageRates';
import ManageReservations from './hotel/admin/ManageReservations';
import ManageStays from './hotel/admin/ManageStays';
import ManageGuests, { ManageHotelServices } from './hotel/admin/ManageGuests';
import ManageHousekeeping from './hotel/admin/ManageHousekeeping';
import ManageMaintenance from './hotel/admin/ManageMaintenance';
import ManageHotelInvoices, { HotelReports } from './hotel/admin/ManageHotelInvoices';
import FrontDeskArrivals, { FrontDeskDepartures } from './hotel/admin/FrontDesk';
import CashierFolios from './hotel/admin/CashierFolios';
import HotelCashierDashboard from './hotel/admin/CashierDashboard';
import HotelReservationSettings from './hotel/admin/HotelReservationSettings';
import HotelClientMessages from './hotel/admin/HotelClientMessages';
import HotelClientReschedules from './hotel/admin/HotelClientReschedules';
import HotelStaffLayout from './hotel/staff/HotelStaffLayout';
import PublicHotels from './hotel/public/PublicHotels';
import PublicHotelBook from './hotel/public/PublicHotelBook';
import AuthLayout from './layouts/AuthLayout';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import ForgotPasswordPage from './auth/ForgotPasswordPage';
import ResetPasswordPage from './auth/ResetPasswordPage';
import VerifyEmailPage from './auth/VerifyEmailPage';
import OAuthCallbackPage from './auth/OAuthCallbackPage';
import DashboardLayout from './layouts/DashboardLayout';
import UserDashboardPage from './dashboard/UserDashboardPage';
import UserBookingsPage from './dashboard/UserBookingsPage';
import UserProfilePage from './dashboard/UserProfilePage';
import Notifications from './patient/Notifications';
import PatientLabResults from './patient/PatientLabResults';
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
import BusinessSubscriptionPage from './business/BusinessSubscriptionPage';
import BusinessAuditLogsPage from './business/BusinessAuditLogsPage';
import CommerceDashboard from './commerce/CommerceDashboard';
import CommerceCatalog from './commerce/CommerceCatalog';
import CommerceInventory from './commerce/CommerceInventory';
import CommerceOrders from './commerce/CommerceOrders';
import PublicShop from './commerce/PublicShop';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboardPage from './admin/AdminDashboardPage';
import AdminAnalyticsPage from './admin/AdminAnalyticsPage';
import AdminUsersPage from './admin/AdminUsersPage';
import AdminBusinessesPage from './admin/AdminBusinessesPage';
import AdminProfessionalsPage from './admin/AdminProfessionalsPage';
import AdminCategoriesPage from './admin/AdminCategoriesPage';
import AdminServicesPage from './admin/AdminServicesPage';
import AdminPaymentsPage from './admin/AdminPaymentsPage';
import AdminLocationsPage from './admin/AdminLocationsPage';
import AdminSettingsPage from './admin/AdminSettingsPage';
import AdminAuditLogsPage from './admin/AdminAuditLogsPage';
import AdminCmsPage from './admin/AdminCmsPage';
import AdminPlatformRolesPage from './admin/AdminPlatformRolesPage';
import AdminModerationPage from './admin/AdminModerationPage';
import AdminSupportPage from './admin/AdminSupportPage';
import AdminHotelsPage from './admin/AdminHotelsPage';
import HotelCalendar from './hotel/admin/HotelCalendar';
import ContentPageView from './public/ContentPageView';
import BusinessClientHistoryPage from './public/BusinessClientHistoryPage';
import WholesaleDashboard from './wholesale/WholesaleDashboard';
import WholesaleCatalog from './wholesale/WholesaleCatalog';
import WholesaleInventory from './wholesale/WholesaleInventory';
import WholesaleOrders from './wholesale/WholesaleOrders';
import WholesaleClients from './wholesale/WholesaleClients';
import WholesaleHistory from './wholesale/WholesaleHistory';
import WholesaleCompany from './wholesale/WholesaleCompany';
import WholesaleCart from './wholesale/WholesaleCart';
import WholesaleProforma from './wholesale/WholesaleProforma';
import WholesaleClientCompany from './wholesale/WholesaleClientCompany';
import PublicWholesaleCatalog from './wholesale/PublicWholesaleCatalog';
import PublicRetailCatalog from './retail/PublicRetailCatalog';
import RetailDashboard from './retail/RetailDashboard';
import RetailCatalog from './retail/RetailCatalog';
import RetailInventory from './retail/RetailInventory';
import RetailOrders from './retail/RetailOrders';
import RetailPatients from './retail/RetailPatients';
import RetailPrescriptions from './retail/RetailPrescriptions';
import RetailHistory from './retail/RetailHistory';
import RetailCompany from './retail/RetailCompany';
import RetailProforma from './retail/RetailProforma';
import RetailCart from './retail/RetailCart';

function App() {
  return (
    <BrowserRouter>
      <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="businesses" element={<BusinessesPage />} />
            <Route path="businesses/:id/catalog" element={<PublicWholesaleCatalog />} />
            <Route path="businesses/:id/pharmacy" element={<PublicRetailCatalog />} />
            <Route path="businesses/:id/shop" element={<PublicShop />} />
            <Route path="businesses/:id/historique" element={<BusinessClientHistoryPage />} />
            <Route path="businesses/:id/pharmacy/historique" element={<BusinessClientHistoryPage />} />
            <Route path="businesses/:id/shop/historique" element={<BusinessClientHistoryPage />} />
            <Route path="businesses/:id/catalog/historique" element={<BusinessClientHistoryPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="hospitals" element={<HospitalDirectory />} />
            <Route path="hospitals/:id" element={<HospitalProfile />} />
            <Route path="hospitals/:id/historique" element={<BusinessClientHistoryPage />} />
            <Route path="hospital/book-appointment" element={<PublicAppointmentBooking />} />
            <Route path="hotels" element={<PublicHotels />} />
            <Route path="hotels/:id/historique" element={<BusinessClientHistoryPage />} />
            <Route path="hotels/:id" element={<PublicHotelBook />} />
            <Route path="register-business" element={<BusinessRegistrationPage />} />
            <Route path="pages/:slug" element={<ContentPageView />} />
          </Route>

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/auth/oauth/callback" element={<OAuthCallbackPage />} />
          </Route>

          {/* Espace client / personnel (pas admin plateforme ni owner) */}
          <Route element={
            <ProtectedRoute
              allowedRoles={ZONE_ACCESS.customerDashboard.allowedRoles}
              forbiddenRoles={ZONE_ACCESS.customerDashboard.forbiddenRoles}
            />
          }>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<UserDashboardPage />} />
              <Route path="bookings" element={<UserBookingsPage />} />
              <Route path="lab-results" element={<PatientLabResults />} />
              <Route path="profile" element={<UserProfilePage />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
          </Route>

          {/* Espace entreprise / hôpital — propriétaire uniquement */}
          <Route element={
            <ProtectedRoute
              allowedRoles={ZONE_ACCESS.businessAdmin.allowedRoles}
              forbiddenRoles={ZONE_ACCESS.businessAdmin.forbiddenRoles}
            />
          }>
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
              <Route path="subscription" element={<BusinessSubscriptionPage />} />
              <Route path="audit" element={<BusinessAuditLogsPage />} />
            </Route>

            {/* Module Commerce — Boutique / Mode / Quincaillerie / … */}
            <Route path="/commerce" element={<BusinessLayout />}>
              <Route index element={<Navigate to="/commerce/dashboard" replace />} />
              <Route path="dashboard" element={<CommerceDashboard />} />
              <Route path="catalog" element={<CommerceCatalog />} />
              <Route path="inventory" element={<CommerceInventory />} />
              <Route path="orders" element={<CommerceOrders />} />
              <Route path="profile" element={<Navigate to="/business/profile" replace />} />
              <Route path="settings" element={<Navigate to="/business/settings" replace />} />
              <Route path="employees" element={<Navigate to="/business/employees" replace />} />
              <Route path="subscription" element={<BusinessSubscriptionPage />} />
              <Route path="audit" element={<BusinessAuditLogsPage />} />
            </Route>
            
            {/* Module Hôpital — routes MVP + compatibilité /hospital/admin/* */}
            <Route path="/hospital" element={<BusinessLayout />}>
              <Route index element={<Navigate to="/hospital/dashboard" replace />} />
              <Route path="dashboard" element={<HospitalDashboard />} />
              <Route path="profile" element={<Navigate to="/business/profile" replace />} />
              <Route path="subscription" element={<BusinessSubscriptionPage />} />
              <Route path="service-categories" element={<ManageServiceCategories />} />
              <Route path="services" element={<ManageServices />} />
              <Route path="exams" element={<ManageExams />} />
              <Route path="doctors" element={<ManageDoctors />} />
              <Route path="schedules" element={<ManageSchedules />} />
              <Route path="patients" element={<ManagePatients />} />
              <Route path="patients/:id" element={<PatientDetail />} />
              <Route path="admissions" element={<ManageAdmissions />} />
              <Route path="appointments" element={<ManageAppointments />} />
              <Route path="queue" element={<Navigate to="/hospital/appointments?tab=queue" replace />} />
              <Route path="medical-records" element={
                <PermissionGuard anyPermissions={[PERMISSIONS.MEDICAL_RECORD_VIEW]}>
                  <ManageMedicalRecords />
                </PermissionGuard>
              } />
              <Route path="laboratory" element={
                <PermissionGuard anyPermissions={[PERMISSIONS.LAB_REQUEST_VIEW, PERMISSIONS.LAB_RESULT_CREATE]}>
                  <ManageLabResults />
                </PermissionGuard>
              } />
              <Route path="laboratory/requests" element={<Navigate to="/hospital/laboratory" replace />} />
              <Route path="laboratory/results" element={<Navigate to="/hospital/laboratory" replace />} />
              <Route path="billing" element={
                <PermissionGuard anyPermissions={[PERMISSIONS.INVOICE_VIEW, PERMISSIONS.PAYMENT_CREATE]}>
                  <ManageInvoices />
                </PermissionGuard>
              } />
              <Route path="payments" element={<Navigate to="/hospital/billing" replace />} />
              <Route path="reports" element={
                <PermissionGuard anyPermissions={[PERMISSIONS.REPORT_VIEW]}>
                  <ManageReports />
                </PermissionGuard>
              } />
              <Route path="users" element={<ManageRoles />} />
              <Route path="staff" element={<BusinessEmployeesPage />} />
              <Route path="audit" element={
                <PermissionGuard anyPermissions={[PERMISSIONS.AUDIT_VIEW]}>
                  <BusinessAuditLogsPage />
                </PermissionGuard>
              } />
              <Route path="settings" element={<Navigate to="/business/settings" replace />} />
              {/* Redirections legacy */}
              <Route path="admin" element={<Navigate to="/hospital/dashboard" replace />} />
              <Route path="admin/:section" element={<LegacyHospitalAdminRedirect />} />
            </Route>

            {/* Module Hôtel — PMS MVP */}
            <Route path="/hotel" element={<BusinessLayout />}>
              <Route index element={<Navigate to="/hotel/dashboard" replace />} />
              <Route path="dashboard" element={<HotelDashboard />} />
              <Route path="company" element={<HotelCompany />} />
              <Route path="room-types" element={<ManageRoomTypes />} />
              <Route path="rooms" element={<ManageRooms />} />
              <Route path="rates" element={<ManageRates />} />
              <Route path="reservations" element={<ManageReservations view="list" listPath="/hotel/reservations" createPath="/hotel/reservations/new" />} />
              <Route path="reservations/new" element={<ManageReservations view="create" listPath="/hotel/reservations" createPath="/hotel/reservations/new" />} />
              <Route path="messages" element={<HotelClientMessages />} />
              <Route path="reschedules" element={<HotelClientReschedules />} />
              <Route path="reservation-settings" element={<HotelReservationSettings focus="all" />} />
              <Route path="stays" element={<ManageStays />} />
              <Route path="guests" element={<ManageGuests />} />
              <Route path="services" element={<ManageHotelServices />} />
              <Route path="housekeeping" element={<ManageHousekeeping />} />
              <Route path="maintenance" element={<ManageMaintenance />} />
              <Route path="cashier" element={<HotelCashierDashboard />} />
              <Route path="folios" element={<CashierFolios />} />
              <Route path="invoices" element={<ManageHotelInvoices />} />
              <Route path="reports" element={<HotelReports />} />
              <Route path="audit" element={<BusinessAuditLogsPage />} />
              <Route path="front-desk/arrivals" element={<FrontDeskArrivals />} />
              <Route path="front-desk/departures" element={<FrontDeskDepartures />} />
              <Route path="front-desk/stays" element={<Navigate to="/hotel/stays" replace />} />
              <Route path="calendar" element={<HotelCalendar />} />
              <Route path="users" element={<ManageRoles />} />
              <Route path="staff" element={<BusinessEmployeesPage />} />
              <Route path="settings" element={<Navigate to="/business/settings" replace />} />
              <Route path="subscription" element={<BusinessSubscriptionPage />} />
            </Route>

            {/* Module Pharmacie de gros — même logique que /hospital */}
            <Route path="/wholesale-pharmacy" element={<BusinessLayout />}>
              <Route index element={<Navigate to="/wholesale-pharmacy/dashboard" replace />} />
              <Route path="dashboard" element={<WholesaleDashboard />} />
              <Route path="company" element={<WholesaleCompany />} />
              <Route path="catalog" element={<WholesaleCatalog />} />
              <Route path="inventory" element={<WholesaleInventory />} />
              <Route path="orders" element={<WholesaleOrders />} />
              <Route path="orders/:id" element={<WholesaleOrders />} />
              <Route path="clients" element={<WholesaleClients />} />
              <Route path="clients/:clientKey" element={<WholesaleClients />} />
              <Route path="history" element={<WholesaleHistory />} />
              <Route path="audit" element={<BusinessAuditLogsPage />} />
              <Route path="settings" element={<BusinessSettingsPage />} />
              <Route path="subscription" element={<BusinessSubscriptionPage />} />
              {/* Espace client — pharmacie de détail */}
              <Route path="client" element={<Navigate to="/wholesale-pharmacy/client/dashboard" replace />} />
              <Route path="client/dashboard" element={<WholesaleDashboard clientMode />} />
              <Route path="client/catalog" element={<WholesaleCatalog clientMode />} />
              <Route path="client/cart" element={<WholesaleCart />} />
              <Route path="client/proforma" element={<WholesaleProforma />} />
              <Route path="client/orders" element={<WholesaleOrders clientMode />} />
              <Route path="client/orders/:id" element={<WholesaleOrders clientMode />} />
              <Route path="client/company" element={<WholesaleClientCompany />} />
              <Route path="client/notifications" element={<Notifications />} />
              <Route path="client/profile" element={<UserProfilePage />} />
            </Route>

            <Route path="/retail-pharmacy" element={<BusinessLayout />}>
              <Route index element={<Navigate to="/retail-pharmacy/dashboard" replace />} />
              <Route path="dashboard" element={<RetailDashboard />} />
              <Route path="company" element={<RetailCompany />} />
              <Route path="catalog" element={<RetailCatalog />} />
              <Route path="inventory" element={<RetailInventory />} />
              <Route path="prescriptions" element={<RetailPrescriptions />} />
              <Route path="orders" element={<RetailOrders />} />
              <Route path="orders/:id" element={<RetailOrders />} />
              <Route path="patients" element={<RetailPatients />} />
              <Route path="patients/:key" element={<RetailPatients />} />
              <Route path="proformas" element={<RetailProforma />} />
              <Route path="history" element={<RetailHistory />} />
              <Route path="audit" element={<BusinessAuditLogsPage />} />
              <Route path="settings" element={<BusinessSettingsPage />} />
              <Route path="subscription" element={<BusinessSubscriptionPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'BUSINESS_OWNER']} />}>
            <Route path="/retail-pharmacy/client" element={<BusinessLayout />}>
              <Route index element={<Navigate to="/retail-pharmacy/client/dashboard" replace />} />
              <Route path="dashboard" element={<RetailDashboard clientMode />} />
              <Route path="catalog" element={<RetailCatalog clientMode />} />
              <Route path="cart" element={<RetailCart />} />
              <Route path="proforma" element={<RetailProforma clientMode />} />
              <Route path="orders" element={<RetailOrders clientMode />} />
              <Route path="orders/:id" element={<RetailOrders clientMode />} />
              <Route path="prescriptions" element={<RetailPrescriptions clientMode />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<UserProfilePage />} />
            </Route>
          </Route>

          {/* Espace personnel hospitalier — professionnels uniquement */}
          <Route element={
            <ProtectedRoute
              allowedRoles={ZONE_ACCESS.hospitalStaff.allowedRoles}
              forbiddenRoles={ZONE_ACCESS.hospitalStaff.forbiddenRoles}
            />
          }>
            <Route element={<HospitalStaffLayout />}>
              <Route path="/hospital/staff/receptionist" element={<ReceptionistDashboard />} />
              <Route path="/hospital/staff/lab-technician" element={<LabTechnicianDashboard />} />
              <Route path="/hospital/staff/doctor" element={<DoctorDashboard />} />
              <Route path="/hospital/staff/nurse" element={<NurseDashboard />} />
              <Route path="/hospital/staff/cashier" element={<HospitalCashierDashboard />} />
            </Route>
          </Route>

          {/* Ancien portail staff hôtel → redirection PMS (/hotel/*) filtrée par droits */}
          <Route element={
            <ProtectedRoute
              allowedRoles={ZONE_ACCESS.hotelStaff.allowedRoles}
              forbiddenRoles={ZONE_ACCESS.hotelStaff.forbiddenRoles}
            />
          }>
            <Route path="/hotel/staff/*" element={<HotelStaffLayout />} />
          </Route>

          {/* Super Admin plateforme — exclusif */}
          <Route element={
            <ProtectedRoute
              allowedRoles={ZONE_ACCESS.platformAdmin.allowedRoles}
              forbiddenRoles={ZONE_ACCESS.platformAdmin.forbiddenRoles}
            />
          }>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="businesses" element={<AdminBusinessesPage />} />
              <Route path="professionals" element={<AdminProfessionalsPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="locations" element={<AdminLocationsPage />} />
              <Route path="services" element={<AdminServicesPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="roles" element={<AdminPlatformRolesPage />} />
              <Route path="moderation" element={<AdminModerationPage />} />
              <Route path="support" element={<AdminSupportPage />} />
              <Route path="hotels" element={<AdminHotelsPage />} />
              <Route path="audit-logs" element={<AdminAuditLogsPage />} />
              <Route path="cms" element={<AdminCmsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
          </Route>


          <Route path="*" element={<div className="p-20 text-center text-2xl font-bold">404 - Page Not Found</div>} />
        </Routes>
      </BrowserRouter>
  );
}

export default App;

