from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PushSubscription


class PushSubscribeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Save or update a Web Push subscription for the authenticated user."""
        data = request.data
        endpoint = data.get("endpoint", "").strip()
        p256dh = (data.get("keys") or {}).get("p256dh", "").strip()
        auth = (data.get("keys") or {}).get("auth", "").strip()

        if not endpoint or not p256dh or not auth:
            return Response({"detail": "endpoint, keys.p256dh and keys.auth are required."}, status=status.HTTP_400_BAD_REQUEST)

        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={"user": request.user, "p256dh": p256dh, "auth": auth},
        )
        return Response({"detail": "subscribed"}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        """Remove a Web Push subscription by endpoint."""
        endpoint = request.data.get("endpoint", "").strip()
        if not endpoint:
            return Response({"detail": "endpoint required."}, status=status.HTTP_400_BAD_REQUEST)
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VapidPublicKeyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Return the VAPID public key so the frontend can subscribe."""
        key = getattr(settings, "VAPID_PUBLIC_KEY", "")
        if not key:
            return Response({"detail": "Push notifications not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"public_key": key})
