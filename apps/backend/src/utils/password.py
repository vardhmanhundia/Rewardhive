"""Password hashing and verification utilities"""
import bcrypt

# bcrypt only uses the first 72 bytes of a password and raises if given more,
# so cap the input to that limit before hashing or verifying.
BCRYPT_MAX_BYTES = 72


def _prepare(password: str) -> bytes:
    return password.encode("utf-8")[:BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(_prepare(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash."""
    return bcrypt.checkpw(_prepare(plain_password), hashed_password.encode("utf-8"))
