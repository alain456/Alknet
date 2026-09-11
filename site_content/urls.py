from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    public_site_content,
    public_content_page,
    public_contact_submit,
    SiteSettingsAdminView,
    FooterLinkViewSet,
    PartnerViewSet,
    ContentPageViewSet,
    ContactMessageAdminViewSet,
)

router = DefaultRouter()
router.register(r"admin/footer-links", FooterLinkViewSet, basename="cms-footer-links")
router.register(r"admin/partners", PartnerViewSet, basename="cms-partners")
router.register(r"admin/pages", ContentPageViewSet, basename="cms-pages")
router.register(r"admin/contact-messages", ContactMessageAdminViewSet, basename="cms-contact-messages")

urlpatterns = [
    path("public/", public_site_content, name="cms-public"),
    path("public/pages/<slug:slug>/", public_content_page, name="cms-public-page"),
    path("public/contact/", public_contact_submit, name="cms-public-contact"),
    path(
        "admin/settings/",
        SiteSettingsAdminView.as_view({"get": "list", "put": "update", "patch": "partial_update"}),
        name="cms-settings",
    ),
    path("", include(router.urls)),
]
