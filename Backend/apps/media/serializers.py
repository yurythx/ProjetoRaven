from rest_framework import serializers
from django.conf import settings

from apps.common.utils import build_media_url
from .models import MediaFile


class MediaFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source="uploaded_by.display_name", read_only=True)

    class Meta:
        model = MediaFile
        fields = ["id", "image", "url", "alt_text", "original_filename", "width", "height", "uploaded_by_name", "created_at"]
        read_only_fields = ["id", "original_filename", "width", "height", "uploaded_by_name", "created_at"]

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
            try:
                from PIL import Image as PilImage

                pos = image.tell() if hasattr(image, "tell") else None
                if hasattr(image, "seek"):
                    image.seek(0)
                with PilImage.open(image) as img:
                    validated_data["width"], validated_data["height"] = img.size
                if pos is not None and hasattr(image, "seek"):
                    image.seek(pos)
            except Exception:
                pass
        return super().create(validated_data)
