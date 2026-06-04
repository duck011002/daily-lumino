import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import settings


def get_fernet_key() -> bytes:
    # Derive a Fernet key from settings.JWT_SECRET
    h = hashlib.sha256(settings.JWT_SECRET.encode()).digest()
    return base64.urlsafe_b64encode(h)


def encrypt_value(value: str) -> str:
    if not value:
        return ""
    f = Fernet(get_fernet_key())
    return f.encrypt(value.encode()).decode()


def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return ""
    try:
        f = Fernet(get_fernet_key())
        return f.decrypt(encrypted_value.encode()).decode()
    except Exception:
        # Fallback if decryption fails (e.g. if the value is not encrypted yet)
        return encrypted_value
