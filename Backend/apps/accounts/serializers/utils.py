def extract_request_ip_user_agent(request):
    if not request:
        return None, None
    xff = request.META.get("HTTP_X_FORWARDED_FOR") or ""
    ip_address = xff.split(",")[0].strip() or request.META.get("REMOTE_ADDR")
    user_agent = request.META.get("HTTP_USER_AGENT", "")
    return ip_address or None, user_agent or ""
