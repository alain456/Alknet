import { lazyPage } from './shared/lazyPage';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import { ZONE_ACCESS } from './auth/roleAccess';
import PublicLayout from './layouts/PublicLayout';
import HospitalStaffLayout from './layouts/HospitalStaffLayout';
import TenantHome from './public/TenantHome';
import PermissionGuard from './auth/PermissionGuard';
import { PERMISSIONS } from './lib/permissions';
import AuthLayout from './layouts/AuthLayout';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import ForgotPasswordPage from './auth/ForgotPasswordPage';
import ResetPasswordPage from './auth/ResetPasswordPage';
import VerifyEmailPage from './auth/VerifyEmailPage';
import OAuthCallbackPage from './auth/OAuthCallbackPage';
import DashboardLayout from './layouts/DashboardLayout';
import BusinessLayout from './layouts/BusinessLayout';
import AdminLayout from './layouts/AdminLayout';

const load_public = () => import('./zones/public.js');
const SearchResultsPage = lazyPage(() => load_public().then((m) => ({ default: m.SearchResultsPage })));
const ServicesPage = lazyPage(() => load_public().then((m) => ({ default: m.ServicesPage })));
const BusinessesPage = lazyPage(() => load_public().then((m) => ({ default: m.BusinessesPage })));
const JobsPage = lazyPage(() => load_public().then((m) => ({ default: m.JobsPage })));
const BusinessRegistrationPage = lazyPage(() => load_public().then((m) => ({ default: m.BusinessRegistrationPage })));
const ContentPageView = lazyPage(() => load_public().then((m) => ({ default: m.ContentPageView })));
const BusinessClientHistoryPage = lazyPage(() => load_public().then((m) => ({ default: m.BusinessClientHistoryPage })));
const load_hospital = () => import('./zones/hospital.js');
const HospitalDirectory = lazyPage(() => load_hospital().then((m) => ({ default: m.HospitalDirectory })));
const HospitalProfile = lazyPage(() => load_hospital().then((m) => ({ default: m.HospitalProfile })));
const PublicAppointmentBooking = lazyPage(() => load_hospital().then((m) => ({ default: m.PublicAppointmentBooking })));
const ManageServices = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageServices })));
const ManageExams = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageExams })));
const ManageServiceCategories = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageServiceCategories })));
const ManageDoctors = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageDoctors })));
const ManageSchedules = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageSchedules })));
const ManageAppointments = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageAppointments })));
const ManageMedicalRecords = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageMedicalRecords })));
const ManageInvoices = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageInvoices })));
const ManageLabResults = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageLabResults })));
const HospitalDashboard = lazyPage(() => load_hospital().then((m) => ({ default: m.HospitalDashboard })));
const ManageReports = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageReports })));
const ManagePatients = lazyPage(() => load_hospital().then((m) => ({ default: m.ManagePatients })));
const PatientDetail = lazyPage(() => load_hospital().then((m) => ({ default: m.PatientDetail })));
const ManageAdmissions = lazyPage(() => load_hospital().then((m) => ({ default: m.ManageAdmissions })));
const LegacyHospitalAdminRedirect = lazyPage(() => load_hospital().then((m) => ({ default: m.LegacyHospitalAdminRedirect })));
const LabTechnicianDashboard = lazyPage(() => load_hospital().then((m) => ({ default: m.LabTechnicianDashboard })));
const DoctorDashboard = lazyPage(() => load_hospital().then((m) => ({ default: m.DoctorDashboard })));
const NurseDashboard = lazyPage(() => load_hospital().then((m) => ({ default: m.NurseDashboard })));
const HospitalCashierDashboard = lazyPage(() => load_hospital().then((m) => ({ default: m.HospitalCashierDashboard })));
const ReceptionistDashboard = lazyPage(() => load_hospital().then((m) => ({ default: m.ReceptionistDashboard })));
const load_hotel = () => import('./zones/hotel.js');
const HotelDashboard = lazyPage(() => load_hotel().then((m) => ({ default: m.HotelDashboard })));
const HotelCompany = lazyPage(() => load_hotel().then((m) => ({ default: m.HotelCompany })));
const ManageRoomTypes = lazyPage(() => load_hotel().then((m) => ({ default: m.ManageRoomTypes })));
const ManageRooms = lazyPage(() => load_hotel().then((m) => ({ default: m.ManageRooms })));
const ManageRates = lazyPage(() => load_hotel().then((m) => ({ default: m.ManageRates })));
const ManageReservations = lazyPage(() => load_hotel().then((m) => ({ default: m.ManageReservations })));
const ManageStays = lazyPage(() => load_hotel().then((m) => ({ default: m.ManageStays })));
const ManageGuests = lazyPage(() => load_hotel().then((m) => ({ default: m.ManageGuests })));
const ManageHotelServices = lazyPage(() => load_hotel().then((m) => ({ default: m.ManageHotelServices })));
const ManageHousekeeping = lazyPage(() => load_hotel().then((m) => ({ default: m.ManageHousekeeping })));
const ManageMaintenance = lazyPage(() => load_hotel().then((m) => ({ default: m.ManageMaintenance })));
const HotelReports = lazyPage(() => load_hotel().then((m) => ({ default: m.HotelReports })));
const FrontDeskArrivals = lazyPage(() => load_hotel().then((m) => ({ default: m.FrontDeskArrivals })));
const FrontDeskDepartures = lazyPage(() => load_hotel().then((m) => ({ default: m.FrontDeskDepartures })));
function HotelCashierRedirect({ section }) {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set('section', section);
  return <Navigate to={`/hotel/cashier?${next.toString()}`} replace />;
}
const HotelCashierDashboard = lazyPage(() => load_hotel().then((m) => ({ default: m.HotelCashierDashboard })));
const HotelReservationSettings = lazyPage(() => load_hotel().then((m) => ({ default: m.HotelReservationSettings })));
const HotelClientMessages = lazyPage(() => load_hotel().then((m) => ({ default: m.HotelClientMessages })));
const HotelClientReschedules = lazyPage(() => load_hotel().then((m) => ({ default: m.HotelClientReschedules })));
const HotelStaffLayout = lazyPage(() => load_hotel().then((m) => ({ default: m.HotelStaffLayout })));
const PublicHotels = lazyPage(() => load_hotel().then((m) => ({ default: m.PublicHotels })));
const PublicHotelBook = lazyPage(() => load_hotel().then((m) => ({ default: m.PublicHotelBook })));
const HotelCalendar = lazyPage(() => load_hotel().then((m) => ({ default: m.HotelCalendar })));
const load_restaurant = () => import('./zones/restaurant.js');
const RestaurantDashboard = lazyPage(() => load_restaurant().then((m) => ({ default: m.RestaurantDashboard })));
const RestaurantCompany = lazyPage(() => load_restaurant().then((m) => ({ default: m.RestaurantCompany })));
const RestaurantMenu = lazyPage(() => load_restaurant().then((m) => ({ default: m.RestaurantMenu })));
const RestaurantBookings = lazyPage(() => load_restaurant().then((m) => ({ default: m.RestaurantBookings })));
const PublicRestaurants = lazyPage(() => load_restaurant().then((m) => ({ default: m.PublicRestaurants })));
const PublicRestaurant = lazyPage(() => load_restaurant().then((m) => ({ default: m.PublicRestaurant })));
const load_account = () => import('./zones/account.js');
const UserDashboardPage = lazyPage(() => load_account().then((m) => ({ default: m.UserDashboardPage })));
const UserBookingsPage = lazyPage(() => load_account().then((m) => ({ default: m.UserBookingsPage })));
const UserProfilePage = lazyPage(() => load_account().then((m) => ({ default: m.UserProfilePage })));
const Notifications = lazyPage(() => load_account().then((m) => ({ default: m.Notifications })));
const PatientLabResults = lazyPage(() => load_account().then((m) => ({ default: m.PatientLabResults })));
const load_business = () => import('./zones/business.js');
const ManageRoles = lazyPage(() => load_business().then((m) => ({ default: m.ManageRoles })));
const BusinessDashboardPage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessDashboardPage })));
const BusinessEmployeesPage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessEmployeesPage })));
const BusinessProductsPage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessProductsPage })));
const BusinessOffersPage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessOffersPage })));
const BusinessOrdersPage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessOrdersPage })));
const BusinessBookingsPage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessBookingsPage })));
const BusinessProfilePage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessProfilePage })));
const BusinessSettingsPage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessSettingsPage })));
const BusinessSubscriptionPage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessSubscriptionPage })));
const BusinessAuditLogsPage = lazyPage(() => load_business().then((m) => ({ default: m.BusinessAuditLogsPage })));
const load_commerce = () => import('./zones/commerce.js');
const CommerceDashboard = lazyPage(() => load_commerce().then((m) => ({ default: m.CommerceDashboard })));
const CommerceCatalog = lazyPage(() => load_commerce().then((m) => ({ default: m.CommerceCatalog })));
const CommerceInventory = lazyPage(() => load_commerce().then((m) => ({ default: m.CommerceInventory })));
const CommerceOrders = lazyPage(() => load_commerce().then((m) => ({ default: m.CommerceOrders })));
const PublicShop = lazyPage(() => load_commerce().then((m) => ({ default: m.PublicShop })));
const load_education = () => import('./zones/education.js');
const EducationDirectory = lazyPage(() => load_education().then((m) => ({ default: m.EducationDirectory })));
const EducationEstablishment = lazyPage(() => load_education().then((m) => ({ default: m.EducationEstablishment })));
const EducationDashboard = lazyPage(() => load_education().then((m) => ({ default: m.EducationDashboard })));
const EducationAdmissions = lazyPage(() => load_education().then((m) => ({ default: m.EducationAdmissions })));
const UniversityStructure = lazyPage(() => load_education().then((m) => ({ default: m.UniversityStructure })));
const PublicSchoolEnrollment = lazyPage(() => load_education().then((m) => ({ default: m.PublicSchoolEnrollment })));
const EnrollmentDossier = lazyPage(() => load_education().then((m) => ({ default: m.EnrollmentDossier })));
const MyEnrollments = lazyPage(() => load_education().then((m) => ({ default: m.MyEnrollments })));
const SchoolAccounting = lazyPage(() => load_education().then((m) => ({ default: m.SchoolAccounting })));
const load_services = () => import('./zones/services.js');
const PublicProvider = lazyPage(() => load_services().then((m) => ({ default: m.PublicProvider })));
const PublicServiceOffer = lazyPage(() => load_services().then((m) => ({ default: m.PublicServiceOffer })));
const ServiceRequestFollow = lazyPage(() => load_services().then((m) => ({ default: m.ServiceRequestFollow })));
const ClientRequests = lazyPage(() => load_services().then((m) => ({ default: m.ClientRequests })));
const ProviderDashboard = lazyPage(() => load_services().then((m) => ({ default: m.ProviderDashboard })));
const ProviderProfile = lazyPage(() => load_services().then((m) => ({ default: m.ProviderProfile })));
const ProviderOffers = lazyPage(() => load_services().then((m) => ({ default: m.ProviderOffers })));
const ProviderTeam = lazyPage(() => load_services().then((m) => ({ default: m.ProviderTeam })));
const ProviderDocuments = lazyPage(() => load_services().then((m) => ({ default: m.ProviderDocuments })));
const ProviderInbox = lazyPage(() => load_services().then((m) => ({ default: m.ProviderInbox })));
const load_admin = () => import('./zones/admin.js');
const AdminDashboardPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminDashboardPage })));
const AdminAnalyticsPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminUsersPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminUsersPage })));
const AdminBusinessesPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminBusinessesPage })));
const AdminProfessionalsPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminProfessionalsPage })));
const AdminCategoriesPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminCategoriesPage })));
const AdminServicesPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminServicesPage })));
const AdminPaymentsPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminPaymentsPage })));
const AdminLocationsPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminLocationsPage })));
const AdminSettingsPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminSettingsPage })));
const AdminAuditLogsPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminAuditLogsPage })));
const AdminCmsPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminCmsPage })));
const AdminPlatformRolesPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminPlatformRolesPage })));
const AdminModerationPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminModerationPage })));
const AdminSupportPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminSupportPage })));
const AdminHotelsPage = lazyPage(() => load_admin().then((m) => ({ default: m.AdminHotelsPage })));
const load_pharmacy = () => import('./zones/pharmacy.js');
const WholesaleDashboard = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleDashboard })));
const WholesaleCatalog = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleCatalog })));
const WholesaleInventory = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleInventory })));
const WholesaleOrders = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleOrders })));
const WholesaleClients = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleClients })));
const WholesaleHistory = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleHistory })));
const WholesaleCompany = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleCompany })));
const WholesaleCart = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleCart })));
const WholesaleProforma = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleProforma })));
const WholesaleClientCompany = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleClientCompany })));
const PublicWholesaleCatalog = lazyPage(() => load_pharmacy().then((m) => ({ default: m.PublicWholesaleCatalog })));
const PublicRetailCatalog = lazyPage(() => load_pharmacy().then((m) => ({ default: m.PublicRetailCatalog })));
const RetailDashboard = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailDashboard })));
const RetailCatalog = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailCatalog })));
const RetailInventory = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailInventory })));
const RetailOrders = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailOrders })));
const RetailPatients = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailPatients })));
const RetailPrescriptions = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailPrescriptions })));
const RetailHistory = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailHistory })));
const RetailCashier = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailCashier })));
const WholesaleCashier = lazyPage(() => load_pharmacy().then((m) => ({ default: m.WholesaleCashier })));
const RetailCompany = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailCompany })));
const RetailProforma = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailProforma })));
const RetailCart = lazyPage(() => load_pharmacy().then((m) => ({ default: m.RetailCart })));

