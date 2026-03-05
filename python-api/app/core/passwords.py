from __future__ import annotations

import base64
import hashlib
import hmac
import os
from typing import Tuple


_DEFAULT_ITERATIONS = 210_000


def _pbkdf2_sha256(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=32,
    )


def hash_password(password: str, *, iterations: int = _DEFAULT_ITERATIONS) -> str:
    if not password:
        raise ValueError("password vazio")

    salt = os.urandom(16)
    dk = _pbkdf2_sha256(password, salt, iterations)

    salt_b64 = base64.urlsafe_b64encode(salt).decode("ascii").rstrip("=")
    dk_b64 = base64.urlsafe_b64encode(dk).decode("ascii").rstrip("=")

    return f"pbkdf2_sha256${iterations}${salt_b64}${dk_b64}"


def _parse_hash(stored: str) -> Tuple[int, bytes, bytes]:
    try:
        algo, iters_s, salt_b64, dk_b64 = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            raise ValueError("algo inválido")
        iterations = int(iters_s)

        def b64decode_nopad(s: str) -> bytes:
            pad = "=" * (-len(s) % 4)
            return base64.urlsafe_b64decode(s + pad)

        salt = b64decode_nopad(salt_b64)
        dk = b64decode_nopad(dk_b64)
        return iterations, salt, dk
    except Exception as e:
        raise ValueError("hash inválido") from e


def verify_password(password: str, stored_hash: str) -> bool:
    if not password or not stored_hash:
        return False

    try:
        iterations, salt, expected = _parse_hash(stored_hash)
        actual = _pbkdf2_sha256(password, salt, iterations)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False
