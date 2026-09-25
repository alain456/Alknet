from django.conf import settings
from django.db import models
from django.utils import timezone
import uuid


class SiteSettings(models.Model):
    """Singleton — contenu Home + identité footer gérés par le Super Admin."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    brand_name = models.CharField(max_length=120, default="Isoko Hub")
    platform_logo = models.TextField(
        blank=True,
        help_text="URL ou image Base64 du logo plateforme (header/footer)",
    )
    services_page_title = models.CharField(max_length=150, default="Find Services")
    services_page_subtitle = models.CharField(
        max_length=255,
        default="Discover trusted professionals for any job",
    )
    footer_tagline = models.TextField(
        default="Everything you need, in one platform. Connecting Burundi to the world."
    )
    footer_copyright = models.CharField(
        max_length=255,
        blank=True,
        default="© Isoko Hub. All rights reserved.",
    )
    # Footer « Tea Circle » style — dynamiques via CMS
    footer_headline = models.CharField(
        max_length=255,
        blank=True,
        default="Tout ce dont vous avez besoin — en une seule plateforme.",
        help_text="Grand titre en haut du footer",
    )
    footer_newsletter_title = models.CharField(
        max_length=120, blank=True, default="Restez informé !",
    )
    footer_newsletter_placeholder = models.CharField(
        max_length=120, blank=True, default="Votre email",
    )
    footer_newsletter_button = models.CharField(
        max_length=80, blank=True, default="S'abonner",
    )
    footer_show_newsletter = models.BooleanField(default=True)
    footer_contact_email = models.EmailField(blank=True, default="support@isokohub.com")
    footer_contact_phone = models.CharField(max_length=50, blank=True, default="")
    footer_contact_title = models.CharField(
        max_length=80, blank=True, default="Contact information",
    )
    footer_follow_title = models.CharField(
        max_length=80, blank=True, default="Follow us",
    )
    # [{"network":"facebook","url":"https://..."}, ...]
    footer_social_links = models.JSONField(default=list, blank=True)

    # Page Contact Us (design type Kassapay)
    contact_hero_subtitle = models.CharField(
        max_length=255,
        blank=True,
        default='Isoko Hub est prêt à vous accompagner selon vos besoins.',
    )
    contact_hero_image = models.TextField(
        blank=True,
        default='',
        help_text='URL ou image base64 du hero Contact Us.',
    )
    contact_intro = models.TextField(
        blank=True,
        default=(
            'Une question sur la plateforme, un partenariat ou un besoin support ? '
            'Écrivez-nous — l’équipe Super Admin vous répondra.'
        ),
    )
    contact_office_address = models.CharField(
        max_length=255,
        blank=True,
        default='Bujumbura, Burundi',
    )
    contact_google_maps_url = models.TextField(
        blank=True,
        default='',
        help_text='Lien Google Maps (partage ou embed) pour la carte Contact Us.',
    )
    contact_map_lat = models.CharField(max_length=20, blank=True, default='-3.3731')
    contact_map_lng = models.CharField(max_length=20, blank=True, default='29.9189')

    hero_title = models.TextField(default="Everything you need,\nin one platform.")
    hero_subtitle = models.TextField(
        default="Find trusted professionals, book services, order from the best businesses, and discover new opportunities in Burundi."
    )
    hero_cta_primary_label = models.CharField(max_length=120, default="Créer une Entreprise")
    hero_cta_primary_url = models.CharField(max_length=255, default="/register-business")
    hero_cta_secondary_label = models.CharField(max_length=120, default="Explore Services")
    hero_cta_secondary_url = models.CharField(max_length=255, default="/services")
    search_placeholder = models.CharField(
        max_length=255,
        default="Profession, Business, Restaurant, Product...",
    )
    search_location_placeholder = models.CharField(max_length=120, default="Location")

    categories_title = models.CharField(max_length=150, default="Explore Categories")
    professionals_title = models.CharField(max_length=150, default="Featured Professionals")
    health_title = models.CharField(max_length=150, default="Établissements de Santé")
    businesses_title = models.CharField(max_length=150, default="Top Businesses")
    services_title = models.CharField(max_length=150, default="Popular Services")
    why_title = models.CharField(max_length=150, default="Why choose Isoko Hub?")
    why_items = models.JSONField(default=list, blank=True)
    app_banner_title = models.CharField(max_length=200, default="Take Isoko Hub everywhere")
    app_banner_subtitle = models.TextField(
        default="The official Isoko Hub mobile app is currently under development."
    )
    app_banner_badge = models.CharField(max_length=80, default="COMING SOON")

    show_categories = models.BooleanField(default=True)
    show_professionals = models.BooleanField(default=True)
    show_health = models.BooleanField(default=True)
    show_businesses = models.BooleanField(default=True)
    show_services = models.BooleanField(default=True)
    show_why = models.BooleanField(default=True)
    show_app_banner = models.BooleanField(default=True)
    show_partners = models.BooleanField(default=True)

    platform_fee_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=10,
        help_text="Commission plateforme (%)",
    )
    tax_rate_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=18,
        help_text="Taux TVA par défaut (%)",
    )
    currency = models.CharField(max_length=10, default="BIF")
    auto_approve_businesses = models.BooleanField(
        default=False,
        help_text="Approuver automatiquement les nouvelles entreprises",
    )
    maintenance_mode = models.BooleanField(
        default=False,
        help_text="Mode maintenance — seuls les Super Admin se connectent",
    )
    password_min_length = models.PositiveSmallIntegerField(
        default=8,
        help_text="Longueur minimale des mots de passe (modifiable par Super Admin)",
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Paramètres du site"
        verbose_name_plural = "Paramètres du site"

    def __str__(self):
        return f"SiteSettings ({self.brand_name})"

    @classmethod
    def get_solo(cls):
        obj = cls.objects.first()
        if obj:
            return obj
        return cls.objects.create(
            why_items=[
                {
                    "title": "Verified Professionals",
                    "description": "Every service provider is vetted for quality and reliability.",
                    "icon": "CheckCircle2",
                },
                {
                    "title": "Secure Payments",
                    "description": "Your funds are protected until the service is delivered.",
                    "icon": "ShieldCheck",
                },
                {
                    "title": "Trusted Businesses",
                    "description": "Find the best local businesses rated by the community.",
                    "icon": "Briefcase",
                },
                {
                    "title": "AI Recommendations",
                    "description": "Our smart algorithm finds exactly what you are looking for.",
                    "icon": "Laptop",
                },
            ]
        )


class FooterLink(models.Model):
    COLUMN_CHOICES = (
        ("COMPANY", "Company"),
        ("SUPPORT", "Support"),
        ("LEGAL", "Legal"),
        ("OTHER", "Other"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    column = models.CharField(max_length=20, choices=COLUMN_CHOICES, default="COMPANY")
    column_title = models.CharField(max_length=80, blank=True)
    label = models.CharField(max_length=120)
    url = models.CharField(max_length=500)
    open_in_new_tab = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["column", "display_order", "label"]

    def __str__(self):
        return f"{self.column}: {self.label}"


class Partner(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    logo = models.TextField(blank=True)
    website_url = models.URLField(blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name


class ContentPage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=120, unique=True)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


class ContactMessage(models.Model):
    """Message public « Contact Us » — Support / Super Admin."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True)
    subject = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    admin_notes = models.TextField(blank=True)
    reply_body = models.TextField(blank=True, help_text='Dernière réponse envoyée au client')
    replied_at = models.DateTimeField(null=True, blank=True)
    replied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='contact_replies',
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Message de contact"
        verbose_name_plural = "Messages de contact"

    def __str__(self):
        return f"{self.subject} — {self.email}"
