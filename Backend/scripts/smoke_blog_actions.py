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

    status, cats = request_json(f"{base}/api/v1/blog/categories/", headers=auth)
    assert_status("blog:categories list", status, 200)
    category_id = (cats[0] or {}).get("id") if isinstance(cats, list) and cats else None
    if not category_id:
        status, cat = request_json(
            f"{base}/api/v1/blog/categories/",
            method="POST",
            headers=auth,
            body={"name": f"E2E Cat {suffix}", "slug": f"e2e-cat-{suffix}", "description": "e2e"},
        )
        assert_status("blog:categories create", status, (200, 201))
        category_id = cat.get("id") if isinstance(cat, dict) else None
    if not category_id:
        raise RuntimeError("blog:categories missing id")

    status, tags = request_json(f"{base}/api/v1/blog/tags/", headers=auth)
    assert_status("blog:tags list", status, 200)
    tag_id = (tags[0] or {}).get("id") if isinstance(tags, list) and tags else None
    if not tag_id:
        status, tag = request_json(
            f"{base}/api/v1/blog/tags/",
            method="POST",
            headers=auth,
            body={"name": f"E2E Tag {suffix}", "slug": f"e2e-tag-{suffix}"},
        )
        assert_status("blog:tags create", status, (200, 201))
        tag_id = tag.get("id") if isinstance(tag, dict) else None
    if not tag_id:
        raise RuntimeError("blog:tags missing id")

    post_slug = f"e2e-post-{suffix}"
    status, _ = request_json(
        f"{base}/api/v1/blog/posts/",
        method="POST",
        headers=auth,
        body={
            "title": f"E2E Post {suffix}",
            "slug": post_slug,
            "excerpt": "e2e",
            "content": "<p>e2e</p>",
            "category_id": category_id,
            "tags": [tag_id],
            "status": "draft",
            "is_featured": False,
            "meta_title": f"E2E Post {suffix}",
            "meta_description": f"E2E Post {suffix}",
            "meta_keywords": "e2e",
        },
    )
    assert_status("blog:posts create", status, 201)

    status, _ = request_json(f"{base}/api/v1/blog/posts/{post_slug}/submit/", method="POST", headers=auth)
    assert_status("blog:posts submit", status, 200)

    status, _ = request_json(
        f"{base}/api/v1/blog/posts/{post_slug}/reject/",
        method="POST",
        headers=auth,
        body={"reason": "nao atende"},
    )
    assert_status("blog:posts reject", status, 200)

    status, detail = request_json(f"{base}/api/v1/blog/posts/{post_slug}/", headers=auth)
    assert_status("blog:posts detail after reject", status, 200)
    if (detail or {}).get("status") != "rejected":
        raise RuntimeError(f"blog:posts expected rejected, got {(detail or {}).get('status')}")
    if not ((detail or {}).get("rejection_reason") or ""):
        raise RuntimeError("blog:posts expected rejection_reason after reject")

    status, _ = request_json(f"{base}/api/v1/blog/posts/{post_slug}/publish/", method="POST", headers=auth)
    assert_status("blog:posts publish", status, 200)

    status, detail = request_json(f"{base}/api/v1/blog/posts/{post_slug}/", headers=auth)
    assert_status("blog:posts detail after publish", status, 200)
    if (detail or {}).get("status") != "published":
        raise RuntimeError(f"blog:posts expected published, got {(detail or {}).get('status')}")
    if ((detail or {}).get("rejection_reason") or "") != "":
        raise RuntimeError("blog:posts expected rejection_reason cleared after publish")

    status, public = request_json(f"{base}/api/v1/blog/public/posts/?search=E2E+Post&page=1&page_size=5")
    assert_status("blog:public list after publish", status, 200)
    results = (public or {}).get("results") if isinstance(public, dict) else None
    if not (isinstance(results, list) and any(x.get("slug") == post_slug for x in results if isinstance(x, dict))):
        raise RuntimeError("blog:public list missing published post")

    status, _ = request_json(f"{base}/api/v1/blog/posts/{post_slug}/archive/", method="POST", headers=auth)
    assert_status("blog:posts archive", status, 200)

    status, public = request_json(f"{base}/api/v1/blog/public/posts/?search=E2E+Post&page=1&page_size=5")
    assert_status("blog:public list after archive", status, 200)
    results = (public or {}).get("results") if isinstance(public, dict) else None
    if isinstance(results, list) and any(x.get("slug") == post_slug for x in results if isinstance(x, dict)):
        raise RuntimeError("blog:public list leaked archived post")

    status, _ = request_json(f"{base}/api/v1/blog/posts/{post_slug}/", method="DELETE", headers=auth)
    assert_status("blog:posts delete", status, (200, 202, 204))

    print("OK")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {e}")
        sys.exit(1)

