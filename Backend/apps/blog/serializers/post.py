from rest_framework import serializers
from apps.blog.models import Post, Category
from .tag import TagSerializer
from .category import CategorySerializer

class PostListSerializer(serializers.ModelSerializer):
    """Serializer for post list (lightweight)."""

    author_name = serializers.CharField(source="author.display_name", read_only=True)
    category_name = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    tag_slugs = serializers.SerializerMethodField()
    category_slug = serializers.SerializerMethodField()
    category_id = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "author_name",
            "category_name",
            "category_slug",
            "category_id",
            "status",
            "is_public",
            "is_featured",
            "published_at",
            "created_at",
            "updated_at",
            "view_count",
            "read_time_minutes",
            "image",
            "tags",
            "tag_slugs",
        ]

    def get_category_name(self, obj):
        if not obj.category_id:
            return None
        return obj.category.name

    def get_tags(self, obj):
        return [tag.name for tag in obj.tags.all()]

    def get_tag_slugs(self, obj):
        return [tag.slug for tag in obj.tags.all()]

    def get_category_slug(self, obj):
        if not obj.category_id:
            return None
        return obj.category.slug

    def get_category_id(self, obj):
        if not obj.category_id:
            return None
        return str(obj.category_id)

    def get_image(self, obj):
        if not obj.image:
            return None
        from django.conf import settings
        from apps.common.utils import build_media_url
        relative = f"{settings.MEDIA_URL}{obj.image.name}"
        return build_media_url(relative, self.context.get("request"))


class PublicPostListSerializer(PostListSerializer):
    class Meta(PostListSerializer.Meta):
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "author_name",
            "category_name",
            "category_slug",
            "category_id",
            "is_featured",
            "published_at",
            "created_at",
            "updated_at",
            "view_count",
            "read_time_minutes",
            "image",
            "tags",
            "tag_slugs",
        ]


class PostDetailSerializer(serializers.ModelSerializer):
    """Serializer for post detail."""

    author_name = serializers.CharField(source="author.display_name", read_only=True)
    author_email = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "content",
            "author_name",
            "author_email",
            "category",
            "tags",
            "status",
            "rejection_reason",
            "is_public",
            "is_featured",
            "published_at",
            "created_at",
            "updated_at",
            "view_count",
            "read_time_minutes",
            "image",
            "meta_title",
            "meta_description",
            "meta_keywords",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("author_email") is None:
            data.pop("author_email", None)
        return data

    def get_author_email(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated and (request.user.is_staff or request.user.groups.filter(name="editors").exists()):
            return obj.author.email
        return None

    def get_image(self, obj):
        if not obj.image:
            return None
        from django.conf import settings
        from apps.common.utils import build_media_url
        relative = f"{settings.MEDIA_URL}{obj.image.name}"
        return build_media_url(relative, self.context.get("request"))


class PublicPostDetailSerializer(serializers.ModelSerializer):
    author_id = serializers.CharField(source="author.id", read_only=True)
    author_name = serializers.CharField(source="author.display_name", read_only=True)
    author_username = serializers.CharField(source="author.username", read_only=True)
    author_bio = serializers.CharField(source="author.bio", read_only=True)
    author_avatar_url = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "content",
            "author_id",
            "author_name",
            "author_username",
            "author_bio",
            "author_avatar_url",
            "category",
            "tags",
            "is_featured",
            "published_at",
            "created_at",
            "updated_at",
            "view_count",
            "read_time_minutes",
            "image",
            "meta_title",
            "meta_description",
            "meta_keywords",
        ]

    def get_author_avatar_url(self, obj):
        if not obj.author.avatar:
            return None
        from django.conf import settings
        from apps.common.utils import build_media_url
        relative = f"{settings.MEDIA_URL}{obj.author.avatar.name}"
        return build_media_url(relative, self.context.get("request"))

    def get_image(self, obj):
        if not obj.image:
            return None
        from django.conf import settings
        from apps.common.utils import build_media_url
        relative = f"{settings.MEDIA_URL}{obj.image.name}"
        return build_media_url(relative, self.context.get("request"))


class PostCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating posts."""

    category = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    slug = serializers.SlugField(required=False, allow_blank=True)
    excerpt = serializers.CharField(required=False, allow_blank=True, default="")
    tags = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        write_only=True,
    )
    category_id = serializers.UUIDField(required=False, write_only=True)
    image = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Post
        fields = [
            "title",
            "slug",
            "excerpt",
            "content",
            "category",
            "tags",
            "category_id",
            "tag_names",
            "status",
            "rejection_reason",
            "is_featured",
            "image",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "published_at",
        ]

    def validate_image(self, value):
        if not value:
            return None
        if isinstance(value, str):
            from django.conf import settings
            media_url = getattr(settings, 'MEDIA_URL', '/media/')
            # Absolute URL (http/https): parse out the path then strip MEDIA_URL prefix
            if value.startswith('http://') or value.startswith('https://'):
                from urllib.parse import urlparse
                path = urlparse(value).path
                if path.startswith(media_url):
                    return path[len(media_url):]
                return value
            # Relative URL starting with MEDIA_URL prefix
            if value.startswith(media_url):
                return value[len(media_url):]
        return value

    def validate_slug(self, value):
        if Post.objects.filter(slug=value).exists():
            raise serializers.ValidationError("A post with this slug already exists.")
        return value

    def validate_category_id(self, value):
        if value and not Category.objects.filter(id=value).exists():
            raise serializers.ValidationError("Category not found.")
        return value

    def create(self, validated_data):
        from apps.blog.services.post import PostService
        from apps.blog.repositories.post import DjangoPostRepository
        from apps.blog.repositories.tag import DjangoTagRepository

        tag_names = validated_data.pop("tag_names", [])
        tag_ids = validated_data.pop("tags", None) or []
        category_id = validated_data.pop("category", None) or validated_data.pop("category_id", None)
        validated_data.pop("author", None)

        author = self.context["request"].user

        if category_id is not None:
            validated_data["category_id"] = category_id
        if tag_ids:
            validated_data["tags"] = tag_ids
        if tag_names:
            validated_data["tag_names"] = tag_names

        service = PostService(DjangoPostRepository(), DjangoTagRepository())
        post = service.create_post(
            data=validated_data,
            author=author
        )
        return post


class PostUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating posts."""

    category = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    slug = serializers.SlugField(required=False, allow_blank=True)
    tags = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        write_only=True,
    )
    category_id = serializers.UUIDField(required=False, write_only=True)
    status = serializers.ChoiceField(choices=Post.Status.choices, required=False)
    image = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Post
        fields = [
            "title",
            "slug",
            "excerpt",
            "content",
            "category",
            "tags",
            "category_id",
            "tag_names",
            "status",
            "rejection_reason",
            "is_featured",
            "image",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "published_at",
        ]

    def validate_image(self, value):
        if not value:
            return None
        if isinstance(value, str):
            from django.conf import settings
            media_url = getattr(settings, 'MEDIA_URL', '/media/')
            if value.startswith('http://') or value.startswith('https://'):
                from urllib.parse import urlparse
                path = urlparse(value).path
                if path.startswith(media_url):
                    return path[len(media_url):]
                return value
            if value.startswith(media_url):
                return value[len(media_url):]
        return value

    def validate_slug(self, value):
        if Post.objects.filter(slug=value).exclude(id=self.instance.id).exists():
            raise serializers.ValidationError("A post with this slug already exists.")
        return value

    def validate_category_id(self, value):
        if value and not Category.objects.filter(id=value).exists():
            raise serializers.ValidationError("Category not found.")
        return value

    def update(self, instance, validated_data):
        from apps.blog.services.post import PostService
        from apps.blog.repositories.post import DjangoPostRepository
        from apps.blog.repositories.tag import DjangoTagRepository

        tag_names = validated_data.pop("tag_names", None)
        tag_ids = validated_data.pop("tags", None)
        category_id = validated_data.pop("category", None) or validated_data.pop("category_id", None)

        validated_data["category_id"] = category_id
        if tag_names is not None:
            validated_data["tag_names"] = tag_names
        if tag_ids is not None:
            validated_data["tag_ids"] = tag_ids

        updated_by = self.context["request"].user
        service = PostService(DjangoPostRepository(), DjangoTagRepository())
        return service.update_post(instance, validated_data, updated_by)


class PostAdminSerializer(serializers.ModelSerializer):
    """Serializer for admin post management."""

    author_name = serializers.CharField(source="author.display_name", read_only=True)
    category_name = serializers.SerializerMethodField()

    def get_category_name(self, obj):
        if not obj.category_id:
            return None
        return obj.category.name

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "author_name",
            "category_name",
            "status",
            "is_public",
            "is_featured",
            "published_at",
            "created_at",
            "updated_at",
            "view_count",
        ]
        read_only_fields = fields
