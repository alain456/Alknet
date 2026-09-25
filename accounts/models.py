import uuid
# pyrefly: ignore [missing-import]
from django.db import models
# pyrefly: ignore [missing-import]
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone

class CustomUserManager(BaseUserManager):
    @classmethod
    def normalize_email(cls, email):
        """Minuscules sur toute l'adresse — m@gmail.com ≠ ma@gmail.com restent distincts."""
        from .email_identity import normalize_login_email
        return normalize_login_email(email)

    def get_by_natural_key(self, username):
        """Login : correspondance email STRICTE (pas de préfixe / contains)."""
        from .email_identity import get_user_by_login_email
        user = get_user_by_login_email(username, queryset=self.get_queryset())
        if user is None:
            raise self.model.DoesNotExist(f'{self.model.__name__} matching email does not exist')
        return user

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('L\'adresse e-mail est obligatoire')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'SUPER_ADMIN')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Le Superuser doit avoir is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Le Superuser doit avoir is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('SUPER_ADMIN', 'Super Admin'),
        ('PLATFORM_FINANCE', 'Finance plateforme'),
        ('PLATFORM_MODERATION', 'Modération'),
        ('PLATFORM_SUPPORT', 'Support'),
        ('PLATFORM_CONTENT', 'Contenu'),
        ('CUSTOMER', 'Customer'),
        ('PROFESSIONAL', 'Professional'),
        ('BUSINESS_OWNER', 'Business Owner'),
    )


    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50, blank=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='CUSTOMER')
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"

    def get_full_name(self):
        """Returns the first_name plus the last_name, with a space in between."""
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name if full_name else self.email


class SocialIdentity(models.Model):
    """Lien compte Isoko Hub ↔ identité OAuth (Google / Facebook / GitHub)."""

    PROVIDER_CHOICES = (
        ('google', 'Google'),
        ('facebook', 'Facebook'),
        ('github', 'GitHub'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name='social_identities',
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, db_index=True)
    provider_user_id = models.CharField(max_length=191, db_index=True)
    email = models.EmailField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'provider_user_id'],
                name='uniq_social_provider_uid',
            ),
        ]
        verbose_name = 'Identité sociale'
        verbose_name_plural = 'Identités sociales'

    def __str__(self):
        return f'{self.provider}:{self.provider_user_id} → {self.user.email}'


class AuditLog(models.Model):
    STATUS_CHOICES = (
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('WARNING', 'Warning'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    user_email = models.CharField(max_length=255, db_index=True)
    user_role = models.CharField(max_length=50, blank=True, default='ANONYMOUS')
    action = models.CharField(max_length=100, db_index=True)
    resource = models.CharField(max_length=255, blank=True, default='')
    ip_address = models.CharField(max_length=45, blank=True, null=True)
    user_agent = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SUCCESS')
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {self.user_email} - {self.action} ({self.status})"


class PlatformRole(models.Model):
    """Rôle plateforme (finance, modération, support, contenu) et ses droits CRUD."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    permissions = models.JSONField(default=list, blank=True)
    is_locked = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Rôle plateforme'
        verbose_name_plural = 'Rôles plateforme'

    def __str__(self):
        return self.name

