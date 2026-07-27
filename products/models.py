import uuid
from django.db import models
from businesses.models import Business
from product_categories.models import ProductCategory
from django.utils import timezone

class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='products')
    category = models.ForeignKey(ProductCategory, on_delete=models.SET_NULL, null=True, related_name='products')
    
    name = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    stock = models.IntegerField(default=0)
    
    image_urls = models.JSONField(default=list, blank=True)
    variants = models.JSONField(default=dict, blank=True, help_text="e.g. {'colors': ['red', 'blue'], 'sizes': ['S', 'M']}")
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
