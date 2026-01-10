"""
Authentication utilities for user and session management
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional
from supabase import Client
from utils.database import get_supabase


def create_or_update_user(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    shopify_customer_id: Optional[str] = None,
) -> dict:
    """
    Create or update user in Supabase
    
    Args:
        email: User email
        first_name: First name
        last_name: Last name
        shopify_customer_id: Shopify customer ID
        
    Returns:
        User dictionary with id, email, etc.
    """
    supabase = get_supabase()
    
    # Check if user exists
    existing_user = supabase.table("users").select("*").eq("email", email).execute()
    
    user_data = {
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "shopify_customer_id": shopify_customer_id,
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    if existing_user.data and len(existing_user.data) > 0:
        # Update existing user
        user = existing_user.data[0]
        result = (
            supabase.table("users")
            .update(user_data)
            .eq("id", user["id"])
            .execute()
        )
        return result.data[0] if result.data else user
    else:
        # Create new user
        user_data["created_at"] = datetime.utcnow().isoformat()
        result = supabase.table("users").insert(user_data).execute()
        return result.data[0] if result.data else None


def create_user_session(user_id: str) -> str:
    """
    Create a new session for user
    
    Args:
        user_id: User ID from database
        
    Returns:
        Session token
    """
    supabase = get_supabase()
    
    # Generate session token
    session_token = secrets.token_urlsafe(32)
    
    # Calculate expiry (7 days from now)
    expires_at = (datetime.utcnow() + timedelta(days=7)).isoformat()
    
    # Store session in database
    session_data = {
        "token": session_token,
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": datetime.utcnow().isoformat(),
    }
    
    supabase.table("sessions").insert(session_data).execute()
    
    return session_token


def get_user_from_session(session_token: str) -> Optional[dict]:
    """
    Get user from session token
    
    Args:
        session_token: Session token from cookie
        
    Returns:
        User dictionary if valid session, None otherwise
    """
    if not session_token:
        return None
    
    supabase = get_supabase()
    
    try:
        # Get session
        session_result = (
            supabase.table("sessions")
            .select("*, users(*)")
            .eq("token", session_token)
            .gt("expires_at", datetime.utcnow().isoformat())
            .execute()
        )
        
        if not session_result.data or len(session_result.data) == 0:
            return None
        
        session = session_result.data[0]
        
        # Get user data
        if isinstance(session.get("users"), dict):
            return session["users"]
        elif isinstance(session.get("users"), list) and len(session["users"]) > 0:
            return session["users"][0]
        
        # Fallback: get user directly
        user_result = (
            supabase.table("users")
            .select("*")
            .eq("id", session["user_id"])
            .execute()
        )
        
        return user_result.data[0] if user_result.data else None
        
    except Exception as e:
        print(f"Error getting user from session: {e}")
        return None


def delete_session(session_token: str) -> bool:
    """
    Delete a session
    
    Args:
        session_token: Session token to delete
        
    Returns:
        True if deleted, False otherwise
    """
    supabase = get_supabase()
    
    try:
        supabase.table("sessions").delete().eq("token", session_token).execute()
        return True
    except Exception as e:
        print(f"Error deleting session: {e}")
        return False
