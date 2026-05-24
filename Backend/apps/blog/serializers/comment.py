from rest_framework import serializers
from apps.blog.models import Comment, Post

class CommentListSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    reply_count = serializers.SerializerMethodField()
    article_slug = serializers.CharField(source="post.slug", read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "content",
            "author_name",
            "name",
            "email",
            "post",
            "parent",
            "is_public",
            "is_approved",
            "reply_count",
            "article_slug",
            "created_at",
        ]
        read_only_fields = fields

    def get_author_name(self, obj):
        if obj.author_id:
            return obj.author.display_name or obj.author.username
        return obj.name or None

    def get_reply_count(self, obj):
        return obj.replies.filter(is_public=True, is_approved=True).count()


class CommentCreateSerializer(serializers.ModelSerializer):
    post = serializers.PrimaryKeyRelatedField(queryset=Post.objects.all(), required=False)
    post_slug = serializers.SlugField(write_only=True, required=False)
    article = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = Comment
        fields = ["post", "post_slug", "article", "parent", "content", "name", "email", "website"]

    def validate(self, attrs):
        article = attrs.pop("article", None)
        if article and not attrs.get("post"):
            try:
                attrs["post"] = Post.objects.get(id=article)
            except Post.DoesNotExist:
                raise serializers.ValidationError("article not found.")
        if not attrs.get("post") and not attrs.get("post_slug"):
            raise serializers.ValidationError("post or post_slug is required.")
        return attrs

    def create(self, validated_data):
        from apps.blog.services.comment import CommentService
        from apps.blog.repositories.comment import DjangoCommentRepository

        request = self.context["request"]
        post_slug = validated_data.pop("post_slug", None)
        
        service = CommentService(DjangoCommentRepository())
        return service.create_comment(
            author=request.user if request.user.is_authenticated else None,
            post=validated_data.get("post"),
            post_slug=post_slug,
            parent=validated_data.get("parent"),
            content=validated_data["content"],
            name=validated_data.get("name", ""),
            email=validated_data.get("email", ""),
            website=validated_data.get("website", ""),
        )


class ModerationCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.display_name", read_only=True)
    article = serializers.UUIDField(source="post_id", read_only=True)
    article_title = serializers.CharField(source="post.title", read_only=True)
    article_slug = serializers.CharField(source="post.slug", read_only=True)
    reply_count = serializers.IntegerField(source="replies.count", read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "article",
            "article_title",
            "article_slug",
            "parent",
            "content",
            "created_at",
            "is_approved",
            "is_public",
            "author_name",
            "name",
            "email",
            "reply_count",
        ]
        read_only_fields = fields


class ModerationCommentCreateSerializer(serializers.Serializer):
    article = serializers.UUIDField()
    content = serializers.CharField()
