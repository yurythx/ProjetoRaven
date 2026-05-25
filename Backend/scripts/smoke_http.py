import json
import os
import ssl
import socket
import sys
import urllib.parse


def request_json(url: str, method: str = "GET", headers: dict | None = None, body: dict | None = None):
    parsed = urllib.parse.urlparse(url)
    scheme = parsed.scheme or "http"
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if scheme == "https" else 80)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    payload = None
    data = b""
    req_headers = {**(headers or {})}
    if body is not None:
        data = json.dumps(body).encode()
        req_headers["Content-Type"] = "application/json"
        req_headers["Content-Length"] = str(len(data))
    else:
        req_headers["Content-Length"] = "0"

    if "Host" not in {k.title(): v for k, v in req_headers.items()}:
        req_headers["Host"] = f"{host}:{port}" if (scheme == "http" and port != 80) or (scheme == "https" and port != 443) else host

    req_lines = [f"{method} {path} HTTP/1.1"]
    for k, v in req_headers.items():
        req_lines.append(f"{k}: {v}")
    req_lines.append("Connection: close")
    req_lines.append("")
    req_lines.append("")
    req_bytes = "\r\n".join(req_lines).encode() + data

    s = socket.create_connection((host, port), timeout=10)
    try:
        if scheme == "https":
            ctx = ssl.create_default_context()
            s = ctx.wrap_socket(s, server_hostname=host)
        s.sendall(req_bytes)

        buf = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            buf += chunk
    finally:
        try:
            s.close()
        except Exception:
            pass

    head, _, body_bytes = buf.partition(b"\r\n\r\n")
    head_text = head.decode(errors="replace")
    status_line = head_text.split("\r\n", 1)[0]
    try:
        status = int(status_line.split(" ", 2)[1])
    except Exception:
        return 0, {"raw": head_text}

    raw = body_bytes.decode(errors="replace")
    if not raw:
        return status, None
    try:
        payload = json.loads(raw)
    except Exception:
        payload = {"raw": raw}
    return status, payload


def main():
    base = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
    email = os.environ.get("SMOKE_EMAIL", "admin@raven.gg")
    password = os.environ.get("SMOKE_PASS", "admin123")
    host_header = (os.environ.get("SMOKE_HOST_HEADER") or "").strip()

    base_headers = {}
    if host_header:
        base_headers["Host"] = host_header

    checks = [
        ("live", f"{base}/api/health/live/"),
        ("ready", f"{base}/api/health/ready/"),
    ]

    for name, url in checks:
        status, payload = request_json(url, headers=base_headers)
        print(f"[health:{name}] {status} {payload}")
        if status != 200:
            sys.exit(2)

    login_url = f"{base}/api/v1/accounts/login/"
    status, payload = request_json(
        login_url,
        method="POST",
        headers=base_headers,
        body={"email": email, "password": password},
    )
    tokens = payload.get("tokens") if isinstance(payload, dict) else None
    access = None
    if isinstance(payload, dict):
        access = payload.get("access") or (tokens.get("access") if isinstance(tokens, dict) else None)

    printable = payload
    if isinstance(payload, dict) and isinstance(tokens, dict):
        printable = {
            **{k: v for k, v in payload.items() if k != "tokens"},
            "tokens": {k: f"<redacted:{len(v)}>" for k, v in tokens.items() if isinstance(v, str)},
        }

    print(f"[auth:login] {status} {printable}")
    if status != 200 or not access:
        sys.exit(3)

    auth_headers = {**base_headers, "Authorization": f"Bearer {access}"}

    me_url = f"{base}/api/v1/accounts/me/"
    status, payload = request_json(me_url, headers=auth_headers)
    print(f"[auth:me] {status} keys={list(payload.keys()) if isinstance(payload, dict) else payload}")
    if status != 200:
        sys.exit(4)

    print("OK")


if __name__ == "__main__":
    main()
