# pyrefly: ignore [missing-import]
from rest_framework import status
# pyrefly: ignore [missing-import]
from rest_framework.response import Response
# pyrefly: ignore [missing-import]
from rest_framework.views import APIView
# pyrefly: ignore [missing-import]
from rest_framework.permissions import AllowAny, IsAuthenticated
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer
from permissions.custom_permissions import IsSuperAdmin, IsAdminOrBusinessOwnerOrProfessional

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user_data = UserSerializer(user).data
            return Response(user_data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

from rest_framework import generics
from django.contrib.auth import get_user_model

User = get_user_model()

class AdminUserListView(generics.ListAPIView):
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [IsSuperAdmin]

class AdminUserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    from .serializers import AdminUserCreateSerializer
    serializer_class = AdminUserCreateSerializer
    permission_classes = [IsSuperAdmin]

class AdminProfessionalListView(generics.ListAPIView):
    queryset = User.objects.filter(role='PROFESSIONAL').order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrBusinessOwnerOrProfessional]

class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    from .serializers import AdminUserUpdateSerializer
    serializer_class = AdminUserUpdateSerializer
    permission_classes = [IsSuperAdmin]
