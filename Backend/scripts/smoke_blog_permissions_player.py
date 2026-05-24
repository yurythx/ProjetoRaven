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

    player_email = os.environ.get("PLAYER_EMAIL", "player1@raven.gg")
    player_pass = os.environ.get("PLAYER_PASS", "player123")

    admin_access = login(base, admin_email, admin_pass)
    player_access = login(base, player_email, player_pass)

    admin_h = {"Authorization": f"Bearer {admin_access}"}
    player_h = {"Authorization": f"Bearer {player_access}"}

    status, _ = request_json(
        f"{base}/api/v1/blog/categories/",
        method="POST",
        headers=player_h,
        body={"name": f"Nope {suffix}", "slug": f"nope-{suffix}"},
    )
    assert_status("blog:player category write denied", status, (403, 401))

    status, _ = request_json(
        f"{base}/api/v1/blog/tags/",
        method="POST",
        headers=player_h,
        body={"name": f"Nope {suffix}", "slug": f"nope-{suffix}"},
    )
    assert_status("blog:player tag write denied", status, (403, 401))

    status, _ = request_json(
        f"{base}/api/v1/blog/posts/",
        method="POST",
        headers=player_h,
        body={"title": "Nope", "slug": f"nope-{suffix}", "excerpt": "x", "content": "<p>x</p>"},
    )
    assert_status("blog:player post write denied", status, (403, 401))

    status, public = request_json(f"{base}/api/v1/blog/public/posts/?page=1&page_size=5")
    assert_status("blog:public list", status, 200)
    results = (public or {}).get("results") if isinstance(public, dict) else None
    if not isinstance(results, list):
        raise RuntimeError("blog:public list missing results")

    status, categories = request_json(f"{base}/api/v1/blog/public/categories/?page=1&page_size=50")
    assert_status("blog:public categories list", status, 200)
    cat_results = (categories or {}).get("results") if isinstance(categories, dict) else None
    if not isinstance(cat_results, list):
        raise RuntimeError("blog:public categories missing results")

    status, tags = request_json(f"{base}/api/v1/blog/public/tags/?page=1&page_size=50")
    assert_status("blog:public tags list", status, 200)
    tag_results = (tags or {}).get("results") if isinstance(tags, dict) else None
    if not isinstance(tag_results, list):
        raise RuntimeError("blog:public tags missing results")

    # create a published post via admin, then ensure player can see it in public list
    status, cats_admin = request_json(f"{base}/api/v1/blog/categories/", headers=admin_h)
    assert_status("blog:admin categories list", status, 200)
    category_id = (cats_admin[0] or {}).get("id") if isinstance(cats_admin, list) and cats_admin else None
    if not category_id:
        status, cat = request_json(
            f"{base}/api/v1/blog/categories/",
            method="POST",
            headers=admin_h,
            body={"name": f"E2E Cat {suffix}", "slug": f"e2e-cat-{suffix}", "description": "e2e"},
        )
        assert_status("blog:admin category create", status, (200, 201))
        category_id = cat.get("id") if isinstance(cat, dict) else None
    if not category_id:
        raise RuntimeError("blog:missing category id")

    status, tags_admin = request_json(f"{base}/api/v1/blog/tags/", headers=admin_h)
    assert_status("blog:admin tags list", status, 200)
    tag_id = (tags_admin[0] or {}).get("id") if isinstance(tags_admin, list) and tags_admin else None
    if not tag_id:
        status, tag = request_json(
            f"{base}/api/v1/blog/tags/",
            method="POST",
            headers=admin_h,
            body={"name": f"E2E Tag {suffix}", "slug": f"e2e-tag-{suffix}"},
        )
        assert_status("blog:admin tag create", status, (200, 201))
        tag_id = tag.get("id") if isinstance(tag, dict) else None
    if not tag_id:
        raise RuntimeError("blog:missing tag id")

    post_slug = f"player-can-read-{suffix}"
    status, _ = request_json(
        f"{base}/api/v1/blog/posts/",
        method="POST",
        headers=admin_h,
        body={
            "title": f"Player can read {suffix}",
            "slug": post_slug,
            "excerpt": "e2e",
            "content": "<p>e2e</p>",
            "category_id": category_id,
            "tags": [tag_id],
            "status": "draft",
            "is_featured": False,
            "meta_title": f"Player can read {suffix}",
            "meta_description": f"Player can read {suffix}",
            "meta_keywords": "e2e",
        },
    )
    assert_status("blog:admin post create", status, 201)

    status, public = request_json(f"{base}/api/v1/blog/public/posts/?search=Player+can+read&page=1&page_size=5")
    assert_status("blog:public list no draft", status, 200)
    results = (public or {}).get("results") if isinstance(public, dict) else None
    if isinstance(results, list) and any(x.get("slug") == post_slug for x in results if isinstance(x, dict)):
        raise RuntimeError("blog:public list leaked draft")

    status, _ = request_json(f"{base}/api/v1/blog/posts/{post_slug}/publish/", method="POST", headers=admin_h)
    assert_status("blog:admin publish", status, 200)

    status, public = request_json(f"{base}/api/v1/blog/public/posts/?search=Player+can+read&page=1&page_size=5")
    assert_status("blog:public list after publish", status, 200)
    results = (public or {}).get("results") if isinstance(public, dict) else None
    if not (isinstance(results, list) and any(x.get("slug") == post_slug for x in results if isinstance(x, dict))):
        raise RuntimeError("blog:public list missing published post")

    # Player should be able to read via public detail
    status, _ = request_json(f"{base}/api/v1/blog/public/posts/{post_slug}/")
    assert_status("blog:public detail", status, 200)

    # Comment as player (auth) should be allowed, or rejected explicitly; accept 201/400 based on moderation rules
    status, _ = request_json(
        f"{base}/api/v1/blog/comments/",
        method="POST",
        headers=player_h,
        body={"post_slug": post_slug, "content": "comment from player", "name": "Player", "email": player_email},
    )
    assert_status("blog:player comment create", status, (201, 400))

    status, _ = request_json(f"{base}/api/v1/blog/posts/{post_slug}/archive/", method="POST", headers=admin_h)
    assert_status("blog:admin archive", status, 200)

    status, public = request_json(f"{base}/api/v1/blog/public/posts/?search=Player+can+read&page=1&page_size=5")
    assert_status("blog:public list after archive", status, 200)
    results = (public or {}).get("results") if isinstance(public, dict) else None
    if isinstance(results, list) and any(x.get("slug") == post_slug for x in results if isinstance(x, dict)):
        raise RuntimeError("blog:public list leaked archived post")

    print("OK")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {e}")
        sys.exit(1)

