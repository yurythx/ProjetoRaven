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
        resp = urllib.request.urlopen(req, timeout=15)
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


def main():
    base = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
    suffix = os.environ.get("SMOKE_SUFFIX") or str(int(time.time()))

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@raven.gg")
    admin_pass = os.environ.get("ADMIN_PASS", "admin123")

    status, payload = request_json(
        f"{base}/api/v1/accounts/login/",
        method="POST",
        body={"email": admin_email, "password": admin_pass},
    )
    assert_status("accounts:login", status, 200)

    tokens = payload.get("tokens") if isinstance(payload, dict) else None
    access = tokens.get("access") if isinstance(tokens, dict) else None
    if not access:
        raise RuntimeError("accounts:login missing access token")

    auth = {"Authorization": f"Bearer {access}"}

    status, _ = request_json(f"{base}/api/v1/accounts/me/", headers=auth)
    assert_status("accounts:me", status, 200)

    status, _ = request_json(f"{base}/api/v1/blog/categories/", method="POST", body={"name": "X", "slug": "x"})
    assert_status("blog:categories anon write", status, (401, 403))

    cat_slug = f"smoke-cat-{suffix}"
    status, payload = request_json(
        f"{base}/api/v1/blog/categories/",
        method="POST",
        headers=auth,
        body={"name": f"Smoke Category {suffix}", "slug": cat_slug, "description": "smoke"},
    )
    assert_status("blog:categories create", status, (200, 201))
    category_id = payload.get("id") if isinstance(payload, dict) else None
    if not category_id:
        raise RuntimeError("blog:categories missing id")

    tag_slug = f"smoke-tag-{suffix}"
    status, payload = request_json(
        f"{base}/api/v1/blog/tags/",
        method="POST",
        headers=auth,
        body={"name": f"Smoke Tag {suffix}", "slug": tag_slug},
    )
    assert_status("blog:tags create", status, (200, 201))
    tag_id = payload.get("id") if isinstance(payload, dict) else None
    if not tag_id:
        raise RuntimeError("blog:tags missing id")

    post_slug = f"smoke-post-{suffix}"
    status, payload = request_json(
        f"{base}/api/v1/blog/posts/",
        method="POST",
        headers=auth,
        body={
            "title": f"Smoke Post {suffix}",
            "slug": post_slug,
            "excerpt": "Smoke test",
            "content": "<p>Smoke</p>",
            "category_id": category_id,
            "tags": [tag_id],
            "status": "draft",
            "is_featured": False,
            "meta_title": f"Smoke Post {suffix}",
            "meta_description": f"Smoke Post {suffix}",
            "meta_keywords": "smoke",
        },
    )
    assert_status("blog:posts create draft", status, 201)

    status, payload = request_json(f"{base}/api/v1/blog/public/posts/?search=Smoke+Post&page=1&page_size=5")
    assert_status("blog:public list", status, 200)
    results = payload.get("results") if isinstance(payload, dict) else None
    if isinstance(results, list) and any(x.get("slug") == post_slug for x in results if isinstance(x, dict)):
        raise RuntimeError("blog:public list leaked draft")

    status, _ = request_json(f"{base}/api/v1/blog/posts/{post_slug}/publish/", method="POST", headers=auth)
    assert_status("blog:posts publish", status, 200)

    status, payload = request_json(f"{base}/api/v1/blog/public/posts/?search=Smoke+Post&page=1&page_size=5")
    assert_status("blog:public list after publish", status, 200)
    results = payload.get("results") if isinstance(payload, dict) else None
    if not (isinstance(results, list) and any(x.get("slug") == post_slug for x in results if isinstance(x, dict))):
        raise RuntimeError("blog:public list missing published post")

    status, payload = request_json(
        f"{base}/api/v1/blog/comments/",
        method="POST",
        body={"post_slug": post_slug, "content": "Smoke comment", "name": "Anon", "email": "anon@example.com"},
    )
    assert_status("blog:comments create", status, 201)

    status, payload = request_json(f"{base}/api/v1/blog/public/comments/?post_slug={post_slug}")
    assert_status("blog:public comments list", status, (200, 400))

    status, payload = request_json(
        f"{base}/api/v1/forum/categories/",
        method="POST",
        headers=auth,
        body={"name": f"Smoke Forum {suffix}", "slug": f"smoke-forum-{suffix}", "description": "smoke", "icon": "🧪", "is_active": True},
    )
    assert_status("forum:category create", status, 201)
    forum_cat_id = payload.get("id") if isinstance(payload, dict) else None
    if not forum_cat_id:
        raise RuntimeError("forum:category missing id")

    status, payload = request_json(
        f"{base}/api/v1/forum/topics/",
        method="POST",
        headers=auth,
        body={"title": f"Smoke Topic {suffix}", "slug": f"smoke-topic-{suffix}", "content": "Smoke", "category": forum_cat_id},
    )
    assert_status("forum:topic create", status, 201)

    status, payload = request_json(f"{base}/api/v1/forum/topics/smoke-topic-{suffix}/with_replies/", method="GET")
    assert_status("forum:topic with_replies", status, 200)

    topic_id = (payload.get("topic") or {}).get("id") if isinstance(payload, dict) else None
    if not topic_id:
        raise RuntimeError("forum:topic with_replies missing topic id")

    status, payload = request_json(
        f"{base}/api/v1/forum/replies/",
        method="POST",
        headers=auth,
        body={"content": "Smoke reply", "topic": topic_id},
    )
    assert_status("forum:reply create", status, 201)

    print("OK")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {e}")
        sys.exit(1)
