import uuid
from django.db import models
from django.utils import timezone


class ModuleKey(models.TextChoices):
    """Module métier Dorsal/Front auquel une catégorie donne accès.

    Valeurs volontairement identiques aux clés renvoyées par
    ``categoryKeyFromLabels()`` (frontend/src/auth/roleAccess.js) pour que la
    donnée et le code parlent la même langue.
    """

    BUSINESS = 'business', 'Commerce générique'
    COMMERCE = 'commerce', 'Commerce / boutique en ligne'
    HOTEL = 'hotel', 'Hôtellerie (PMS)'
    RESTAURANT = 'restaurant', 'Restauration'
    HOSPITAL = 'hospital', 'Santé / hôpital'
    RETAIL_PHARMACY = 'retail_pharmacy', 'Pharmacie de détail'
    WHOLESALE = 'wholesale', 'Pharmacie de gros'
    EDUCATION = 'education', 'Éducation'
    SERVICES = 'services', 'Services et prestataires'


class BusinessCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=255, blank=True, help_text="Nom de l'icône ou URL")
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subcategories')

    # Clé de routage du module. Vide = non configuré : le frontend retombe alors
    # sur le matching par mots-clés (heritage), ce qui évite de casser les
    # catégories existantes tant qu'elles n'ont pas été revues.
    module = models.CharField(
        max_length=20,
        choices=ModuleKey.choices,
        blank=True,
        default='',
        help_text="Module métier activé pour cette catégorie.",
    )
    is_visible = models.BooleanField(
        default=True,
        help_text="Visible côté client (annuaire, inscription). Désactivé = brouillon admin.",
    )

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Business Categories"
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # À la création seulement : une sous-catégorie sans module explicite
        # hérite de son parent (« Pharmacie de gros » suit « Santé »).
        # Un parent générique n'exporte rien, sinon tout s'effondrerait sur
        # le dashboard business. Les catégories existantes gardent ainsi
        # leur valeur issue de la migration, sans réécriture surprise.
        if self._state.adding and not self.module:
            from .food_service import is_food_service_category
            if is_food_service_category(self):
                self.module = ModuleKey.RESTAURANT
            elif self.parent_id:
                parent_module = (
                    BusinessCategory.objects.filter(pk=self.parent_id)
                    .values_list('module', flat=True)
                    .first()
                )
                if parent_module and parent_module != ModuleKey.BUSINESS:
                    self.module = parent_module
        return super().save(*args, **kwargs)
