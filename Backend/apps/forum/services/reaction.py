from typing import Optional
from django.db import transaction
from ..models import Topic, Reply, TopicReaction, ReplyReaction

class ReactionService:
    """Service for managing reactions."""

    REACTION_TYPES = ["like", "dislike", "heart", "laugh", "wow"]

    @classmethod
    @transaction.atomic
    def add_topic_reaction(cls, topic: Topic, user, reaction: str) -> Optional[TopicReaction]:
        """Add reaction to topic."""
        if reaction not in cls.REACTION_TYPES:
            raise ValueError(f"Invalid reaction type. Choose from: {cls.REACTION_TYPES}")

        existing = TopicReaction.objects.filter(
            user=user, topic=topic, reaction=reaction
        ).first()

        if existing:
            existing.delete()
            return None

        other_reactions = TopicReaction.objects.filter(user=user, topic=topic)
        other_reactions.delete()

        return TopicReaction.objects.create(
            user=user,
            topic=topic,
            reaction=reaction
        )

    @classmethod
    @transaction.atomic
    def add_reply_reaction(cls, reply: Reply, user, reaction: str) -> Optional[ReplyReaction]:
        """Add reaction to reply."""
        if reaction not in cls.REACTION_TYPES:
            raise ValueError(f"Invalid reaction type. Choose from: {cls.REACTION_TYPES}")

        existing = ReplyReaction.objects.filter(
            user=user, reply=reply, reaction=reaction
        ).first()

        if existing:
            existing.delete()
            return None

        other_reactions = ReplyReaction.objects.filter(user=user, reply=reply)
        other_reactions.delete()

        return ReplyReaction.objects.create(
            user=user,
            reply=reply,
            reaction=reaction
        )

    @classmethod
    def get_topic_reactions(cls, topic: Topic) -> dict:
        """Get reaction summary for a topic."""
        from django.db.models import Count
        reactions = TopicReaction.objects.filter(topic=topic).values('reaction').annotate(count=Count('reaction'))
        summary = {r: 0 for r in cls.REACTION_TYPES}
        for r in reactions:
            summary[r['reaction']] = r['count']
        return summary

    @classmethod
    def get_reply_reactions(cls, reply: Reply) -> dict:
        """Get reaction summary using prefetch cache when available, else single query."""
        summary = {r: 0 for r in cls.REACTION_TYPES}
        for reaction_obj in reply.reactions.all():
            r = reaction_obj.reaction
            if r in summary:
                summary[r] += 1
        return summary
