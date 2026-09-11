import uuid
from django.db import models
from businesses.models import Business
from product_categories.models import ProductCategory
from django.utils import timezone


class ShopCategory(models.Model):
    """Catégorie de catalogue propre à une boutique (Homme, Outillage, …)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='shop_categories')
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140)
    description = models.TextField(blank=True, default='')
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['sort_order', 'name']
        constraints = [
            models.UniqueConstraint(fields=['business', 'slug'], name='uniq_shop_category_slug'),
        ]

    def __str__(self):
        return f'{self.name} ({self.business.name})'


class Product(models.Model):
    """
    Produit catalogue — vertical Commerce (Boutique, Mode, Quincaillerie, …).
    Le stock fin se gère surtout au niveau ProductVariant (taille/couleur).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='products')
    category = models.ForeignKey(
        ProductCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='products',
    )
    shop_category = models.ForeignKey(
        'ShopCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='products',
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    sku = models.CharField(max_length=80, blank=True, default='')
    price = models.DecimalField(max_digits=14, decimal_places=2)
    discount_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='BIF')

    # Stock agrégé (produit sans variantes, ou somme des variantes)
    stock = models.IntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)

    image_urls = models.JSONField(default=list, blank=True)
    # Axes possibles (UI) : {"sizes": ["S","M"], "colors": ["Rouge","Bleu"]}
    variants = models.JSONField(default=dict, blank=True)
    # Attributs libres (matériau, marque, …)
    extra_attributes = models.JSONField(default=dict, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def effective_price(self):
        if self.discount_price is not None:
            return self.discount_price
        return self.price

    @property
    def has_variants(self):
        return self.variant_rows.filter(is_active=True).exists()

    def stock_available(self):
        if self.has_variants:
            return sum(v.stock for v in self.variant_rows.filter(is_active=True))
        return max(0, self.stock)


class ProductVariant(models.Model):
    """Variante stockable (taille / couleur) — MVP Commerce."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variant_rows')
    sku = models.CharField(max_length=80, blank=True, default='')
    size = models.CharField(max_length=60, blank=True, default='')
    color = models.CharField(max_length=60, blank=True, default='')
    stock = models.IntegerField(default=0)
    price_override = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['size', 'color']
        constraints = [
            models.UniqueConstraint(
                fields=['product', 'size', 'color'],
                name='uniq_product_size_color',
            ),
        ]

    def __str__(self):
        label = ' / '.join(p for p in (self.size, self.color) if p) or 'Standard'
        return f'{self.product.name} — {label}'

    @property
    def unit_price(self):
        if self.price_override is not None:
            return self.price_override
        return self.product.effective_price

    @property
    def label(self):
        parts = [p for p in (self.size, self.color) if p]
        return ' / '.join(parts) if parts else 'Standard'


class StockMovement(models.Model):
    MOVEMENT_CHOICES = (
        ('IN', 'Entrée'),
        ('OUT', 'Sortie'),
        ('ADJUST', 'Ajustement'),
        ('SALE', 'Vente'),
        ('CANCEL', 'Annulation vente'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='stock_movements')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_movements')
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements',
    )
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_CHOICES)
    quantity = models.IntegerField(help_text='Positif = entrée, négatif = sortie (sauf ADJUST absolu)')
    note = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
