from rest_framework import serializers

class FriendshipSerializer(serializers.ModelSerializer):
    """Serializer for friendship status."""
    from_user_details = serializers.SerializerMethodField()
    to_user_details = serializers.SerializerMethodField()

    class Meta:
        from apps.accounts.models import Friendship
        model = Friendship
        fields = [
            "id", "from_user", "to_user", "status", "created_at",
            "from_user_details", "to_user_details"
        ]
        read_only_fields = ["id", "from_user", "created_at", "from_user_details", "to_user_details"]

    def get_from_user_details(self, obj):
        return {"id": str(obj.from_user.id), "display_name": obj.from_user.display_name}

    def get_to_user_details(self, obj):
        return {"id": str(obj.to_user.id), "display_name": obj.to_user.display_name}


class FriendshipCreateSerializer(serializers.Serializer):
    """Serializer for creating a friendship request."""
    to_user_id = serializers.UUIDField(required=True)
