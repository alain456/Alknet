from django.urls import path
from .views import OfferListView, MyBusinessOfferListView, ApplyToOfferView, MyBusinessOfferApplicationsView

urlpatterns = [
    path('', OfferListView.as_view(), name='offer-list-public'),
    path('my-business/', MyBusinessOfferListView.as_view(), name='my-business-offer-list-create'),
    path('<uuid:pk>/apply/', ApplyToOfferView.as_view(), name='offer-apply'),
    path('my-business/applications/', MyBusinessOfferApplicationsView.as_view(), name='my-business-applications-list'),
]
