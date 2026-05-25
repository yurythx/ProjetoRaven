import uuid
from django.conf import settings
from django.db import models


class Notification(models.Model):
    VERB_FORUM_REPLY = "forum_reply"
    VERB_BLOG_COMMENT = "blog_comment"
    VERB_CHOICES = [
        (VERB_FORUM_REPLY, "Nova resposta no seu tópico"),
        (VERB_BLOG_COMMENT, "Novo comentário no seu artigo"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    verb = models.CharField(max_length=50, choices=VERB_CHOICES)
    actor_name = models.CharField(max_length=150)
    message = models.TextField()
    target_url = models.CharField(max_length=500, blank=True)
    read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "read"]),
        ]

    def __str__(self):
        return f"[{self.verb}] → {self.recipient_id} ({self.actor_name})"
