# xwanai.com Token Exchange Implementation

This document explains how to implement the token exchange endpoint on xwanai.com to authenticate customers from Shopify and return xwanai.com tokens.

## Flow Overview

```
1. Customer clicks "Go to xwanai.com" on Shopify store
2. Shopify App checks customer login status
3. If logged in, generates SSO token
4. Customer redirected to: https://www.xwanai.com/auth/shopify-callback?token={sso_token}
5. xwanai.com validates SSO token
6. xwanai.com creates/updates customer
7. xwanai.com generates xwanai.com token
8. Customer logged in on xwanai.com
```

## Implementation: xwanai.com

### 1. Token Validation Utility

You need to validate the Shopify SSO token (same as before). This should already be implemented.

### 2. Token Exchange Endpoint

Create an endpoint that:
1. Receives Shopify SSO token
2. Validates token
3. Creates/updates customer in your database
4. Generates xwanai.com JWT/session token
5. Returns token to client

## Next.js Implementation

### 1. Token Exchange Route (`app/api/auth/shopify-token-exchange/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateShopifySSOToken } from '@/lib/shopify-sso';
import { createUserSession, generateXwanAIToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate Shopify SSO token
    const customerData = validateShopifySSOToken(token);

    if (!customerData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Create or update customer in your database
    const user = await prisma.user.upsert({
      where: {
        email: customerData.email,
      },
      update: {
        email: customerData.email,
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        shopify_customer_id: customerData.shopifyCustomerId,
        updated_at: new Date(),
      },
      create: {
        email: customerData.email,
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        shopify_customer_id: customerData.shopifyCustomerId,
        email_verified: customerData.verified_email || false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Generate xwanai.com authentication token (JWT)
    const xwanaiToken = await generateXwanAIToken({
      userId: user.id,
      email: user.email,
      shopifyCustomerId: customerData.shopifyCustomerId,
    });

    // Create session
    await createUserSession(user.id, xwanaiToken);

    // Return token
    return NextResponse.json({
      success: true,
      token: xwanaiToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { success: false, error: 'Token exchange failed' },
      { status: 500 }
    );
  }
}
```

### 2. Callback Route (`app/auth/shopify-callback/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateShopifySSOToken } from '@/lib/shopify-sso';
import { createUserSession, generateXwanAIToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const returnTo = searchParams.get('return_to') || '/dashboard';

  if (!token) {
    return NextResponse.redirect(
      new URL(`/login?error=missing_token`, request.url)
    );
  }

  try {
    // Validate Shopify SSO token
    const customerData = validateShopifySSOToken(token);

    if (!customerData) {
      return NextResponse.redirect(
        new URL(`/login?error=invalid_token`, request.url)
      );
    }

    // Create or update customer
    const user = await prisma.user.upsert({
      where: {
        email: customerData.email,
      },
      update: {
        email: customerData.email,
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        shopify_customer_id: customerData.shopifyCustomerId,
        updated_at: new Date(),
      },
      create: {
        email: customerData.email,
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        shopify_customer_id: customerData.shopifyCustomerId,
        email_verified: true, // Trusted from Shopify
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Generate xwanai.com token
    const xwanaiToken = await generateXwanAIToken({
      userId: user.id,
      email: user.email,
      shopifyCustomerId: customerData.shopifyCustomerId,
    });

    // Create session
    await createUserSession(user.id, xwanaiToken);

    // Redirect with token in cookie
    const response = NextResponse.redirect(new URL(returnTo, request.url));
    
    // Set authentication cookie
    response.cookies.set('xwanai_token', xwanaiToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Also set in localStorage via client-side script
    // This is handled by the redirect page

    return response;
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(
      new URL(`/login?error=authentication_failed`, request.url)
    );
  }
}
```

### 3. Token Generation Utility (`lib/auth.ts`)

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = '7d'; // 7 days

export interface TokenPayload {
  userId: string;
  email: string;
  shopifyCustomerId?: string;
}

export async function generateXwanAIToken(payload: TokenPayload): Promise<string> {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

export async function verifyXwanAIToken(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function createUserSession(userId: string, token: string): Promise<void> {
  // Store session in database or Redis
  // Example with Prisma:
  // await prisma.session.create({
  //   data: {
  //     user_id: userId,
  //     token,
  //     expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  //   },
  // });
}
```

## FastAPI Implementation

### 1. Token Exchange Endpoint (`app/routes/api/auth.py`)

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from utils.shopify_sso import validate_shopify_sso_token
from utils.auth import generate_xwanai_token, create_user_session
from utils.database import get_db
from datetime import datetime

router = APIRouter()

class TokenExchangeRequest(BaseModel):
    token: str

class TokenExchangeResponse(BaseModel):
    success: bool
    token: str
    user: dict

@router.post("/api/auth/shopify-token-exchange", response_model=TokenExchangeResponse)
async def exchange_token(
    request: TokenExchangeRequest,
    db = Depends(get_db),
):
    try:
        # Validate Shopify SSO token
        customer_data = validate_shopify_sso_token(request.token)

        if not customer_data:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        # Create or update customer
        user = db.query(User).filter(User.email == customer_data["email"]).first()

        if user:
            # Update existing user
            user.first_name = customer_data.get("first_name")
            user.last_name = customer_data.get("last_name")
            user.shopify_customer_id = customer_data.get("shopify_customer_id")
            user.updated_at = datetime.utcnow()
        else:
            # Create new user
            user = User(
                email=customer_data["email"],
                first_name=customer_data.get("first_name"),
                last_name=customer_data.get("last_name"),
                shopify_customer_id=customer_data.get("shopify_customer_id"),
                email_verified=True,  # Trusted from Shopify
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(user)

        db.commit()
        db.refresh(user)

        # Generate xwanai.com token
        xwanai_token = generate_xwanai_token({
            "user_id": str(user.id),
            "email": user.email,
            "shopify_customer_id": user.shopify_customer_id,
        })

        # Create session
        create_user_session(str(user.id), xwanai_token)

        return TokenExchangeResponse(
            success=True,
            token=xwanai_token,
            user={
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Token exchange error: {e}")
        raise HTTPException(status_code=500, detail="Token exchange failed")
```

### 2. Callback Route (`app/routes/auth/shopify_callback.py`)

```python
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import RedirectResponse
from utils.shopify_sso import validate_shopify_sso_token
from utils.auth import generate_xwanai_token, create_user_session
from utils.database import get_db
from datetime import datetime

router = APIRouter()

@router.get("/auth/shopify-callback")
async def shopify_callback(
    token: str = Query(..., description="SSO token from Shopify"),
    return_to: str = Query("/dashboard", description="Return URL after authentication"),
    db = Depends(get_db),
):
    try:
        # Validate Shopify SSO token
        customer_data = validate_shopify_sso_token(token)

        if not customer_data:
            return RedirectResponse(url=f"/login?error=invalid_token")

        # Create or update customer
        user = db.query(User).filter(User.email == customer_data["email"]).first()

        if user:
            user.first_name = customer_data.get("first_name")
            user.last_name = customer_data.get("last_name")
            user.shopify_customer_id = customer_data.get("shopify_customer_id")
            user.updated_at = datetime.utcnow()
        else:
            user = User(
                email=customer_data["email"],
                first_name=customer_data.get("first_name"),
                last_name=customer_data.get("last_name"),
                shopify_customer_id=customer_data.get("shopify_customer_id"),
                email_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(user)

        db.commit()
        db.refresh(user)

        # Generate xwanai.com token
        xwanai_token = generate_xwanai_token({
            "user_id": str(user.id),
            "email": user.email,
            "shopify_customer_id": user.shopify_customer_id,
        })

        # Create session
        create_user_session(str(user.id), xwanai_token)

        # Redirect with token cookie
        response = RedirectResponse(url=return_to)
        response.set_cookie(
            key="xwanai_token",
            value=xwanai_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,  # 7 days
        )

        return response
    except Exception as e:
        print(f"Callback error: {e}")
        return RedirectResponse(url=f"/login?error=authentication_failed")
```

### 3. Token Generation Utility (`utils/auth.py`)

```python
import jwt
import os
from datetime import datetime, timedelta
from typing import Dict, Optional

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_EXPIRY_DAYS = 7

def generate_xwanai_token(payload: Dict) -> str:
    """Generate JWT token for xwanai.com authentication"""
    payload["exp"] = datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS)
    payload["iat"] = datetime.utcnow()
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_xwanai_token(token: str) -> Optional[Dict]:
    """Verify and decode JWT token"""
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return decoded
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def create_user_session(user_id: str, token: str) -> None:
    """Create user session in database"""
    # Store session in database or Redis
    # Example with SQLAlchemy:
    # session = Session(
    #     user_id=user_id,
    #     token=token,
    #     expires_at=datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
    # )
    # db.add(session)
    # db.commit()
    pass
```

## Usage from Frontend

### JavaScript/TypeScript Client

```typescript
// Check if customer is logged in on Shopify
async function checkShopifyLoginAndRedirect() {
  try {
    // Get customer access token from Shopify (if available)
    const customerAccessToken = getCustomerAccessToken(); // Implement this

    if (!customerAccessToken) {
      // Customer not logged in, redirect to login
      window.location.href = '/account/login?checkout_url=/apps/xwan-ai-sso/check-login';
      return;
    }

    // Check login status via App Proxy
    const response = await fetch(
      `/apps/xwan-ai-sso/check-login?customer_access_token=${customerAccessToken}&return_to=/dashboard`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    const data = await response.json();

    if (data.isLoggedIn) {
      // Redirect to xwanai.com with token
      window.location.href = data.redirectUrl;
    } else {
      // Redirect to login
      window.location.href = data.loginUrl;
    }
  } catch (error) {
    console.error('Error checking login:', error);
  }
}

// On xwanai.com callback page, exchange token
async function exchangeToken(shopifyToken: string) {
  try {
    const response = await fetch('/api/auth/shopify-token-exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: shopifyToken }),
    });

    const data = await response.json();

    if (data.success) {
      // Store token in localStorage
      localStorage.setItem('xwanai_token', data.token);
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      console.error('Token exchange failed:', data.error);
    }
  } catch (error) {
    console.error('Token exchange error:', error);
  }
}
```

## Summary

1. **Check Login Status**: Use `/apps/xwan-ai-sso/check-login` to check if customer is logged in
2. **Get SSO Token**: If logged in, endpoint returns SSO token and redirect URL
3. **Redirect to xwanai.com**: Customer is redirected to xwanai.com with token
4. **Exchange Token**: xwanai.com validates token and returns xwanai.com JWT token
5. **Set Cookie/Session**: Token is stored in cookie and localStorage
6. **Customer Authenticated**: Customer can now use xwanai.com platform
