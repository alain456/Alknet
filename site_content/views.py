from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, authentication_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.conf import settings as django_settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
from permissions.custom_permissions import PlatformResourcePermission, PlatformMethodPermission
from .models import SiteSettings, FooterLink, Partner, ContentPage, ContactMessage
from .serializers import (
    SiteSettingsSerializer,
    FooterLinkSerializer,
    PartnerSerializer,
    ContentPageSerializer,
    ContentPagePublicSerializer,
    ContactMessageCreateSerializer,
    ContactMessageAdminSerializer,
)
import logging

logger = logging.getLogger(__name__)

DEFAULT_FOOTER_LINKS = [
    ("COMPANY", "Company", "About Us", "/pages/about", 1),
    ("COMPANY", "Company", "Careers", "/pages/careers", 2),
    ("SUPPORT", "Support", "Help Center", "/pages/help", 1),
    ("SUPPORT", "Support", "Contact Us", "/pages/contact", 2),
    ("LEGAL", "Legal", "Terms of Service", "/pages/terms", 1),
    ("LEGAL", "Legal", "Privacy Policy", "/pages/privacy", 2),
]

DEFAULT_PAGES = [
    ("about", "About Us", "Isoko Hub connects Burundi to trusted services, businesses and healthcare."),
    ("careers", "Careers", "Join the Isoko Hub team. Open roles will be listed here."),
    ("help", "Help Center", "Need help? Contact support or browse our guides."),
    (
        "contact",
        "Nous contacter",
        "Une question, une suggestion ou un partenariat ? Envoyez-nous un message via le formulaire ci-dessous. "
        "Notre équipe vous répondra dès que possible.",
    ),
    ("terms", "Terms of Service", "Terms of service content managed by the Super Admin."),
    ("privacy", "Privacy Policy", "Privacy policy content managed by the Super Admin."),
]


def ensure_defaults():
    settings = SiteSettings.get_solo()
    if not FooterLink.objects.exists():
        for column, title, label, url, order in DEFAULT_FOOTER_LINKS:
            FooterLink.objects.create(
                column=column,
                column_title=title,
                label=label,
                url=url,
                display_order=order,
                is_active=True,
            )
    for slug, title, body in DEFAULT_PAGES:
        ContentPage.objects.get_or_create(
            slug=slug,
            defaults={"title": title, "body": body, "is_published": True},
        )
    return settings


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _super_admin_emails():
    User = get_user_model()
    emails = list(
        User.objects.filter(role="SUPER_ADMIN", is_active=True)
        .exclude(email="")
        .values_list("email", flat=True)
    )
    fallback = (getattr(django_settings, "DEFAULT_FROM_EMAIL", "") or "").strip()
    if fallback and fallback not in emails:
        emails.append(fallback)
    return [e for e in emails if e]


