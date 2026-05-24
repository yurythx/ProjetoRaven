"""
Common utility functions for the Raven Project.
"""

def build_media_url(relative_path: str, request=None) -> str:
    """
    Build a URL for a media file path.

    Uses SITE_URL when set (production). Otherwise returns the relative path
    so that the frontend proxy (/media/* → Django) resolves it — avoids
    leaking the internal Docker hostname (http://django:8000) to browsers.
    """
    from django.conf import settings
    site_url = getattr(settings, "SITE_URL", "").rstrip("/")
    if site_url:
        return f"{site_url}{relative_path}"
    return relative_path


def get_client_ip(request):
    """
    Extract the client's IP address from a request.
    Handles proxies using HTTP_X_FORWARDED_FOR.
    """
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        # Get the first IP in the list (the actual client)
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def get_user_agent(request):
    """
    Extract the User-Agent string from a request.
    """
    return request.META.get("HTTP_USER_AGENT", "")


def get_ip_and_ua(request):
    """
    Convenience function to get both IP and User-Agent.
    """
    return get_client_ip(request), get_user_agent(request)
