from rest_framework import serializers
from .images import assign_person_photo
from .models import Profile

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['avatar', 'bio', 'date_of_birth', 'address', 'city', 'country', 'updated_at']
        read_only_fields = ['updated_at']

    def update(self, instance, validated_data):
        if 'avatar' in validated_data:
            assign_person_photo(instance.user, validated_data.pop('avatar'))
            instance.refresh_from_db(fields=['avatar'])
        return super().update(instance, validated_data)