def _platform_inbox_emails():
    """Super Admin + acteurs Support (PLATFORM_SUPPORT)."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    emails = list(
        User.objects.filter(
            role__in=('SUPER_ADMIN', 'PLATFORM_SUPPORT'),
            is_active=True,
        ).exclude(email='').values_list('email', flat=True)
    )
    # Fallback DEFAULT_FROM / CONTACT
    emails = list(dict.fromkeys([e.strip() for e in emails if e and str(e).strip()]))
    if not emails:
        return _super_admin_emails()
    return emails


def notify_super_admins_contact(msg: ContactMessage):
    """Notifie Super Admin + Support d’un nouveau message Contact Us."""
    recipients = _platform_inbox_emails()
    if not recipients:
        return {"status": "SKIPPED", "reason": "Aucun email Support / Super Admin"}

    subject = f"[Isoko Hub] Contact : {msg.subject}"
    body = (
        f"Nouveau message depuis la page Contact Us.\n\n"
        f"Nom : {msg.name}\n"
        f"Email : {msg.email}\n"
        f"Téléphone : {msg.phone or '—'}\n"
        f"Objet : {msg.subject}\n\n"
        f"Message :\n{msg.message}\n\n"
        f"— Reçu le {timezone.localtime(msg.created_at).strftime('%d/%m/%Y %H:%M')}\n"
        f"Répondre dans l’admin : /admin/support\n"
    )
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(django_settings, "DEFAULT_FROM_EMAIL", "noreply@isokohub.bi"),
            recipient_list=recipients,
            fail_silently=False,
        )
        return {"status": "SENT", "recipients": recipients}
    except Exception as exc:
        logger.exception("Échec email contact message %s", msg.id)
        return {"status": "FAILED", "error": str(exc), "recipients": recipients}


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_site_content(request):
    settings = ensure_defaults()
    footer_links = FooterLink.objects.filter(is_active=True)
    partners = Partner.objects.filter(is_active=True)
    return Response({
        "settings": SiteSettingsSerializer(settings).data,
        "footer_links": FooterLinkSerializer(footer_links, many=True).data,
        "partners": PartnerSerializer(partners, many=True).data,
    })


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_content_page(request, slug):
    page = ContentPage.objects.filter(slug=slug, is_published=True).first()
    if not page:
        return Response({"detail": "Page introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(ContentPagePublicSerializer(page).data)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_contact_submit(request):
    """Formulaire public Contact Us → enregistrement + email Super Admin."""
    serializer = ContactMessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    ip = _client_ip(request)
    if ip:
        recent = ContactMessage.objects.filter(
            ip_address=ip,
            created_at__gte=timezone.now() - timedelta(hours=1),
        ).count()
        if recent >= 5:
            return Response(
                {"detail": "Trop de messages envoyés. Réessayez plus tard."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

    msg = serializer.save(ip_address=ip)
    email_result = notify_super_admins_contact(msg)
    return Response(
        {
            "message": "Votre message a bien été envoyé. Nous vous répondrons bientôt.",
            "id": str(msg.id),
            "email_notification": email_result,
        },
        status=status.HTTP_201_CREATED,
    )


class SiteSettingsAdminView(viewsets.ViewSet):
    permission_classes = [PlatformResourcePermission]
    platform_resource = 'cms'

    def list(self, request):
        settings = ensure_defaults()
        return Response(SiteSettingsSerializer(settings).data)

    def partial_update(self, request, pk=None):
        settings = ensure_defaults()
        serializer = SiteSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def update(self, request, pk=None):
        return self.partial_update(request, pk)


class FooterLinkViewSet(viewsets.ModelViewSet):
    serializer_class = FooterLinkSerializer
    permission_classes = [PlatformResourcePermission]
    platform_resource = 'cms'
    queryset = FooterLink.objects.all()


class PartnerViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerSerializer
    permission_classes = [PlatformResourcePermission]
    platform_resource = 'cms'
    queryset = Partner.objects.all()


class ContentPageViewSet(viewsets.ModelViewSet):
    serializer_class = ContentPageSerializer
    permission_classes = [PlatformResourcePermission]
    platform_resource = 'cms'
    queryset = ContentPage.objects.all()
    lookup_field = "slug"


class ContactMessageAdminViewSet(viewsets.ModelViewSet):
    """Boîte de réception Support / Super Admin pour Contact Us."""

    serializer_class = ContactMessageAdminSerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        "GET": ("platform.cms.view", "platform.users.view"),
        "HEAD": ("platform.cms.view", "platform.users.view"),
        "OPTIONS": ("platform.cms.view", "platform.users.view"),
        # Support a users.view (sans cms.update pages) — peut lire/répondre/marquer lu
        "POST": ("platform.cms.update", "platform.users.view"),
        "PATCH": ("platform.cms.update", "platform.users.view"),
        "PUT": ("platform.cms.update", "platform.users.view"),
        "DELETE": "platform.cms.delete",
    }
    queryset = ContactMessage.objects.all()
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        unread = qs.filter(is_read=False).count()
        data = self.get_serializer(qs[:200], many=True).data
        return Response({"unread_count": unread, "results": data})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        msg = self.get_object()
        msg.is_read = True
        msg.save(update_fields=["is_read", "updated_at"])
        return Response(self.get_serializer(msg).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        updated = ContactMessage.objects.filter(is_read=False).update(is_read=True)
        return Response({"updated": updated})

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        """Envoie une réponse email au client et journalise le suivi."""
        msg = self.get_object()
        body = (request.data.get("body") or request.data.get("reply") or request.data.get("message") or "").strip()
        if len(body) < 3:
            return Response(
                {"detail": "Réponse trop courte (min. 3 caractères)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        notes = (request.data.get("admin_notes") or msg.admin_notes or "").strip()
        subject = f"Re: {msg.subject}"
        mail_body = (
            f"Bonjour {msg.name},\n\n"
            f"{body}\n\n"
            f"— L’équipe Isoko Hub\n\n"
            f"---\nVotre message du "
            f"{timezone.localtime(msg.created_at).strftime('%d/%m/%Y %H:%M')} :\n"
            f"{msg.message}\n"
        )
        try:
            send_mail(
                subject=subject,
                message=mail_body,
                from_email=getattr(django_settings, "DEFAULT_FROM_EMAIL", "noreply@isokohub.bi"),
                recipient_list=[msg.email],
                fail_silently=False,
            )
        except Exception as exc:
            logger.exception("Échec reply contact %s", msg.id)
            return Response(
                {"detail": f"Envoi impossible : {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        msg.reply_body = body
        msg.replied_at = timezone.now()
        msg.replied_by = request.user if request.user.is_authenticated else None
        msg.is_read = True
        if notes:
            msg.admin_notes = notes
        msg.save(update_fields=[
            "reply_body", "replied_at", "replied_by", "is_read", "admin_notes", "updated_at",
        ])
        return Response({
            **self.get_serializer(msg).data,
            "message": f"Réponse envoyée à {msg.email}.",
        })
