from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.custom_permissions import IsBusinessTenantMember

from .margins import margin_report
from .tenant import get_user_tenant_business


class MarginReportView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessTenantMember]

    def get(self, request):
        business = get_user_tenant_business(request.user)
        return Response(margin_report(business, request.query_params))
