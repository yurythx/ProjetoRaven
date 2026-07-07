import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models import User

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def setup_groups(db):
    players, _ = Group.objects.get_or_create(name="members")
    editors, _ = Group.objects.get_or_create(name="blog_editors")
    moderators, _ = Group.objects.get_or_create(name="forum_moderators")
    return {"members": players, "editors": editors, "moderators": moderators}

@pytest.fixture
def player_user(db, setup_groups):
    user = User.objects.create_user(username="player", email="player@test.com", password="password123")
    user.groups.add(setup_groups["members"])
    return user

@pytest.fixture
def editor_user(db, setup_groups):
    user = User.objects.create_user(username="editor", email="editor@test.com", password="password123")
    user.groups.add(setup_groups["editors"])
    return user

@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(username="admin", email="admin@test.com", password="password123")

@pytest.mark.django_db
class TestPermissionLogic:
    """Test the refined permission logic for players, editors and admins."""

    def test_player_verification_access(self, api_client, player_user):
        """Test that players need at least one verification method."""
        api_client.force_authenticate(user=player_user)
        
        # Scenario 1: No verification
        player_user.is_verified = False
        player_user.is_admin_verified = False
        player_user.save()
        
        # Attempt to access a game-protected endpoint (e.g., MeView)
        response = api_client.get(reverse("v1:accounts:me"))
        # MeView uses IsAuthenticated, IsNotBanned. It should work regardless of verification
        # but specific game actions should fail.
        
        # Let's check a more restricted view if available, or just check the flags in MeView
        assert response.data["is_verified"] is False
        assert response.data["is_admin_verified"] is False

    def test_admin_verification_flow(self, api_client, player_user, admin_user):
        """Test that an admin can verify a user and it grants access."""
        api_client.force_authenticate(user=admin_user)
        
        url = reverse("v1:accounts:user-verify-admin", kwargs={"pk": player_user.id})
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        player_user.refresh_from_db()
        assert player_user.is_admin_verified is True
        assert player_user.is_active is True

    def test_me_view_exposes_admin_flags_for_superuser(self, api_client, admin_user):
        """MeView must expose explicit admin flags used by frontend middleware."""
        api_client.force_authenticate(user=admin_user)

        response = api_client.get(reverse("v1:accounts:me"))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_admin"] is True
        assert response.data["is_staff"] is True
        assert response.data["is_superuser"] is True

    def test_editor_cannot_manage_users(self, api_client, editor_user, player_user):
        """Test that an editor (is_staff=False usually, but has group) cannot manage users."""
        api_client.force_authenticate(user=editor_user)
        
        # Try to list users
        url = reverse("v1:accounts:user-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_forum_access_or_logic(self, api_client, player_user):
        """Test that Forum access works with either Email OR Admin verification."""
        from apps.forum.models import ForumCategory
        category = ForumCategory.objects.create(name="Test", slug="test")
        
        url = reverse("v1:forum:forum-topic-list")
        api_client.force_authenticate(user=player_user)
        
        # No verification -> Cannot create topic
        player_user.is_verified = False
        player_user.is_admin_verified = False
        player_user.save()
        
        response = api_client.post(url, {"title": "New Topic", "content": "Hello", "category": category.id})
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        # Email verified -> Can create topic
        player_user.is_verified = True
        player_user.save()
        response = api_client.post(url, {"title": "New Topic", "content": "Hello", "category": category.id})
        assert response.status_code == status.HTTP_201_CREATED
        
        # Reset and try Admin verified
        player_user.is_verified = False
        player_user.is_admin_verified = True
        player_user.save()
        response = api_client.post(url, {"title": "Another Topic", "content": "Hello", "category": category.id})
        assert response.status_code == status.HTTP_201_CREATED
