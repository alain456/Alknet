# pyrefly: ignore [missing-import]
from rest_framework import status, generics
# pyrefly: ignore [missing-import]
from rest_framework.response import Response
# pyrefly: ignore [missing-import]
from rest_framework.views import APIView
# pyrefly: ignore [missing-import]
from rest_framework.permissions import AllowAny, IsAuthenticated
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta

from .serializers import (
    RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer,
    AdminUserCreateSerializer, AdminUserUpdateSerializer, AuditLogSerializer
)
from .models import AuditLog
from .services import log_audit_event
from permissions.custom_permissions import IsSuperAdmin, IsAdminOrBusinessOwnerOrProfessional

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        email = request.data.get('email', '')
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.user
            res = Response(serializer.validated_data, status=status.HTTP_200_OK)
            log_audit_event(
                user=user,
                user_email=user.email,
                user_role=user.role,
                action='LOGIN_SUCCESS',
                resource='Auth Service (/api/v1/accounts/login/)',
                request=request,
                status='SUCCESS',
                details={'method': 'JWT Password Auth'}
            )
            return res
        except Exception as exc:
            user_obj = User.objects.filter(email=email).first()
            log_audit_event(
                user=user_obj,
                user_email=email or 'ANONYMOUS',
                user_role=user_obj.role if user_obj else 'ANONYMOUS',
                action='LOGIN_FAILED',
                resource='Auth Service (/api/v1/accounts/login/)',
                request=request,
                status='FAILED',
                details={'reason': str(exc)}
            )
            raise exc


class RegisterView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user_data = UserSerializer(user).data
            log_audit_event(
                user=user,
                user_email=user.email,
                user_role=user.role,
                action='USER_REGISTERED',
                resource=f"User #{user.id}",
                request=request,
                status='SUCCESS',
                details={'email': user.email}
            )
            return Response(user_data, status=status.HTTP_201_CREATED)
        
        log_audit_event(
            user_email=request.data.get('email', 'ANONYMOUS'),
            action='USER_REGISTER_FAILED',
            resource='Registration Endpoint',
            request=request,
            status='FAILED',
            details={'errors': serializer.errors}
        )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class AdminUserListView(generics.ListAPIView):
    queryset = User.objects.all().prefetch_related('businesses', 'employments__business', 'employments__role', 'doctor_profile__hospital').order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [IsSuperAdmin]


class AdminUserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = AdminUserCreateSerializer
    permission_classes = [IsSuperAdmin]

    def perform_create(self, serializer):
        user = serializer.save()
        log_audit_event(
            user=self.request.user,
            action='USER_CREATED_BY_ADMIN',
            resource=f"User #{user.id} ({user.email})",
            request=self.request,
            status='SUCCESS',
            details={'target_user_id': str(user.id), 'target_role': user.role}
        )


class AdminProfessionalListView(generics.ListAPIView):
    queryset = User.objects.filter(role='PROFESSIONAL').order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrBusinessOwnerOrProfessional]


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = AdminUserUpdateSerializer
    permission_classes = [IsSuperAdmin]

    def perform_update(self, serializer):
        user = serializer.save()
        log_audit_event(
            user=self.request.user,
            action='USER_UPDATED_BY_ADMIN',
            resource=f"User #{user.id} ({user.email})",
            request=self.request,
            status='SUCCESS',
            details={'target_user_id': str(user.id), 'updated_fields': list(serializer.validated_data.keys())}
        )

    def perform_destroy(self, instance):
        target_id = str(instance.id)
        target_email = instance.email
        instance.delete()
        log_audit_event(
            user=self.request.user,
            action='USER_DELETED_BY_ADMIN',
            resource=f"User #{target_id} ({target_email})",
            request=self.request,
            status='WARNING',
            details={'deleted_user_email': target_email}
        )


class AdminAuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        queryset = AuditLog.objects.all().select_related('user')
        
        # Search filter
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(user_email__icontains=search) |
                Q(action__icontains=search) |
                Q(resource__icontains=search) |
                Q(ip_address__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search)
            )

        # Action filter
        action = self.request.query_params.get('action', '').strip()
        if action and action != 'ALL':
            queryset = queryset.filter(action=action)

        # Status filter
        status_param = self.request.query_params.get('status', '').strip()
        if status_param and status_param != 'ALL':
            queryset = queryset.filter(status=status_param)

        # Role filter
        role = self.request.query_params.get('role', '').strip()
        if role and role != 'ALL':
            queryset = queryset.filter(user_role=role)

        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        
        # Add metadata stats to response
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        
        total_logs = AuditLog.objects.count()
        failed_logins_24h = AuditLog.objects.filter(action='LOGIN_FAILED', created_at__gte=last_24h).count()
        admin_actions_24h = AuditLog.objects.filter(action__icontains='ADMIN', created_at__gte=last_24h).count()
        active_users_24h = AuditLog.objects.filter(created_at__gte=last_24h).values('user_email').distinct().count()

        stats_data = {
            'total_logs': total_logs,
            'failed_logins_24h': failed_logins_24h,
            'admin_actions_24h': admin_actions_24h,
            'active_users_24h': active_users_24h,
        }
        
        if isinstance(response.data, dict):
            response.data['stats'] = stats_data
        else:
            response.data = {
                'results': response.data,
                'stats': stats_data
            }

        return response
