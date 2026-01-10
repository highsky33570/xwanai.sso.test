"""
Authentication Middleware - Protect routes that require authentication
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import RedirectResponse
from utils.auth import get_user_from_session


async def get_current_user(request: Request):
    """
    Dependency to get current authenticated user
    
    Usage:
        @app.get("/protected")
        async def protected_route(current_user = Depends(get_current_user)):
            return {"user": current_user}
    """
    session_token = request.cookies.get("xwanai_session")
    
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = get_user_from_session(session_token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )
    
    return user


def require_auth(request: Request) -> dict:
    """
    Helper function to require authentication (for use in routes)
    
    Returns:
        User dictionary
        
    Raises:
        HTTPException if not authenticated
    """
    session_token = request.cookies.get("xwanai_session")
    
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    
    user = get_user_from_session(session_token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )
    
    return user
