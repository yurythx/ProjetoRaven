"""
Script to generate RSA key pair for JWT signing.
Run: python keys/generate_keys.py
"""
import os
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from pathlib import Path

keys_dir = Path(__file__).resolve().parent

private_path = keys_dir / "private.pem"
public_path = keys_dir / "public.pem"

private_key_env = os.environ.get("JWT_PRIVATE_KEY") or ""
public_key_env = os.environ.get("JWT_PUBLIC_KEY") or ""

if (private_key_env and not public_key_env) or (public_key_env and not private_key_env):
    raise SystemExit("Both JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set together.")

if private_key_env and public_key_env:
    private_pem = private_key_env.strip() + "\n"
    public_pem = public_key_env.strip() + "\n"
    private_path.parent.mkdir(parents=True, exist_ok=True)
    private_path.write_text(private_pem, encoding="utf-8")
    public_path.write_text(public_pem, encoding="utf-8")
    print("RSA key pair synced from environment variables.")
    print(f"Private key: {private_path}")
    print(f"Public key: {public_path}")
    raise SystemExit(0)

if private_path.exists() and public_path.exists():
    print("RSA key pair already exists.")
    print(f"Private key: {private_path}")
    print(f"Public key: {public_path}")
    raise SystemExit(0)

private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)

private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption()
)

public_key = private_key.public_key()
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

private_path.write_bytes(private_pem)
public_path.write_bytes(public_pem)

print("RSA key pair generated successfully!")
print(f"Private key: {private_path}")
print(f"Public key: {public_path}")
