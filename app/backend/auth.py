"""
CRM Hira - Authentication & Role-Based Access Control (RBAC)
Implements PBKDF2-HMAC-SHA256 password hashing and signed bearer session tokens.
Completely independent of third-party login providers.
"""

import hashlib
import hmac
import os
import json
import base64
import time
from datetime import datetime
from app.backend.db import get_db_connection

# Generate or retrieve server secret key
SECRET_KEY = os.environ.get("CRM_HIRA_SECRET", "crm-hira-secure-secret-key-salt-9876543210")
TOKEN_EXPIRY_SECONDS = 86400 * 7  # 7 days session

# Role definitions & hierarchy
ROLES = {
    "admin": {
        "title_fa": "مدیر کل سیستم",
        "title_en": "Administrator",
        "permissions": ["all"]
    },
    "doctor": {
        "title_fa": "پزشک / متخصص",
        "title_en": "Doctor / Specialist",
        "permissions": ["view_patients", "edit_medical", "log_treatments", "view_followups"]
    },
    "operator": {
        "title_fa": "اپراتور / پذیرش",
        "title_en": "Operator / Receptionist",
        "permissions": ["view_patients", "create_patient", "log_treatments", "view_followups", "update_followups", "manage_leads"]
    },
    "accountant": {
        "title_fa": "حسابدار / امور مالی",
        "title_en": "Accountant / Finance",
        "permissions": ["view_patients", "manage_payments", "confirm_installments", "financial_reports"]
    }
}


def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Generates PBKDF2-HMAC-SHA256 hash with random hex salt."""
    if not salt:
        salt = os.urandom(16).hex()
    pwd_bytes = password.encode('utf-8')
    salt_bytes = salt.encode('utf-8')
    hashed = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt_bytes, 100000).hex()
    return hashed, salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    """Verifies a password against existing hash and salt."""
    check_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(check_hash, hashed)


def generate_token(user_id: int, username: str, role: str) -> str:
    """Generates a base64 encoded signed HMAC token."""
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS
    }
    payload_str = json.dumps(payload, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload_str.encode('utf-8')).decode('utf-8')
    
    signature = hmac.new(
        SECRET_KEY.encode('utf-8'),
        payload_b64.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return f"{payload_b64}.{signature}"


def verify_token(token: str) -> dict | None:
    """Verifies HMAC signature and expiration of bearer token."""
    try:
        if not token or "." not in token:
            return None
        payload_b64, signature = token.split(".", 1)
        expected_sig = hmac.new(
            SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            return None

        payload_bytes = base64.urlsafe_b64decode(payload_b64.encode('utf-8'))
        payload = json.loads(payload_bytes.decode('utf-8'))

        if payload.get("exp", 0) < time.time():
            return None  # Expired

        # Verify user still active in DB
        conn = get_db_connection()
        row = conn.execute("SELECT id, username, role, is_active FROM users WHERE id = ?", (payload["user_id"],)).fetchone()
        conn.close()

        if not row or not row["is_active"]:
            return None

        return payload
    except Exception:
        return None


def authenticate_user(username: str, password: str) -> dict | None:
    """Checks user credentials and returns user dict with token if valid."""
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username.strip(),)).fetchone()
    conn.close()

    if not row:
        return None

    if not row["is_active"]:
        return {"error": "user_inactive", "message": "این حساب کاربری غیرفعال شده است."}

    if verify_password(password, row["password_hash"], row["salt"]):
        token = generate_token(row["id"], row["username"], row["role"])
        return {
            "id": row["id"],
            "username": row["username"],
            "full_name": row["full_name"],
            "role": row["role"],
            "role_title_fa": ROLES.get(row["role"], {}).get("title_fa", row["role"]),
            "token": token
        }
    return None