function App() {
  return (
    <BrowserRouter>
      <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<TenantHome />} />
            <Route path="search" element={<SearchResultsPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="services/providers/:id" element={<PublicProvider />} />
            <Route path="services/offers/:id" element={<PublicServiceOffer />} />
            <Route path="services/demandes/:token" element={<ServiceRequestFollow />} />
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
            <Route path="restaurants" element={<PublicRestaurants />} />
            <Route path="restaurants/:id/historique" element={<BusinessClientHistoryPage />} />
            <Route path="restaurants/:id" element={<PublicRestaurant />} />
            <Route path="education" element={<EducationDirectory />} />
            {/* `:source` = id EducationProfile (annuaire) ou id Business (liste générale) */}
            <Route path="education/establishment/:id" element={<EducationEstablishment />} />
            <Route path="education/inscription" element={<PublicSchoolEnrollment />} />
            <Route path="education/dossier" element={<EnrollmentDossier />} />
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
              <Route path="inscriptions" element={<MyEnrollments />} />
              <Route path="demandes" element={<ClientRequests />} />
              <Route path="demandes/:id" element={<ServiceRequestFollow authMode />} />
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
              <Route path="services" element={<Navigate to="/provider/offers" replace />} />
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
              <Route path="employees" element={<Navigate to="/commerce/dashboard" replace />} />
              <Route path="subscription" element={<BusinessSubscriptionPage />} />
              <Route path="audit" element={<BusinessAuditLogsPage />} />
            </Route>

            <Route path="/provider" element={<BusinessLayout />}>
              <Route index element={<Navigate to="/provider/dashboard" replace />} />
              <Route path="dashboard" element={<ProviderDashboard />} />
              <Route path="profile" element={<ProviderProfile />} />
              <Route path="offers" element={<ProviderOffers />} />
              <Route path="team" element={<ProviderTeam />} />
              <Route path="documents" element={<ProviderDocuments />} />
              <Route path="inbox" element={<ProviderInbox />} />
              <Route path="settings" element={<Navigate to="/business/settings" replace />} />
              <Route path="subscription" element={<BusinessSubscriptionPage />} />
              <Route path="audit" element={<BusinessAuditLogsPage />} />
            </Route>

            {/* Module Éducation — propriétaire de l'établissement */}
            <Route path="/education/dashboard" element={<BusinessLayout />}>
              <Route index element={<EducationDashboard />} />
              <Route path="ecole" element={<EducationDashboard />} />
              <Route path="admissions" element={<EducationAdmissions />} />
              <Route path="dossiers" element={<EducationAdmissions />} />
              <Route path="facultes" element={<UniversityStructure mode="faculties" />} />
              <Route path="programmes" element={<UniversityStructure mode="programs" />} />
              <Route path="profile" element={<Navigate to="/business/profile" replace />} />
              <Route path="settings" element={<Navigate to="/business/settings" replace />} />
              <Route path="employees" element={<Navigate to="/business/employees" replace />} />
              <Route path="roles" element={<Navigate to="/business/roles" replace />} />
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
              <Route path="folios" element={<HotelCashierRedirect section="encaisser" />} />
              <Route path="invoices" element={<HotelCashierRedirect section="factures" />} />
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

            <Route path="/restaurant" element={<BusinessLayout />}>
              <Route index element={<Navigate to="/restaurant/dashboard" replace />} />
              <Route path="dashboard" element={<RestaurantDashboard />} />
              <Route path="company" element={<RestaurantCompany />} />
              <Route path="menu" element={<RestaurantMenu />} />
              <Route path="bookings" element={<RestaurantBookings />} />
              <Route path="employees" element={<Navigate to="/restaurant/dashboard" replace />} />
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
              <Route path="cashier" element={<WholesaleCashier />} />
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
              <Route path="cashier" element={<RetailCashier />} />
              <Route path="history" element={<RetailHistory />} />
              <Route path="audit" element={<BusinessAuditLogsPage />} />
              <Route path="settings" element={<BusinessSettingsPage />} />
              <Route path="subscription" element={<BusinessSubscriptionPage />} />
            </Route>
          </Route>

          {/* Module Éducation — personnel (scolarité, direction pédagogique) */}
          <Route element={
            <ProtectedRoute
              allowedRoles={ZONE_ACCESS.educationStaff.allowedRoles}
              forbiddenRoles={ZONE_ACCESS.educationStaff.forbiddenRoles}
            />
          }>
            <Route path="/education/staff" element={<BusinessLayout />}>
              <Route index element={<Navigate to="/education/dashboard" replace />} />
              <Route path="profile" element={<Navigate to="/business/profile" replace />} />
              <Route path="settings" element={<Navigate to="/business/settings" replace />} />
            </Route>
            <Route path="/education/accounting" element={<BusinessLayout />}>
              <Route index element={<SchoolAccounting />} />
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

