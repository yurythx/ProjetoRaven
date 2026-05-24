from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import Q
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from ..services.management import UserManagementService
from ..serializers.user import UserAdminSerializer, UserListSerializer, UserAdminCreateSerializer
from ..serializers.admin import BanUserSerializer, ResetPasswordSerializer
from ..permissions import IsSuperUser
from apps.common.utils import get_ip_and_ua

User = get_user_model()

class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200

class UserViewSet(viewsets.ModelViewSet):
    """Admin viewset for full user management."""
    queryset = User.objects.all()
    permission_classes = [permissions.IsAdminUser]
    serializer_class = UserAdminSerializer
    pagination_class = StandardPagination

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.service = UserManagementService()

    def get_serializer_class(self):
        if self.action == "list":
            return UserListSerializer
        if self.action == "create":
            return UserAdminCreateSerializer
        return UserAdminSerializer

    def get_permissions(self):
        superuser_actions = ["list", "retrieve", "ban", "unban", "reset_password", "activate", "deactivate", "verify_admin"]
        if self.action in superuser_actions:
            return [IsSuperUser()]
        return [permissions.IsAdminUser()]

    def _apply_filters(self, qs):
        params = self.request.query_params
        query = (params.get("q") or params.get("search") or "").strip()
        if query:
            qs = qs.filter(
                Q(email__icontains=query) | Q(username__icontains=query) | Q(display_name__icontains=query)
            )

        for field, param in [("is_active", "is_active"), ("is_banned", "is_banned"), ("is_staff", "is_staff")]:
            val = params.get(param)
            if val in ["true", "false"]:
                qs = qs.filter(**{field: val == "true"})

        group = (params.get("group") or "").strip()
        if group:
            qs = qs.filter(groups__name=group)

        ordering = params.get("ordering")
        if ordering:
            allowed = {"date_joined", "last_login", "email", "username", "is_active", "is_banned", "is_staff", "is_superuser"}
            fields = [p for p in (x.strip() for x in str(ordering).split(",")) if (p.lstrip("-") in allowed)]
            if fields:
                qs = qs.order_by(*fields)

        return qs.distinct()

    def get_queryset(self):
        qs = User.objects.all().prefetch_related("groups")
        if self.action in ["list", "search", "banned"]:
            return self._apply_filters(qs)
        return qs

    @action(detail=True, methods=["post"])
    def ban(self, request, pk=None):
        user = self.get_object()
        serializer = BanUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address, user_agent = get_ip_and_ua(request)
        try:
            self.service.ban_user(
                user=user, reason=serializer.validated_data["reason"],
                banned_by=request.user, ip_address=ip_address, user_agent=user_agent,
            )
            return Response({"message": f"User {user.username} has been banned."}, status=status.HTTP_200_OK)
        except (PermissionError, ValueError) as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=["post"])
    def unban(self, request, pk=None):
        user = self.get_object()
        ip_address, user_agent = get_ip_and_ua(request)
        try:
            self.service.unban_user(user=user, unbanned_by=request.user, ip_address=ip_address, user_agent=user_agent)
            return Response({"message": f"User {user.username} has been unbanned."}, status=status.HTTP_200_OK)
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address, user_agent = get_ip_and_ua(request)
        try:
            self.service.reset_password(
                user=user, new_password=serializer.validated_data["new_password"],
                reset_by=request.user, ip_address=ip_address, user_agent=user_agent,
            )
            return Response({"message": f"Password for {user.username} has been reset."}, status=status.HTTP_200_OK)
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        user = self.get_object()
        ip_address, user_agent = get_ip_and_ua(request)
        self.service.activate_user(user, request.user, ip_address, user_agent)
        return Response({"message": f"User {user.username} has been activated."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        ip_address, user_agent = get_ip_and_ua(request)
        try:
            self.service.deactivate_user(user, request.user, ip_address, user_agent)
            return Response({"message": f"User {user.username} has been deactivated."}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=["post"])
    def verify_admin(self, request, pk=None):
        user = self.get_object()
        ip_address, user_agent = get_ip_and_ua(request)
        self.service.verify_admin(user, request.user, ip_address, user_agent)
        return Response({"message": f"User {user.username} has been verified by admin."})

    @action(detail=False, methods=["get"])
    def search(self, request):
        if not request.query_params.get("q", ""):
            return Response({"error": "Query parameter 'q' is required."}, status=status.HTTP_400_BAD_REQUEST)
        users = self.get_queryset()
        page = self.paginate_queryset(users)
        if page is not None:
            return self.get_paginated_response(UserListSerializer(page, many=True).data)
        return Response(UserListSerializer(users, many=True).data)

    @action(detail=False, methods=["get"])
    def banned(self, request):
        users = self.get_queryset().filter(is_banned=True)
        page = self.paginate_queryset(users)
        if page is not None:
            return self.get_paginated_response(UserListSerializer(page, many=True).data)
        return Response(UserListSerializer(users, many=True).data)

    @action(detail=False, methods=["get"])
    def groups(self, request):
        qs = Group.objects.all() if request.user.is_superuser else Group.objects.exclude(name="admins")
        names = list(qs.order_by("name").values_list("name", flat=True))
        return Response({"results": names})
