from django.db import transaction
from django.utils.text import slugify
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.commerce import is_commerce_business
from businesses.models import BusinessEmployee
from businesses.tenant import get_user_tenant_business

from .models import Product, ProductVariant, ShopCategory, StockMovement
from .serializers import (
    AdminProductSerializer, ProductSerializer, ProductVariantSerializer,
    ShopCategorySerializer, StockMovementSerializer,
)


def _user_business(user, business_id=None):
    if business_id:
        from businesses.models import Business
        biz = Business.objects.filter(id=business_id).first()
        if not biz:
            return None
        if user.role == 'BUSINESS_OWNER' and biz.owner_id == user.id:
            return biz
        if BusinessEmployee.objects.filter(user=user, business=biz, is_active=True).exists():
            return biz
        return None
    return get_user_tenant_business(user)


def _can_manage(user, business) -> bool:
    if not user or not user.is_authenticated or not business:
        return False
    if user.role == 'BUSINESS_OWNER' and business.owner_id == user.id:
        return True
    return BusinessEmployee.objects.filter(user=user, business=business, is_active=True).exists()


class CanManageProducts(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class ProductListView(generics.ListAPIView):
    """Catalogue public — filtrer par ?business=<id>."""
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Product.objects.filter(is_active=True).prefetch_related('variant_rows', 'shop_category')
        business_id = self.request.query_params.get('business')
        if business_id:
            qs = qs.filter(business_id=business_id)
        shop_cat = self.request.query_params.get('shop_category')
        if shop_cat:
            qs = qs.filter(shop_category_id=shop_cat)
        return qs


class MyBusinessProductListView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [CanManageProducts]

    def get_queryset(self):
        business = _user_business(self.request.user, self.request.query_params.get('business'))
        if not business:
            return Product.objects.none()
        return Product.objects.filter(business=business).prefetch_related('variant_rows', 'shop_category')

    def perform_create(self, serializer):
        business = serializer.validated_data.get('business') or _user_business(self.request.user)
        if not business or not _can_manage(self.request.user, business):
            raise PermissionDenied("Vous n'êtes pas autorisé à gérer cette boutique.")
        serializer.save(business=business)


class MyBusinessProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductSerializer
    permission_classes = [CanManageProducts]

    def get_queryset(self):
        business = _user_business(self.request.user)
        if not business:
            return Product.objects.none()
        return Product.objects.filter(business=business).prefetch_related('variant_rows')


class AdminProductListView(generics.ListAPIView):
    queryset = Product.objects.all().order_by('-created_at')
    serializer_class = AdminProductSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProductVariantViewSet(viewsets.ModelViewSet):
    serializer_class = ProductVariantSerializer
    permission_classes = [CanManageProducts]

    def get_queryset(self):
        business = _user_business(self.request.user)
        if not business:
            return ProductVariant.objects.none()
        qs = ProductVariant.objects.filter(product__business=business).select_related('product')
        product_id = self.request.query_params.get('product')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        if not _can_manage(self.request.user, product.business):
            raise PermissionDenied('Permission refusée.')
        serializer.save()


class ShopCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ShopCategorySerializer
    permission_classes = [CanManageProducts]

    def get_queryset(self):
        business = _user_business(self.request.user, self.request.query_params.get('business'))
        if not business:
            return ShopCategory.objects.none()
        return ShopCategory.objects.filter(business=business)

    def perform_create(self, serializer):
        business = serializer.validated_data.get('business') or _user_business(self.request.user)
        if not business or not _can_manage(self.request.user, business):
            raise PermissionDenied('Permission refusée.')
        name = serializer.validated_data.get('name') or ''
        slug = serializer.validated_data.get('slug') or slugify(name)
        serializer.save(business=business, slug=slug)


class PublicShopCategoryListView(generics.ListAPIView):
    serializer_class = ShopCategorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        business_id = self.request.query_params.get('business')
        qs = ShopCategory.objects.filter(is_active=True)
        if business_id:
            qs = qs.filter(business_id=business_id)
        return qs


class StockMovementListCreateView(generics.ListCreateAPIView):
    serializer_class = StockMovementSerializer
    permission_classes = [CanManageProducts]

    def get_queryset(self):
        business = _user_business(self.request.user)
        if not business:
            return StockMovement.objects.none()
        return StockMovement.objects.filter(business=business).select_related('product', 'variant')

    @transaction.atomic
    def perform_create(self, serializer):
        business = _user_business(self.request.user)
        product = serializer.validated_data['product']
        if not business or product.business_id != business.id:
            raise PermissionDenied('Produit hors boutique.')
        variant = serializer.validated_data.get('variant')
        qty = serializer.validated_data['quantity']
        mtype = serializer.validated_data['movement_type']

        if mtype == 'ADJUST':
            old = variant.stock if variant else product.stock
            if variant:
                variant.stock = max(0, qty)
                variant.save(update_fields=['stock', 'updated_at'])
                new = variant.stock
            else:
                product.stock = max(0, qty)
                product.save(update_fields=['stock', 'updated_at'])
                new = product.stock
            note = (serializer.validated_data.get('note') or '').strip()
            trail = f'{old} → {new}'
            serializer.save(
                business=business,
                quantity=new - old,
                note=f'{note} ({trail})'.strip() if note else trail,
            )
            return
        else:
            delta = qty if mtype in ('IN', 'CANCEL') else -abs(qty)
            if variant:
                variant.stock = max(0, variant.stock + delta)
                variant.save(update_fields=['stock', 'updated_at'])
            else:
                product.stock = max(0, product.stock + delta)
                product.save(update_fields=['stock', 'updated_at'])
            delta_note_qty = delta

        serializer.save(business=business, quantity=delta_note_qty)
