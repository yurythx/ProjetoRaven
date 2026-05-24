from rest_framework import serializers

class BulkActionSerializer(serializers.Serializer):
    """Serializer for bulk actions (publish, reject, delete)."""
    
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        help_text="List of post IDs to perform action on."
    )
    reason = serializers.CharField(
        required=False, 
        allow_blank=True, 
        help_text="Optional reason (used for rejection)."
    )
