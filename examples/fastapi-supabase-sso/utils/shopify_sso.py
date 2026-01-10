"""
Shopify SSO Token Validation Utility
Validates and decrypts SSO tokens from Shopify
"""

import json
import base64
import hmac
import hashlib
from datetime import datetime
from typing import Optional, Dict
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
import os

SHOPIFY_SSO_SECRET = os.getenv("SHOPIFY_SSO_SECRET", "")
TOKEN_EXPIRY_MINUTES = 15


def validate_shopify_sso_token(token: str) -> Optional[Dict]:
    """
    Validate and decrypt SSO token from Shopify
    
    Args:
        token: Base64 URL-safe encoded SSO token
        
    Returns:
        Dictionary with customer data if valid, None otherwise
    """
    if not SHOPIFY_SSO_SECRET:
        raise ValueError("SHOPIFY_SSO_SECRET environment variable is required")

    try:
        # Decode base64
        token_data = base64.urlsafe_b64decode(token)

        # Derive keys from secret
        key_material = hashlib.sha256(SHOPIFY_SSO_SECRET.encode()).digest()
        encryption_key = key_material[:16]
        signature_key = key_material[16:32]

        # Extract signature (last 32 bytes) and encrypted data
        signature = token_data[-32:]
        encrypted_data = token_data[:-32]

        # Verify signature
        expected_signature = hmac.new(
            signature_key, encrypted_data, hashlib.sha256
        ).digest()

        if not hmac.compare_digest(signature, expected_signature):
            return None

        # Extract IV (first 16 bytes) and ciphertext
        iv = encrypted_data[:16]
        ciphertext = encrypted_data[16:]

        # Decrypt
        cipher = Cipher(
            algorithms.AES(encryption_key), modes.CBC(iv), backend=default_backend()
        )
        decryptor = cipher.decryptor()
        plaintext = decryptor.update(ciphertext) + decryptor.final()

        # Remove PKCS7 padding
        unpadder = padding.PKCS7(128).unpadder()
        plaintext = unpadder.update(plaintext) + unpadder.final()

        customer_data = json.loads(plaintext.decode("utf-8"))

        # Check expiry - handle both "createdAt" and "created_at" for compatibility
        created_at_str = customer_data.get("createdAt") or customer_data.get("created_at")
        if not created_at_str:
            return None
            
        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
        now = datetime.utcnow().replace(tzinfo=created_at.tzinfo)
        diff_minutes = (now - created_at).total_seconds() / 60

        if diff_minutes > TOKEN_EXPIRY_MINUTES:
            return None

        return customer_data

    except Exception as e:
        print(f"Token validation error: {e}")
        return None
