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
    ("LEGAL", "Legal", "CGV", "/pages/cgv", 2),
    ("LEGAL", "Legal", "Privacy Policy", "/pages/privacy", 3),
    ("LEGAL", "Legal", "SLA", "/pages/sla", 4),
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
    ("terms", "Conditions d'utilisation", "PLACEHOLDER"),
    ("cgv", "Conditions générales de vente", "PLACEHOLDER"),
    ("privacy", "Politique de confidentialité", "PLACEHOLDER"),
    ("sla", "Engagement de service", "PLACEHOLDER"),
]


LEGAL_BODIES = {
    "terms": (
        "Conditions d'utilisation d'Isoko Hub.\n"
        "Le compte est personnel. Vous êtes responsable de votre mot de passe et des actions faites avec votre session.\n"
        "Les contenus que vous publiez (fiches, catalogues, dossiers) restent votre responsabilité. Vous garantissez qu'ils sont exacts et licites.\n"
        "Isoko Hub fournit le logiciel. Les prestations vendues (soins, chambres, produits) sont celles de l'établissement, pas de la plateforme.\n"
        "Vous pouvez résilier en cessant l'abonnement ou en demandant la suppression du compte. Les obligations de paiement déjà dues restent exigibles.\n"
        "Le logiciel, la marque et l'interface appartiennent à l'éditeur. Vous recevez un droit d'usage tant que l'abonnement est actif."
    ),
    "cgv": (
        "Conditions générales de vente de l'abonnement Isoko Hub.\n"
        "L'abonnement est souscrit par l'entreprise, en francs burundais, via BurundiPay. Il n'y a pas de prélèvement automatique par carte bancaire.\n"
        "Une formule d'essai est gratuite. À son échéance, l'accès métier reste ouvert pendant la période de grâce affichée, puis il est suspendu tant que le paiement n'est pas confirmé.\n"
        "La mise à niveau ou le retour à une formule inférieure se fait depuis la page Abonnement, au prochain paiement. Aucun passage silencieux au payant.\n"
        "La résiliation prend effet à la fin de la période déjà payée. Les données de l'établissement peuvent être exportées en JSON avant la fermeture.\n"
        "La responsabilité de l'éditeur est limitée au montant de l'abonnement des douze derniers mois, hors faute lourde."
    ),
    "privacy": (
        "Politique de confidentialité.\n"
        "Nous collectons les données de compte (identité, e-mail, téléphone), les données d'usage, et les données métier que vous saisissez (clients, réservations, dossiers de soin).\n"
        "Le bandeau de consentement concerne les traceurs du site public. La création d'un compte vaut base contractuelle pour les données nécessaires au service.\n"
        "Vous pouvez corriger votre profil, exporter vos données personnelles au format JSON, et demander la suppression du compte depuis votre profil.\n"
        "Les données de santé et d'hôtellerie sont accessibles uniquement aux rôles autorisés de l'établissement concerné.\n"
        "Nous ne vendons pas ces données. Elles sont conservées tant que le compte ou l'abonnement est actif, puis selon les obligations légales de facturation."
    ),
    "sla": (
        "Engagement de service (SLA).\n"
        "Cible de disponibilité de l'application : 99,5 % sur un mois calendaire, hors maintenance annoncée et hors panne des réseaux ou du prestataire de paiement.\n"
        "Une panne est un indisponibilité de l'API principale supérieure à 15 minutes.\n"
        "Compensation : si la cible n'est pas tenue, l'établissement concerné reçoit un avoir d'une période d'abonnement au prorata du temps d'arrêt constaté, sur demande au support dans les 15 jours.\n"
        "Les sauvegardes métier sont lancées chaque semaine. Elles ne remplacent pas une copie que vous gardez après export."
    ),
}


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
    else:
        for column, title, label, url, order in DEFAULT_FOOTER_LINKS:
            if column != "LEGAL":
                continue
            FooterLink.objects.get_or_create(
                url=url,
                defaults={
                    "column": column,
                    "column_title": title,
                    "label": label,
                    "display_order": order,
                    "is_active": True,
                },
            )
    for slug, title, body in DEFAULT_PAGES:
        page, created = ContentPage.objects.get_or_create(
            slug=slug,
            defaults={"title": title, "body": body, "is_published": True},
        )
        legal = LEGAL_BODIES.get(slug)
        if legal and (created or "managed by the Super Admin" in (page.body or "") or page.body == "PLACEHOLDER"):
            page.title = title
            page.body = legal
            page.is_published = True
            page.save(update_fields=["title", "body", "is_published"])
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
    """Boîte officielle du projet, plus les comptes Support (pas l’ancien Gmail personnel)."""
    official = (getattr(django_settings, "DEFAULT_FROM_EMAIL", "") or "info.isokohub@gmail.com").strip()
    from django.contrib.auth import get_user_model
    User = get_user_model()
    extras = list(
        User.objects.filter(role='PLATFORM_SUPPORT', is_active=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )
    blocked = {'alaineucridegushakakwimana@gmail.com'}
    emails = [official, *extras]
    return list(dict.fromkeys(
        e.strip() for e in emails if e and str(e).strip() and e.strip().lower() not in blocked
    ))


def notify_super_admins_contact(msg: ContactMessage):
    """Notifie Super Admin + Support d’un nouveau message Contact Us."""
    recipients = _platform_inbox_emails()
    if not recipients:
        return {"status": "SKIPPED", "reason": "Aucun email Support / Super Admin"}

    subject = f"Contact Isoko Hub : {msg.subject}"
    body = (
        f"Bonjour,\n\n"
        f"{msg.name} a écrit depuis la page Contact.\n"
        f"Email : {msg.email}\n"
        f"Téléphone : {msg.phone or '—'}\n"
        f"Objet : {msg.subject}\n\n"
        f"{msg.message}\n\n"
        f"Reçu le {timezone.localtime(msg.created_at).strftime('%d/%m/%Y %H:%M')}.\n"
        f"Répondez dans Isoko Hub, menu Support.\n"
    )
    try:
        from accounts.outbound_mail import send_isoko_mail
        send_isoko_mail(subject, body, recipients, reply_to=msg.email)
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
            f"Isoko Hub\n"
            f"info.isokohub@gmail.com\n"
        )
        try:
            from accounts.outbound_mail import send_isoko_mail
            send_isoko_mail(subject, mail_body, [msg.email], reply_to="info.isokohub@gmail.com")
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
