from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from permissions.custom_permissions import IsBusinessTenantMember

from .inventory import (
    cancel_session,
    open_session,
    save_counts,
    serialize_session,
    validate_session,
)
from .models import InventorySession
from .tenant import get_user_tenant_business


def _open_session(business):
    return (
        InventorySession.objects.filter(business=business, status='OPEN')
        .order_by('-opened_at')
        .first()
    )


class InventorySessionView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessTenantMember]

    def get(self, request):
        business = get_user_tenant_business(request.user)
        session = _open_session(business) if business else None
        if not session:
            return Response({'session': None})
        return Response({'session': serialize_session(session)})

    def post(self, request):
        business = get_user_tenant_business(request.user)
        session = open_session(business, request.user)
        return Response({'session': serialize_session(session)}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        business = get_user_tenant_business(request.user)
        session = _open_session(business)
        if not session:
            return Response({'detail': 'Aucun inventaire en cours.'}, status=status.HTTP_404_NOT_FOUND)
        save_counts(session, request.data.get('lines') or [])
        return Response({'session': serialize_session(session)})


class InventoryValidateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessTenantMember]

    def post(self, request):
        business = get_user_tenant_business(request.user)
        session = _open_session(business)
        if not session:
            return Response({'detail': 'Aucun inventaire en cours.'}, status=status.HTTP_404_NOT_FOUND)
        result = validate_session(session, request.user, request.data.get('lines'))
        return Response(result)


class InventoryCancelView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessTenantMember]

    def post(self, request):
        business = get_user_tenant_business(request.user)
        session = _open_session(business)
        if not session:
            return Response({'detail': 'Aucun inventaire en cours.'}, status=status.HTTP_404_NOT_FOUND)
        cancel_session(session)
        return Response({'status': 'CANCELLED'})
