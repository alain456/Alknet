from rest_framework.permissions import BasePermission

from businesses.tenant import get_user_tenant_business


def is_retail_pharmacy(business):
    if not business:
        return False
    name = (getattr(business.primary_category, 'name', None) or '').lower()
    slug = (getattr(business.primary_category, 'slug', None) or '').lower()
    blob = f'{name} {slug}'
    if 'pharmacie de gros' in name or ('gros' in blob and 'pharmac' in blob and 'detail' not in blob and 'détail' not in blob):
        return False
    return (
        'pharmacie de detail' in name
        or 'pharmacie de détail' in name
        or 'detail' in slug
        or name.strip() == 'pharmacie'
        or ('pharmac' in blob and ('detail' in blob or 'détail' in blob or 'officine' in blob))
    )


class IsRetailPharmacyAdmin(BasePermission):
    """Owner of the current retail-pharmacy Business tenant."""

    message = (
        "Accès réservé à l'administrateur d'une pharmacie de détail. "
        "Reconnectez-vous avec le compte de votre officine."
    )

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role != 'BUSINESS_OWNER':
            self.message = (
                "Compte propriétaire d'entreprise requis pour gérer le catalogue."
            )
            return False
        business = get_user_tenant_business(user)
        if not business or business.owner_id != user.id:
            self.message = (
                "Aucune pharmacie de détail associée à ce compte."
            )
            return False
        if not is_retail_pharmacy(business):
            self.message = (
                "Ce compte appartient à une autre catégorie (ex. pharmacie de gros). "
                "Utilisez admin.pdetail@isoko.com ou le compte de votre pharmacie de détail."
            )
            return False
        return True
