from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'profile', views.HotelProfileViewSet, basename='hotel-profile')
router.register(r'departments', views.HotelDepartmentViewSet, basename='hotel-departments')
router.register(r'room-types', views.RoomTypeViewSet, basename='hotel-room-types')
router.register(r'rooms', views.RoomViewSet, basename='hotel-rooms')
router.register(r'rates', views.RatePlanViewSet, basename='hotel-rates')
router.register(r'guests', views.GuestViewSet, basename='hotel-guests')
router.register(r'reservations', views.ReservationViewSet, basename='hotel-reservations')
router.register(r'stays', views.StayViewSet, basename='hotel-stays')
router.register(r'services', views.HotelServiceViewSet, basename='hotel-services')
router.register(r'folios', views.FolioViewSet, basename='hotel-folios')
router.register(r'payments', views.PaymentViewSet, basename='hotel-payments')
router.register(r'invoices', views.HotelInvoiceViewSet, basename='hotel-invoices')
router.register(r'housekeeping', views.HousekeepingTaskViewSet, basename='hotel-housekeeping')
router.register(r'maintenance', views.MaintenanceTicketViewSet, basename='hotel-maintenance')
router.register(r'audit', views.HotelAuditLogViewSet, basename='hotel-audit')
router.register(r'cash-closings', views.CashClosingViewSet, basename='hotel-cash-closings')

urlpatterns = [
    path('availability/', views.availability, name='hotel-availability'),
    path('dashboard/', views.dashboard_stats, name='hotel-dashboard'),
    path('calendar/', views.occupancy_calendar, name='hotel-calendar'),
    path('reports/', views.hotel_reports, name='hotel-reports'),
    path('cashier-dashboard/', views.cashier_dashboard, name='hotel-cashier-dashboard'),
    path('staff-directory/', views.staff_directory, name='hotel-staff-directory'),
    path('platform/hotels/', views.platform_hotels, name='hotel-platform-list'),
    path('platform/hotels/<uuid:hotel_id>/status/', views.platform_hotel_suspend, name='hotel-platform-status'),
    path(
        'platform/hotels/<uuid:hotel_id>/verify-classification/',
        views.platform_hotel_verify_classification,
        name='hotel-platform-verify-classification',
    ),
    path('public/hotels/', views.public_hotels, name='hotel-public-list'),
    path('public/hotels/<uuid:hotel_id>/', views.public_hotel_detail, name='hotel-public-detail'),
    path('public/hotels/<uuid:hotel_id>/availability/', views.public_availability, name='hotel-public-availability'),
    path('public/hotels/<uuid:hotel_id>/book/', views.public_book, name='hotel-public-book'),
    path(
        'public/reservations/<uuid:reservation_id>/pay/',
        views.public_pay_reservation,
        name='hotel-public-pay',
    ),
    path(
        'public/reservations/<uuid:reservation_id>/confirm-payment/',
        views.public_confirm_reservation_payment,
        name='hotel-public-confirm-payment',
    ),
    path(
        'public/reservations/<uuid:reservation_id>/message/',
        views.public_reservation_message,
        name='hotel-public-reservation-message',
    ),
    path(
        'public/reservations/<uuid:reservation_id>/request-reschedule/',
        views.public_request_reschedule,
        name='hotel-public-request-reschedule',
    ),
    path('public/my-reservations/', views.my_reservations, name='hotel-my-reservations'),
    path('', include(router.urls)),
]
