from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny # We'll use AllowAny for testing, should be IsAdminUser in prod
from django.contrib.auth import get_user_model
from businesses.models import Business

User = get_user_model()

class AdminDashboardStatsView(APIView):
    permission_classes = [AllowAny] # Allow any for now to ensure frontend connection works easily

    def get(self, request):
        # Real data
        total_active_users = User.objects.filter(is_active=True).count()
        registered_businesses = Business.objects.filter(is_active=True).count()
        
        # Mocked data for things not yet modeled
        monthly_revenue = 84250000 # 84.2M BIF
        error_rate = 0.012
        
        recent_activity = [
            {"id": 1, "action": "New Business Registered", "target": "TechNova Solutions", "user": "system", "time": "2 mins ago", "status": "success"},
            {"id": 2, "action": "Subscription Upgraded", "target": "Pro Plan (Monthly)", "user": "j.doe@example.com", "time": "15 mins ago", "status": "success"},
            {"id": 3, "action": "Failed Payment", "target": "Invoice #INV-2026-009", "user": "billing_system", "time": "1 hour ago", "status": "error"},
            {"id": 4, "action": "User Account Locked", "target": "Suspicious Activity", "user": "security_bot", "time": "3 hours ago", "status": "warning"},
            {"id": 5, "action": "Platform Update Deployed", "target": "v2.4.1", "user": "admin", "time": "5 hours ago", "status": "info"},
        ]
        
        active_subscriptions = [
            {"id": "SUB-001", "business": "Global Logistics", "plan": "Enterprise", "amount": "499,000 BIF", "status": "Active", "renewed": "Today"},
            {"id": "SUB-002", "business": "Creative Studio", "plan": "Premium", "amount": "20,000 BIF", "status": "Active", "renewed": "Yesterday"},
            {"id": "SUB-003", "business": "Local Cafe", "plan": "Standard", "amount": "10,000 BIF", "status": "Past Due", "renewed": "3 days ago"},
            {"id": "SUB-004", "business": "Tech Innovators", "plan": "Premium", "amount": "20,000 BIF", "status": "Active", "renewed": "Last week"},
        ]
        
        return Response({
            "metrics": {
                "total_active_users": total_active_users,
                "registered_businesses": registered_businesses,
                "monthly_revenue": monthly_revenue,
                "error_rate": error_rate
            },
            "recent_activity": recent_activity,
            "active_subscriptions": active_subscriptions
        })
