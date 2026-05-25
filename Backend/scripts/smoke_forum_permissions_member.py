import json
import os
import sys
import time
import urllib.error
import urllib.request


def request_json(url: str, method: str = "GET", headers: dict | None = None, body: dict | None = None):
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers = {**(headers or {}), "Content-Type": "application/json"}

    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        raw = resp.read().decode()
        return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = {"raw": raw}
        return e.code, payload


def assert_status(label: str, actual: int, expected: int | tuple[int, ...]):
    ok = actual == expected if isinstance(expected, int) else actual in expected
    if not ok:
        raise RuntimeError(f"{label}: expected {expected}, got {actual}")


def login(base: str, email: str, password: str) -> str:
    status, payload = request_json(
        f"{base}/api/v1/accounts/login/",
        method="POST",
        body={"email": email, "password": password},
    )
    assert_status("accounts:login", status, 200)
    tokens = payload.get("tokens") if isinstance(payload, dict) else None
    access = tokens.get("access") if isinstance(tokens, dict) else None
    if not access:
        raise RuntimeError("accounts:login missing access token")
    return access


def main():
    base = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
    suffix = os.environ.get("SMOKE_SUFFIX") or str(int(time.time()))

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@raven.gg")
    admin_pass = os.environ.get("ADMIN_PASS", "admin123")

    member_email = os.environ.get("MEMBER_EMAIL", "player@raven.gg")
    member_pass = os.environ.get("MEMBER_PASS", "player123")

    admin_access = login(base, admin_email, admin_pass)
    member_access = login(base, member_email, member_pass)

    admin_h = {"Authorization": f"Bearer {admin_access}"}
    member_h = {"Authorization": f"Bearer {member_access}"}

    status, cats = request_json(f"{base}/api/v1/forum/public/categories/?page=1&page_size=50")
    assert_status("forum:public categories", status, 200)
    results = (cats or {}).get("results") if isinstance(cats, dict) else None
    category_id = (results[0] or {}).get("id") if isinstance(results, list) and results else None
    if not category_id:
        raise RuntimeError("forum:missing category id")

    admin_topic_slug = f"admin-topic-{suffix}"
    status, _ = request_json(
        f"{base}/api/v1/forum/topics/",
        method="POST",
        headers=admin_h,
        body={"title": f"Admin Topic {suffix}", "slug": admin_topic_slug, "content": "admin", "category": category_id},
    )
    assert_status("forum:admin topic create", status, 201)

    member_topic_slug = f"member-topic-{suffix}"
    status, _ = request_json(
        f"{base}/api/v1/forum/topics/",
        method="POST",
        headers=member_h,
        body={"title": f"Member Topic {suffix}", "slug": member_topic_slug, "content": "member", "category": category_id},
    )
    assert_status("forum:member topic create", status, 201)

    status, _ = request_json(
        f"{base}/api/v1/forum/topics/{member_topic_slug}/",
        method="PATCH",
        headers=member_h,
        body={"title": f"Member Topic EDIT {suffix}"},
    )
    assert_status("forum:member edit own topic", status, (200, 202))

    status, _ = request_json(
        f"{base}/api/v1/forum/topics/{admin_topic_slug}/",
        method="PATCH",
        headers=member_h,
        body={"title": "HACK"},
    )
    assert_status("forum:member edit admin topic denied", status, (403, 404))

    status, _ = request_json(
        f"{base}/api/v1/forum/topics/{member_topic_slug}/pin/",
        method="POST",
        headers=member_h,
    )
    assert_status("forum:member pin denied", status, (403, 404))

    status, _ = request_json(
        f"{base}/api/v1/forum/topics/{member_topic_slug}/pin/",
        method="POST",
        headers=admin_h,
    )
    assert_status("forum:admin pin", status, 200)

    status, _ = request_json(
        f"{base}/api/v1/forum/topics/{member_topic_slug}/close/",
        method="POST",
        headers=admin_h,
    )
    assert_status("forum:admin close", status, 200)

    status, topic = request_json(f"{base}/api/v1/forum/public/topics/{member_topic_slug}/")
    assert_status("forum:public topic detail", status, 200)
    topic_id = (topic or {}).get("id") if isinstance(topic, dict) else None
    if not topic_id:
        raise RuntimeError("forum:topic detail missing id")

    status, _ = request_json(
        f"{base}/api/v1/forum/replies/",
        method="POST",
        headers=member_h,
        body={"topic": topic_id, "content": "reply closed"},
    )
    assert_status("forum:reply closed denied", status, 400)

    status, _ = request_json(
        f"{base}/api/v1/forum/topics/{member_topic_slug}/open/",
        method="POST",
        headers=admin_h,
    )
    assert_status("forum:admin open", status, 200)

    status, member_reply = request_json(
        f"{base}/api/v1/forum/replies/",
        method="POST",
        headers=member_h,
        body={"topic": topic_id, "content": "reply ok"},
    )
    assert_status("forum:member reply create", status, 201)
    member_reply_id = (member_reply or {}).get("id") if isinstance(member_reply, dict) else None
    if not member_reply_id:
        raise RuntimeError("forum:member reply missing id")

    status, admin_reply = request_json(
        f"{base}/api/v1/forum/replies/",
        method="POST",
        headers=admin_h,
        body={"topic": topic_id, "content": "admin reply"},
    )
    assert_status("forum:admin reply create", status, 201)
    admin_reply_id = (admin_reply or {}).get("id") if isinstance(admin_reply, dict) else None
    if not admin_reply_id:
        raise RuntimeError("forum:admin reply missing id")

    status, _ = request_json(
        f"{base}/api/v1/forum/replies/{admin_reply_id}/",
        method="DELETE",
        headers=member_h,
    )
    assert_status("forum:member delete admin reply denied", status, (403, 404))

    status, _ = request_json(
        f"{base}/api/v1/forum/replies/{member_reply_id}/",
        method="DELETE",
        headers=member_h,
    )
    assert_status("forum:member delete own reply", status, (200, 202, 204))

    print("OK")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {e}")
        sys.exit(1)
