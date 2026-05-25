from rest_framework import serializers
from django.conf import settings

from apps.common.utils import build_media_url
from .models import MediaFile


class MediaFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source="uploaded_by.display_name", read_only=True)

    class Meta:
        model = MediaFile
        fields = ["id", "image", "url", "alt_text", "original_filename", "uploaded_by_name", "created_at"]
        read_only_fields = ["id", "original_filename", "uploaded_by_name", "created_at"]

    def get_url(self, obj):
        if not obj.image:
            return None
        relative = f"{settings.MEDIA_URL}{obj.image.name}"
        return build_media_url(relative)

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["uploaded_by"] = request.user
        image = validated_data.get("image")
        if image and hasattr(image, "name"):
            validated_data["original_filename"] = image.name
        return super().create(validated_data)
