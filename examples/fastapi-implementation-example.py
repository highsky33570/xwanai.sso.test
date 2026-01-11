"""
Complete FastAPI Implementation Example for xwanai.com

This example shows how to:
1. Validate SSO tokens from Shopify
2. Create user sessions
3. Handle authentication
4. Generate tokens for reverse SSO (xwanai.com → Shopify)
"""

# ============================================================================
# 1. Token Validation Utility (utils/shopify_sso.py)
# ============================================================================

import json
import base64
import hmac
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
import os

SHOPIFY_SSO_SECRET = os.getenv("SHOPIFY_SSO_SECRET", "")
TOKEN_EXPIRY_MINUTES = 15


def validate_shopify_sso_token(token: str) -> Optional[Dict]:
    """Validate and decrypt SSO token from Shopify"""
    if not SHOPIFY_SSO_SECRET:
        raise ValueError("SHOPIFY_SSO_SECRET environment variable is required")

    try:
        # Decode base64
        token_data = base64.urlsafe_b64decode(token)

        # Derive keys
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

        # Check expiry
        created_at = datetime.fromisoformat(customer_data["created_at"].replace('Z', '+00:00'))
        now = datetime.utcnow().replace(tzinfo=created_at.tzinfo)
        diff_minutes = (now - created_at).total_seconds() / 60

        if diff_minutes > TOKEN_EXPIRY_MINUTES:
            return None

        return customer_data

    except Exception as e:
        print(f"Token validation error: {e}")
        return None


# ============================================================================
# 2. Callback Route (app/routes/auth/shopify_callback.py)
# ============================================================================

from fastapi import APIRouter, Request, Response, Query, HTTPException
from fastapi.responses import RedirectResponse
from utils.shopify_sso import validate_shopify_sso_token
from utils.auth import create_user_session, create_or_update_user
from utils.database import get_db

router = APIRouter()


@router.get("/auth/shopify-callback")
async def shopify_callback(
    request: Request,
    token: str = Query(..., description="SSO token from Shopify"),
    return_to: str = Query("/", description="Return URL after authentication"),
):
    """Handle SSO callback from Shopify"""
    if not token:
        return RedirectResponse(url=f"/login?error=missing_token")

    customer_data = validate_shopify_sso_token(token)

    if not customer_data:
        return RedirectResponse(url=f"/login?error=invalid_token")

    db = next(get_db())
    
    # Create or update user in database
    user = create_or_update_user(
        db=db,
        email=customer_data["email"],
        first_name=customer_data.get("first_name"),
        last_name=customer_data.get("last_name"),
        shopify_customer_id=customer_data.get("shopify_customer_id"),
    )

    # Create session
    session_token = create_user_session(user.id)

    # Create redirect response with session cookie
    response = RedirectResponse(url=return_to)
    response.set_cookie(
        key="xwanai_session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )

    return response


# ============================================================================
# 3. API Route for Generating Reverse SSO Tokens (app/routes/api/shopify_redirect.py)
# ============================================================================

from fastapi import Depends
from utils.auth import get_current_user
from utils.shopify_redirect import generate_shopify_redirect_token

@router.post("/api/auth/shopify-token")
async def generate_shopify_token(
    current_user = Depends(get_current_user),
):
    """Generate redirect token for Shopify SSO"""
    try:
        shop_domain = os.getenv("SHOPIFY_SHOP_DOMAIN", "your-shop.myshopify.com")
        
        # Generate token
        token = generate_shopify_redirect_token({
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
        })

        # If using Shopify Plus Multipass:
        redirect_url = f"https://{shop_domain}/account/login/multipass/{token}"
        
        # Or if using App Proxy:
        # redirect_url = f"https://{shop_domain}/apps/xwan-ai-sso/login?token={token}"

        return {"redirectUrl": redirect_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# 4. Helper Functions (utils/auth.py, utils/database.py)
# ============================================================================

def create_or_update_user(db, email: str, first_name: str = None, 
                          last_name: str = None, shopify_customer_id: str = None):
    """Create or update user in database"""
    # Example using SQLAlchemy:
    # user = db.query(User).filter(User.email == email).first()
    # if user:
    #     user.first_name = first_name
    #     user.last_name = last_name
    #     user.shopify_customer_id = shopify_customer_id
    #     db.commit()
    #     return user
    # else:
    #     user = User(
    #         email=email,
    #         first_name=first_name,
    #         last_name=last_name,
    #         shopify_customer_id=shopify_customer_id
    #     )
    #     db.add(user)
    #     db.commit()
    #     return user
    pass


def create_user_session(user_id: str) -> str:
    """Create and return session token"""
    import secrets
    session_token = secrets.token_urlsafe(32)
    # Store session in database or Redis
    # Example: redis.setex(f"session:{session_token}", 60*60*24*7, user_id)
    return session_token


def get_current_user(request: Request):
    """Get current authenticated user from session"""
    session_token = request.cookies.get("xwanai_session")
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Retrieve user from session
    # user_id = redis.get(f"session:{session_token}")
    # if not user_id:
    #     raise HTTPException(status_code=401, detail="Invalid session")
    # return get_user_by_id(user_id)
    pass
