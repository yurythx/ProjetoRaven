from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services.social import SocialService
from ..serializers.social import FriendshipSerializer

class FriendshipView(APIView):
    """List friendships and send friend requests."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        friends = SocialService.list_friendships(request.user)
        return Response(FriendshipSerializer(friends, many=True).data)

    def post(self, request):
        to_user_id = request.data.get("user_id")
        if not to_user_id:
            return Response({"error": "user_id required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            friendship = SocialService.send_friend_request(request.user, to_user_id)
            return Response(FriendshipSerializer(friendship).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class FriendshipActionView(APIView):
    """Accept, reject, block, or remove a friendship."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, friendship_id):
        action = request.data.get("action")
        try:
            friendship = SocialService.handle_friendship_action(request.user, friendship_id, action)
            if friendship:
                return Response(FriendshipSerializer(friendship).data)
            return Response({"ok": True})
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, friendship_id):
        try:
            SocialService.remove_friendship(request.user, friendship_id)
            return Response({"ok": True}, status=status.HTTP_204_NO_CONTENT)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
