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
from .auth_emails import (
    decode_uid, email_verify_token, password_reset_token,
    send_password_reset_email, send_verification_email,
)
from permissions.custom_permissions import IsSuperAdmin
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

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
            # Email de vérification (best-effort — n'empêche pas l'inscription)
            email_result = send_verification_email(user)
            user_data = UserSerializer(user).data
            user_data['email_verification'] = email_result
            log_audit_event(
                user=user,
                user_email=user.email,
                user_role=user.role,
                action='USER_REGISTERED',
                resource=f"User #{user.id}",
                request=request,
                status='SUCCESS',
                details={'email': user.email, 'verification_email': email_result.get('status')}
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


class VerifyEmailView(APIView):
    """GET ou POST : { uid, token } → marque is_email_verified=True."""
    permission_classes = (AllowAny,)

    def post(self, request):
        return self._verify(request.data.get('uid'), request.data.get('token'), request)

    def get(self, request):
        return self._verify(request.query_params.get('uid'), request.query_params.get('token'), request)

    def _verify(self, uidb64, token, request):
        uid = decode_uid(uidb64 or '')
        if not uid or not token:
            return Response({'error': 'Lien invalide (uid/token manquants).'}, status=400)
        user = User.objects.filter(pk=uid).first()
        if not user or not email_verify_token.check_token(user, token):
            return Response({'error': 'Lien de vérification invalide ou expiré.'}, status=400)
        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified', 'updated_at'])
            log_audit_event(
                user=user, action='EMAIL_VERIFIED', resource=f'User #{user.id}',
                request=request, status='SUCCESS',
            )
        return Response({'ok': True, 'message': 'Email vérifié.', 'email': user.email})


class ResendVerificationEmailView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        # Réponse neutre pour ne pas révéler si l'email existe
        user = User.objects.filter(email__iexact=email).first() if email else None
        if user and not user.is_email_verified:
            send_verification_email(user)
        return Response({
            'ok': True,
            'message': 'Si un compte non vérifié existe pour cet email, un lien a été envoyé.',
        })


class PasswordResetRequestView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        user = User.objects.filter(email__iexact=email).first() if email else None
        if user and user.is_active:
            send_password_reset_email(user)
            log_audit_event(
                user=user, action='PASSWORD_RESET_REQUESTED', resource=f'User #{user.id}',
                request=request, status='SUCCESS',
            )
        return Response({
            'ok': True,
            'message': 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.',
        })


class PasswordResetConfirmView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        password = request.data.get('password') or request.data.get('new_password') or ''
        uid = decode_uid(uidb64 or '')
        if not uid or not token or not password:
            return Response({'error': 'uid, token et password sont requis.'}, status=400)
        user = User.objects.filter(pk=uid).first()
        if not user or not password_reset_token.check_token(user, token):
            return Response({'error': 'Lien de réinitialisation invalide ou expiré.'}, status=400)
        try:
            validate_password(password, user=user)
        except DjangoValidationError as exc:
            return Response({'error': ' '.join(exc.messages)}, status=400)
        user.set_password(password)
        user.save(update_fields=['password', 'updated_at'])
        log_audit_event(
            user=user, action='PASSWORD_RESET_COMPLETED', resource=f'User #{user.id}',
            request=request, status='SUCCESS',
        )
        return Response({'ok': True, 'message': 'Mot de passe mis à jour. Vous pouvez vous connecter.'})


class ProfileView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        allowed = ('first_name', 'last_name', 'phone_number')
        changed = []
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data.get(field) or '')
                changed.append(field)
        if changed:
            user.save(update_fields=changed)
        return Response(UserSerializer(user).data)

    def put(self, request):
        return self.patch(request)


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
    permission_classes = [IsSuperAdmin]


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


class OAuthProvidersStatusView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        from .oauth import providers_status
        return Response(providers_status())


class OAuthStartView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, provider):
        from django.shortcuts import redirect
        from .oauth import PROVIDERS, build_authorize_url, frontend_oauth_redirect

        provider = (provider or '').lower()
        if provider not in PROVIDERS:
            return Response({'error': 'Fournisseur inconnu.'}, status=400)
        next_path = request.query_params.get('next') or '/dashboard'
        try:
            url = build_authorize_url(provider, next_path=next_path)
        except ValueError as exc:
            # Renvoie vers le frontend avec message clair
            return redirect(frontend_oauth_redirect(
                access='', refresh='', next_path='/login', error=str(exc),
            ))
        return redirect(url)


class OAuthCallbackView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, provider):
        from django.shortcuts import redirect
        from .oauth import (
            PROVIDERS, decode_state, exchange_code, fetch_profile,
            frontend_oauth_redirect, login_or_register_social,
        )

        provider = (provider or '').lower()
        next_path = '/dashboard'
        if provider not in PROVIDERS:
            return redirect(frontend_oauth_redirect(
                access='', refresh='', next_path='/login',
                error='Fournisseur OAuth inconnu.',
            ))

        err = request.query_params.get('error') or request.query_params.get('error_description')
        if err:
            return redirect(frontend_oauth_redirect(
                access='', refresh='', next_path='/login', error=str(err),
            ))

        code = request.query_params.get('code')
        state = request.query_params.get('state')
        if not code or not state:
            return redirect(frontend_oauth_redirect(
                access='', refresh='', next_path='/login',
                error='Réponse OAuth invalide (code/state manquants).',
            ))

        try:
            state_data = decode_state(state)
            next_path = state_data.get('next') or '/dashboard'
            access_token = exchange_code(provider, code)
            profile = fetch_profile(provider, access_token)
            tokens = login_or_register_social(provider=provider, profile=profile, request=request)
        except Exception as exc:
            return redirect(frontend_oauth_redirect(
                access='', refresh='', next_path='/login', error=str(exc),
            ))

        return redirect(frontend_oauth_redirect(
            access=tokens['access'],
            refresh=tokens['refresh'],
            next_path=next_path,
        ))
