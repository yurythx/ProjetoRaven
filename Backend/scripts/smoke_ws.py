import base64
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


def websocket_handshake(host: str, port: int, path: str, origin: str, host_header: str | None = None) -> bool:
    key = base64.b64encode(os.urandom(16)).decode()
    host_value = host_header or f"{host}:{port}"
    req = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host_value}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Origin: {origin}\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n"
    ).encode()

    s = socket.create_connection((host, port), timeout=10)
    try:
        s.sendall(req)
        data = s.recv(4096).decode(errors="replace")
        status_line = data.split("\r\n", 1)[0]
        return status_line.startswith("HTTP/1.1 101")
    finally:
        s.close()


def main():
    base_http = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
    parsed = urllib.parse.urlparse(base_http)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    host_header = (os.environ.get("SMOKE_HOST_HEADER") or "").strip() or None
    origin = (os.environ.get("SMOKE_ORIGIN") or base_http).rstrip("/")

    email = os.environ.get("SMOKE_EMAIL", "admin@raven.gg")
    password = os.environ.get("SMOKE_PASS", "admin123")

    http_headers = {}
    if host_header:
        http_headers["Host"] = host_header

    status, payload = request_json(
        f"{base_http}/api/v1/accounts/login/",
        method="POST",
        headers=http_headers,
        body={"email": email, "password": password},
    )
    if status != 200 or not isinstance(payload, dict):
        print(f"[auth:login] {status} {payload}")
        sys.exit(2)

    tokens = payload.get("tokens") if isinstance(payload.get("tokens"), dict) else {}
    access = tokens.get("access") or payload.get("access")
    if not access:
        print("[auth:login] missing access token")
        sys.exit(3)

    ws_path = f"/ws/chat/global/?token={urllib.parse.quote(access)}"
    ok = websocket_handshake(host, port, ws_path, origin=origin, host_header=host_header)
    print(f"[ws:handshake] {'ok' if ok else 'fail'} {ws_path.split('?', 1)[0]}")
    if not ok:
        sys.exit(4)


if __name__ == "__main__":
    main()
