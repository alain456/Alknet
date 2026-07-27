from rest_framework import serializers
from .models import Profile

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['avatar', 'bio', 'date_of_birth', 'address', 'city', 'country', 'updated_at']
        read_only_fields = ['updated_at']
