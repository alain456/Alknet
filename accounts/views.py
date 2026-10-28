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
from .email_identity import get_user_by_login_email, normalize_login_email
from permissions.custom_permissions import IsSuperAdmin, PlatformMethodPermission
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = ()

    def get_throttles(self):
        from .throttling import AuthEndpointThrottle
        return [AuthEndpointThrottle()]

    def post(self, request, *args, **kwargs):
        from .login_guard import assert_not_locked, record_failure, record_success
        from .session_cookies import set_auth_cookies
        email = request.data.get('email', '')
        try:
            assert_not_locked(email)
        except Exception as exc:
            from rest_framework.exceptions import Throttled
            if isinstance(exc, Throttled):
                return Response({'detail': str(exc.detail)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
            raise
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.user
            from businesses.login_gate import business_login_block_message
            blocked = business_login_block_message(user)
            if blocked:
                log_audit_event(
                    user=user,
                    user_email=user.email,
                    user_role=user.role,
                    action='LOGIN_FAILED',
                    resource='Auth Service (/api/v1/accounts/login/)',
                    request=request,
                    status='FAILED',
                    details={'reason': 'business_not_approved'},
                )
                return Response({'detail': blocked}, status=status.HTTP_403_FORBIDDEN)
            record_success(user.email)
            from site_content.models import SiteSettings
            site = SiteSettings.get_solo()
            if site.maintenance_mode and user.role != 'SUPER_ADMIN':
                return Response(
                    {'detail': site.maintenance_message or 'La plateforme est en maintenance.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            platform_role = user.role in (
                'SUPER_ADMIN', 'PLATFORM_FINANCE', 'PLATFORM_MODERATION',
                'PLATFORM_SUPPORT', 'PLATFORM_CONTENT',
            )
            if platform_role or getattr(user, 'email_otp_enabled', False):
                from .otp import start_email_otp
                import logging
                try:
                    challenge = start_email_otp(user)
                except Exception:
                    logging.getLogger(__name__).exception('Code de connexion non envoyé')
                    challenge = None
                if challenge is not None:
                    return Response({
                        'two_factor_required': True,
                        'challenge': str(challenge.id),
                        'detail': 'Un code a été envoyé à votre adresse e-mail.',
                    }, status=status.HTTP_200_OK)
            payload = dict(serializer.validated_data)
            access = payload.pop('access', '')
            refresh = payload.pop('refresh', '')
            res = Response(payload, status=status.HTTP_200_OK)
            set_auth_cookies(res, access, refresh)
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
            from rest_framework.exceptions import AuthenticationFailed as DRFAuthFailed
            from rest_framework_simplejwt.exceptions import AuthenticationFailed as JWTAuthFailed

            user_obj = get_user_by_login_email(email) if email else None
            if user_obj:
                record_failure(email)
            log_audit_event(
                user=user_obj,
                user_email=normalize_login_email(email) or 'ANONYMOUS',
                user_role=user_obj.role if user_obj else 'ANONYMOUS',
                action='LOGIN_FAILED',
                resource='Auth Service (/api/v1/accounts/login/)',
                request=request,
                status='FAILED',
                details={'reason': str(exc)}
            )
            if isinstance(exc, (DRFAuthFailed, JWTAuthFailed)):
                return Response(
                    {'detail': 'E-mail ou mot de passe incorrect.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            raise exc


class RegisterView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = ()

    def get_throttles(self):
        from .throttling import AuthEndpointThrottle
        return [AuthEndpointThrottle()]

    def post(self, request):
        from django.db import IntegrityError

        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = serializer.save()
            except IntegrityError:
                self._log_register_failure(['email'])
                return Response(
                    {'email': ['Un compte existe déjà avec cet email.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
                details={'verification_email': email_result.get('status')}
            )
            return Response(user_data, status=status.HTTP_201_CREATED)

        self._log_register_failure(list(serializer.errors.keys()), request)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def _log_register_failure(self, fields, request=None):
        # Pas d'adresse tentée : le journal ne doit pas servir à énumérer les emails.
        log_audit_event(
            action='USER_REGISTER_FAILED',
            resource='Registration Endpoint',
            request=request or self.request,
            status='FAILED',
            details={'fields': sorted(str(field) for field in fields)},
        )


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
        user = get_user_by_login_email(email) if email else None
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
        user = get_user_by_login_email(email) if email else None
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
        allowed = ('first_name', 'last_name', 'phone_number', 'email_otp_enabled')
        changed = []
        for field in allowed:
            if field in request.data:
                value = request.data.get(field)
                if field == 'email_otp_enabled':
                    value = bool(value)
                setattr(user, field, value if field == 'email_otp_enabled' else (value or ''))
                changed.append(field)
        if changed:
            user.save(update_fields=changed)
        return Response(UserSerializer(user).data)

    def put(self, request):
        return self.patch(request)


class AdminUserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.users.view'}

    def get_queryset(self):
        from .platform_access import PLATFORM_USER_ROLES

        qs = User.objects.all().select_related('profile').prefetch_related(
            'businesses', 'employments__business', 'employments__role', 'doctor_profile__hospital'
        ).order_by('-created_at')
        scope = (self.request.query_params.get('scope') or '').strip().lower()
        if scope == 'platform':
            return qs.filter(role__in=PLATFORM_USER_ROLES)
        if scope in ('business', 'entreprise', 'tenant'):
            return qs.exclude(role__in=PLATFORM_USER_ROLES)
        return qs


class AdminUserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = AdminUserCreateSerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'POST': 'platform.users.create'}

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
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.professionals.view'}


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = AdminUserUpdateSerializer
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': 'platform.users.view',
        'PUT': 'platform.users.update',
        'PATCH': 'platform.users.update',
        'DELETE': 'platform.users.delete',
    }

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
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.audit.view'}

    def _apply_scope(self, queryset):
        from .platform_access import PLATFORM_USER_ROLES

        scope = (self.request.query_params.get('scope') or '').strip().lower()
        if scope == 'platform':
            return queryset.filter(
                Q(user_role__in=PLATFORM_USER_ROLES)
                | Q(action__startswith='PLATFORM_')
            )
        if scope in ('business', 'entreprise', 'tenant'):
            return queryset.exclude(user_role__in=PLATFORM_USER_ROLES).exclude(
                action__startswith='PLATFORM_',
            )
        return queryset

    def get_queryset(self):
        queryset = self._apply_scope(AuditLog.objects.all().select_related('user'))

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

        # Category filter (critical event groups)
        category = self.request.query_params.get('category', '').strip().upper()
        if category and category != 'ALL':
            if category == 'ACCESS':
                queryset = queryset.filter(
                    Q(action__icontains='LOGIN') | Q(action__icontains='LOGOUT')
                    | Q(action__icontains='PASSWORD') | Q(action__icontains='2FA')
                    | Q(action__icontains='MFA') | Q(action__icontains='OTP')
                )
            elif category == 'SECURITY':
                queryset = queryset.filter(
                    Q(action__icontains='ROLE') | Q(action__icontains='PERMISSION')
                    | Q(action__icontains='RBAC') | Q(action__icontains='INVITE')
                    | Q(action__icontains='ADMIN')
                )
            elif category == 'BILLING':
                queryset = queryset.filter(
                    Q(action__icontains='BILLING') | Q(action__icontains='SUBSCRIPTION')
                    | Q(action__icontains='PAYMENT') | Q(action__icontains='PLAN')
                    | Q(action__icontains='INVOICE')
                )
            elif category == 'DATA_EXPORT':
                queryset = queryset.filter(
                    Q(action__icontains='EXPORT') | Q(action__icontains='DOWNLOAD')
                    | Q(action__icontains='CSV') | Q(resource__icontains='export')
                )
            elif category == 'INTEGRATIONS':
                queryset = queryset.filter(
                    Q(action__icontains='API_KEY') | Q(action__icontains='WEBHOOK')
                    | Q(action__icontains='INTEGRATION') | Q(action__icontains='OAUTH')
                )
            elif category == 'DATA_CHANGE':
                queryset = queryset.filter(
                    Q(action__icontains='CREATE') | Q(action__icontains='UPDATE')
                    | Q(action__icontains='DELETE') | Q(action__icontains='MODIFY')
                )

        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        # Stats alignées sur le même périmètre (plateforme / entreprise)
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        scoped = self._apply_scope(AuditLog.objects.all())

        total_logs = scoped.count()
        failed_logins_24h = scoped.filter(action='LOGIN_FAILED', created_at__gte=last_24h).count()
        admin_actions_24h = scoped.filter(action__icontains='ADMIN', created_at__gte=last_24h).count()
        active_users_24h = scoped.filter(created_at__gte=last_24h).values('user_email').distinct().count()

        stats_data = {
            'total_logs': total_logs,
            'failed_logins_24h': failed_logins_24h,
            'admin_actions_24h': admin_actions_24h,
            'active_users_24h': active_users_24h,
            'scope': (request.query_params.get('scope') or 'all').strip().lower() or 'all',
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
                next_path='/login', error=str(exc),
            ))
        return redirect(url)


class OAuthCallbackView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, provider):
        from django.shortcuts import redirect
        from .oauth import (
            PROVIDERS, decode_state, exchange_code, fetch_profile,
            frontend_oauth_redirect, login_or_register_social, stash_browser_login,
        )

        provider = (provider or '').lower()
        next_path = '/dashboard'
        if provider not in PROVIDERS:
            return redirect(frontend_oauth_redirect(
                next_path='/login',
                error='Fournisseur OAuth inconnu.',
            ))

        err = request.query_params.get('error') or request.query_params.get('error_description')
        if err:
            return redirect(frontend_oauth_redirect(
                next_path='/login', error=str(err),
            ))

        code = request.query_params.get('code')
        state = request.query_params.get('state')
        if not code or not state:
            return redirect(frontend_oauth_redirect(
                next_path='/login',
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
                next_path='/login', error=str(exc),
            ))

        code_once = stash_browser_login(tokens['access'], tokens['refresh'], tokens['user']['id'])
        return redirect(frontend_oauth_redirect(
            code=code_once,
            next_path=next_path,
        ))


class OAuthExchangeView(APIView):
    """Échange le code à usage unique contre des cookies HttpOnly. Aucun jeton dans le corps."""
    permission_classes = (AllowAny,)

    def post(self, request):
        from .oauth import pop_browser_login
        from .session_cookies import set_auth_cookies
        payload = pop_browser_login(request.data.get('code') or '')
        if not payload:
            return Response({'error': 'Code de connexion expiré ou déjà utilisé.'}, status=400)
        user = User.objects.filter(id=payload.get('user_id')).first()
        if not user or not user.is_active:
            return Response({'error': 'Compte introuvable.'}, status=400)
        from businesses.login_gate import business_login_block_message
        blocked = business_login_block_message(user)
        if blocked:
            return Response({'detail': blocked}, status=status.HTTP_403_FORBIDDEN)
        response = Response({'user': UserSerializer(user).data})
        set_auth_cookies(response, payload['access'], payload['refresh'])
        return response


class AdminPlatformRoleListView(APIView):
    """Catalogue CRUD des rôles plateforme. Le super admin peut ajuster finance, modération, support et contenu."""
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'GET': 'platform.roles.view'}

    def get(self, request):
        from .platform_access import PLATFORM_ROLE_DEFAULTS, catalog_payload, ensure_platform_roles

        roles = []
        for role in ensure_platform_roles():
            spec = PLATFORM_ROLE_DEFAULTS.get(role.code, {})
            roles.append({
                'code': role.code,
                'name': role.name,
                'description': role.description or spec.get('description') or '',
                'is_locked': role.is_locked,
                'permissions': list(role.permissions or []),
            })
        order = ['super_admin', 'finance', 'moderation', 'support', 'content']
        roles.sort(key=lambda row: order.index(row['code']) if row['code'] in order else 99)
        return Response({'groups': catalog_payload(), 'results': roles})


class AdminPlatformRoleDetailView(APIView):
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {'PATCH': 'platform.roles.update'}

    def patch(self, request, code):
        from .platform_access import update_platform_role

        try:
            role = update_platform_role(
                code,
                permissions=request.data.get('permissions') if 'permissions' in request.data else None,
                name=request.data.get('name') if 'name' in request.data else None,
                description=request.data.get('description') if 'description' in request.data else None,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        log_audit_event(
            user=request.user,
            action='PLATFORM_ROLE_UPDATED',
            resource=f'platform-role:{role.code}',
            request=request,
            status='SUCCESS',
            details={
                'code': role.code,
                'name': role.name,
                'permissions': role.permissions,
            },
        )
        return Response({
            'code': role.code,
            'name': role.name,
            'description': role.description,
            'is_locked': role.is_locked,
            'permissions': list(role.permissions or []),
        })


class AdminPlatformActorListCreateView(APIView):
    """Créer un acteur plateforme et lui attribuer un rôle, ou lister les acteurs."""
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': ('platform.users.view', 'platform.roles.view'),
        'POST': 'platform.users.create',
    }

    def get(self, request):
        from .platform_access import PLATFORM_USER_ROLES, ROLE_TO_CODE, ensure_platform_roles, role_name_for_code

        ensure_platform_roles()
        users = User.objects.filter(role__in=PLATFORM_USER_ROLES).order_by('role', 'email')
        results = []
        for row in users:
            code = ROLE_TO_CODE.get(row.role)
            results.append({
                'id': str(row.id),
                'email': row.email,
                'first_name': row.first_name or '',
                'last_name': row.last_name or '',
                'phone_number': row.phone_number or '',
                'role': row.role,
                'role_code': code,
                'role_name': role_name_for_code(code) or row.get_role_display(),
                'is_active': row.is_active,
                'created_at': row.created_at.isoformat() if row.created_at else None,
            })
        return Response({'count': len(results), 'results': results})

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        from .email_identity import get_user_by_login_email, normalize_login_email
        from .platform_access import CODE_TO_ROLE, ensure_platform_roles, role_name_for_code
        from .services import create_user

        ensure_platform_roles()
        email = normalize_login_email(request.data.get('email') or '')
        if not email or '@' not in email:
            return Response({'detail': 'Email obligatoire.'}, status=status.HTTP_400_BAD_REQUEST)
        if get_user_by_login_email(email):
            return Response({'detail': 'Un compte utilise déjà cette adresse email.'}, status=status.HTTP_400_BAD_REQUEST)

        role_code = (request.data.get('role_code') or request.data.get('role') or '').strip()
        if role_code in CODE_TO_ROLE:
            role = CODE_TO_ROLE[role_code]
        elif role_code in CODE_TO_ROLE.values():
            role = role_code
            role_code = next(code for code, value in CODE_TO_ROLE.items() if value == role)
        else:
            return Response(
                {'detail': 'Rôle plateforme requis (super_admin, finance, moderation, support, content).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        password = request.data.get('password') or ''
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            return Response({'detail': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user = create_user(
            email=email,
            password=password,
            role=role,
            first_name=(request.data.get('first_name') or '').strip(),
            last_name=(request.data.get('last_name') or '').strip(),
            phone_number=(request.data.get('phone_number') or '').strip() or None,
            is_email_verified=True,
            is_staff=role == 'SUPER_ADMIN',
        )
        log_audit_event(
            user=request.user,
            action='PLATFORM_ACTOR_CREATED',
            resource=f'user:{user.id}',
            request=request,
            status='SUCCESS',
            details={
                'target_email': user.email,
                'role': user.role,
                'role_code': role_code,
                'on_behalf': True,
            },
        )
        spec_name = role_name_for_code(role_code)
        return Response({
            'id': str(user.id),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone_number': user.phone_number or '',
            'role': user.role,
            'role_code': role_code,
            'role_name': spec_name or user.get_role_display(),
            'is_active': user.is_active,
        }, status=status.HTTP_201_CREATED)


class AdminPlatformActorDetailView(APIView):
    """Voir, modifier, activer/désactiver ou supprimer un acteur plateforme."""
    permission_classes = [PlatformMethodPermission]
    platform_method_permissions = {
        'GET': ('platform.users.view', 'platform.roles.view'),
        'PATCH': 'platform.users.update',
        'PUT': 'platform.users.update',
        'DELETE': 'platform.users.delete',
    }

    def _serialize(self, user):
        from .platform_access import ROLE_TO_CODE, role_name_for_code

        code = ROLE_TO_CODE.get(user.role)
        return {
            'id': str(user.id),
            'email': user.email,
            'first_name': user.first_name or '',
            'last_name': user.last_name or '',
            'phone_number': user.phone_number or '',
            'role': user.role,
            'role_code': code,
            'role_name': role_name_for_code(code) or user.get_role_display(),
            'is_active': user.is_active,
            'created_at': user.created_at.isoformat() if user.created_at else None,
        }

    def _get_actor(self, pk):
        from .platform_access import PLATFORM_USER_ROLES

        return User.objects.filter(pk=pk, role__in=PLATFORM_USER_ROLES).first()

    def get(self, request, pk):
        from .platform_access import ensure_platform_roles

        ensure_platform_roles()
        user = self._get_actor(pk)
        if not user:
            return Response({'detail': 'Acteur plateforme introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self._serialize(user))

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        from .email_identity import get_user_by_login_email, normalize_login_email
        from .platform_access import CODE_TO_ROLE, ROLE_TO_CODE, ensure_platform_roles

        ensure_platform_roles()
        user = self._get_actor(pk)
        if not user:
            return Response({'detail': 'Acteur plateforme introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        if user.id == request.user.id and request.data.get('is_active') is False:
            return Response({'detail': 'Vous ne pouvez pas désactiver votre propre compte.'}, status=status.HTTP_400_BAD_REQUEST)

        changed = []
        if 'role_code' in request.data or 'role' in request.data:
            role_code = (request.data.get('role_code') or request.data.get('role') or '').strip()
            if role_code in CODE_TO_ROLE:
                new_role = CODE_TO_ROLE[role_code]
            elif role_code in CODE_TO_ROLE.values():
                new_role = role_code
                role_code = ROLE_TO_CODE[new_role]
            else:
                return Response({'detail': 'Rôle plateforme invalide.'}, status=status.HTTP_400_BAD_REQUEST)
            if user.id == request.user.id and new_role != user.role:
                return Response({'detail': 'Vous ne pouvez pas changer votre propre rôle.'}, status=status.HTTP_400_BAD_REQUEST)
            user.role = new_role
            user.is_staff = new_role == 'SUPER_ADMIN'
            changed.extend(['role', 'is_staff'])

        if 'is_active' in request.data:
            user.is_active = bool(request.data.get('is_active'))
            changed.append('is_active')

        if 'email' in request.data:
            email = normalize_login_email(request.data.get('email') or '')
            if not email or '@' not in email:
                return Response({'detail': 'Email obligatoire.'}, status=status.HTTP_400_BAD_REQUEST)
            existing = get_user_by_login_email(email)
            if existing and existing.pk != user.pk:
                return Response({'detail': 'Un compte utilise déjà cette adresse email.'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email
            changed.append('email')

        for field in ('first_name', 'last_name', 'phone_number'):
            if field in request.data:
                value = request.data.get(field)
                setattr(user, field, (value or '').strip() if field != 'phone_number' else ((value or '').strip() or None))
                changed.append(field)

        password = request.data.get('password')
        if password:
            try:
                validate_password(password, user=user)
            except DjangoValidationError as exc:
                return Response({'detail': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(password)
            changed.append('password')

        if changed:
            update_fields = [field for field in changed if field != 'password']
            if 'password' in changed:
                update_fields.append('password')
            user.save(update_fields=list(dict.fromkeys(update_fields)) if update_fields else None)
            log_audit_event(
                user=request.user,
                action='PLATFORM_ACTOR_UPDATED',
                resource=f'user:{user.id}',
                request=request,
                status='SUCCESS',
                details={
                    'target_email': user.email,
                    'fields': [field for field in changed if field != 'password'],
                    'password_changed': 'password' in changed,
                    'role': user.role,
                    'on_behalf': True,
                },
            )

        return Response(self._serialize(user))

    def delete(self, request, pk):
        user = self._get_actor(pk)
        if not user:
            return Response({'detail': 'Acteur plateforme introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        if user.id == request.user.id:
            return Response({'detail': 'Vous ne pouvez pas supprimer votre propre compte.'}, status=status.HTTP_400_BAD_REQUEST)
        email = user.email
        user_id = str(user.id)
        user.delete()
        log_audit_event(
            user=request.user,
            action='PLATFORM_ACTOR_DELETED',
            resource=f'user:{user_id}',
            request=request,
            status='WARNING',
            details={'target_email': email, 'on_behalf': True},
        )
        return Response({'detail': f'Acteur « {email} » supprimé.', 'deleted': True})


class LoginOtpVerifyView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = ()

    def get_throttles(self):
        from .throttling import AuthEndpointThrottle
        return [AuthEndpointThrottle()]

    def post(self, request):
        from rest_framework.exceptions import Throttled
        from rest_framework_simplejwt.tokens import RefreshToken
        from .login_guard import assert_not_locked, record_failure, record_success
        from .otp import verify_email_otp
        from .session_cookies import set_auth_cookies
        from .models import LoginOtp
        challenge_id = request.data.get('challenge')
        row = LoginOtp.objects.filter(id=challenge_id).select_related('user').first() if challenge_id else None
        email = row.user.email if row else ''
        try:
            assert_not_locked(email)
        except Throttled as exc:
            return Response({'detail': str(exc.detail)}, status=429)
        user = verify_email_otp(challenge_id, request.data.get('code'))
        if not user:
            if email:
                record_failure(email)
            return Response({'error': 'Code invalide ou expiré.'}, status=400)
        from businesses.login_gate import business_login_block_message
        blocked = business_login_block_message(user)
        if blocked:
            return Response({'detail': blocked}, status=status.HTTP_403_FORBIDDEN)
        record_success(user.email)
        refresh = RefreshToken.for_user(user)
        response = Response({
            'user': UserSerializer(user).data,
        })
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


class LogoutView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        from .session_cookies import REFRESH_COOKIE, clear_auth_cookies
        raw = (request.data.get('refresh') if hasattr(request.data, 'get') else None) or request.COOKIES.get(REFRESH_COOKIE)
        if raw:
            try:
                from rest_framework_simplejwt.tokens import RefreshToken
                token = RefreshToken(raw)
                token.blacklist()
            except Exception:
                pass
        response = Response({'ok': True})
        clear_auth_cookies(response)
        return response


class CookieTokenRefreshView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        from rest_framework_simplejwt.serializers import TokenRefreshSerializer
        from .session_cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
        payload = {'refresh': request.data.get('refresh') or request.COOKIES.get(REFRESH_COOKIE)}
        serializer = TokenRefreshSerializer(data=payload)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            # Sans ce nettoyage, les cookies de session morte restent en place et
            # le navigateur les renvoie à chaque chargement : le front ne peut pas
            # distinguer « session expirée » de « pas de session ».
            invalid_response = Response(
                {'detail': 'Jeton de rafraîchissement invalide.'}, status=401,
            )
            clear_auth_cookies(invalid_response)
            raw = payload.get('refresh') or ''
            from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
            outstanding = OutstandingToken.objects.filter(token=raw).select_related('user').first()
            if outstanding and BlacklistedToken.objects.filter(token=outstanding).exists():
                from .services import log_audit_event
                for other in OutstandingToken.objects.filter(user=outstanding.user):
                    BlacklistedToken.objects.get_or_create(token=other)
                log_audit_event(
                    user=outstanding.user,
                    action='REFRESH_REUSE',
                    resource='auth',
                    request=request,
                    status='FAILED',
                    details={'reason': 'Jeton de rafraîchissement déjà révoqué.'},
                )
            return invalid_response
        from rest_framework_simplejwt.tokens import RefreshToken
        from businesses.login_gate import business_login_block_message
        rotated = serializer.validated_data.get('refresh', payload['refresh'])
        try:
            refresh_user_id = RefreshToken(rotated).payload.get('user_id')
        except Exception:
            refresh_user_id = None
        refresh_user = User.objects.filter(pk=refresh_user_id).first() if refresh_user_id else None
        blocked = business_login_block_message(refresh_user)
        if blocked:
            denied = Response({'detail': blocked}, status=status.HTTP_403_FORBIDDEN)
            clear_auth_cookies(denied)
            return denied
        response = Response({'authenticated': True})
        set_auth_cookies(response, serializer.validated_data.get('access', ''), serializer.validated_data.get('refresh', payload['refresh']))
        return response


class PersonalDataExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .data_rights import export_personal_data
        return Response(export_personal_data(request.user))


class PersonalDataDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .data_rights import delete_personal_account
        error = delete_personal_account(request.user, request.data.get('password') or '')
        if error:
            return Response({'error': error}, status=400)
        return Response({'ok': True, 'detail': 'Compte désactivé et données d’identité effacées.'})


class BusinessDataExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from businesses.tenant import get_user_tenant_business
        from .data_rights import export_business_data
        business = get_user_tenant_business(request.user)
        if not business or business.owner_id != request.user.id:
            return Response({'error': 'Seul le propriétaire peut exporter les données de l’établissement.'}, status=403)
        return Response(export_business_data(business))
