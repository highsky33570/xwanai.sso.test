"""
SSO Callback Route - Handles authentication from Shopify
"""

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import RedirectResponse
from utils.shopify_sso import validate_shopify_sso_token
from utils.auth import create_user_session, create_or_update_user

router = APIRouter()


@router.get("/auth/shopify-callback")
async def shopify_callback(
    token: str = Query(..., description="SSO token from Shopify"),
    return_to: str = Query("/", description="Return URL after authentication"),
):
    """
    Handle SSO callback from Shopify
    
    Flow:
    1. Validate SSO token
    2. Extract customer data
    3. Create or update user in database
    4. Create session
    5. Set session cookie and redirect
    """
    if not token:
        return RedirectResponse(url=f"/login?error=missing_token")

    # Validate token
    customer_data = validate_shopify_sso_token(token)

    if not customer_data:
        return RedirectResponse(url=f"/login?error=invalid_token")

    try:
        # Create or update user in database
        # Handle both camelCase and snake_case field names
        user = create_or_update_user(
            email=customer_data["email"],
            first_name=customer_data.get("firstName") or customer_data.get("first_name"),
            last_name=customer_data.get("lastName") or customer_data.get("last_name"),
            shopify_customer_id=customer_data.get("shopifyCustomerId") or customer_data.get("shopify_customer_id"),
        )

        if not user or not user.get("id"):
            return RedirectResponse(url=f"/login?error=user_creation_failed")

        # Create session
        session_token = create_user_session(user["id"])

        # Create redirect response with session cookie
        response = RedirectResponse(url=return_to)
        response.set_cookie(
            key="xwanai_session",
            value=session_token,
            httponly=True,
            secure=True,  # Set to True in production (requires HTTPS)
            samesite="lax",
            max_age=60 * 60 * 24 * 7,  # 7 days
            path="/",
        )

        return response
        
    except Exception as e:
        print(f"Error in shopify_callback: {e}")
        return RedirectResponse(url=f"/login?error=authentication_failed")
