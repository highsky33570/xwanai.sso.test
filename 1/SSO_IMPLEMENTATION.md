# SSO Implementation Guide for Shopify Storefront ↔ www.xwanai.com

This guide explains how to implement bidirectional Single Sign-On (SSO) between your Shopify storefront and www.xwanai.com.

## Architecture Overview

The SSO system uses secure, encrypted tokens similar to Shopify Multipass:

1. **Shopify → xwanai.com**: When a customer clicks "Go to xwanai.com" on your shop, a secure token is generated and the customer is redirected to xwanai.com with the token.

2. **xwanai.com → Shopify**: When a customer logs into xwanai.com and wants to shop, they can be redirected to Shopify with authentication.

## Prerequisites

1. Shopify store (Shopify Plus recommended for Multipass support)
2. Shopify app installed and configured
3. App Proxy configured in Shopify Admin
4. Environment variables set up

## Setup Instructions

### 1. Environment Variables

Add these environment variables to your Shopify app:

```bash
# Secret for encrypting tokens from Shopify to xwanai.com
SHOPIFY_SSO_SECRET=your-random-secret-key-here

# Secret for encrypting tokens from xwanai.com to Shopify
XWANAI_SSO_SECRET=your-random-secret-key-here

# Your xwanai.com domain
XWANAI_DOMAIN=https://www.xwanai.com
```

**Generate secure secrets:**
```bash
# Generate random 32-character secrets
openssl rand -base64 32
```

### 2. Configure App Proxy in Shopify Admin

1. Go to **Settings** > **Apps and sales channels** > **App and embed settings**
2. Click **App proxies**
3. Add a new app proxy:
   - **Subpath prefix**: `xwan-ai-sso`
   - **Proxy prefix**: `apps`
   - **Proxy subpath**: `sso`
   - **Proxy URL**: Your app's public URL (e.g., `https://your-app.com/app-proxy/sso`)

This makes the SSO endpoint accessible at: `https://your-shop.myshopify.com/apps/xwan-ai-sso/sso`

### 3. Update Shopify App Scopes

The app needs `read_customers` scope (already added in `shopify.app.toml`). Update your app installation to include this scope.

## Implementation: Shopify Storefront

### Add "Go to xwanai.com" Button

In your Shopify theme (or using an app block), add a button that redirects to the SSO endpoint:

**Liquid template example:**
```liquid
{% if customer %}
  <a href="/apps/xwan-ai-sso/sso?customer_email={{ customer.email }}&customer_id={{ customer.id }}&first_name={{ customer.first_name }}&last_name={{ customer.last_name }}" 
     class="btn btn-primary">
    Go to XWAN.AI
  </a>
{% else %}
  <a href="/account/login?checkout_url=/apps/xwan-ai-sso/sso" class="btn btn-primary">
    Login to Access XWAN.AI
  </a>
{% endif %}
```

**Better approach using Storefront API (recommended):**

Create a JavaScript snippet that gets customer info from the Storefront API:

```javascript
// Get customer access token from Shopify customer account
async function redirectToXwanAI() {
  // If customer is logged in via Customer Account API
  const customerAccessToken = getCookie('customerAccessToken'); // Get from your auth system
  
  if (!customerAccessToken) {
    window.location.href = '/account/login?checkout_url=/apps/xwan-ai-sso/sso';
    return;
  }

  // Fetch customer data from Storefront API
  const response = await fetch('/apps/xwan-ai-sso/sso', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Customer-Access-Token': customerAccessToken
    }
  });

  if (response.ok) {
    const data = await response.json();
    window.location.href = data.redirectUrl;
  }
}
```

**Note**: For production, you should update the App Proxy route to accept customer access tokens from the Storefront API session instead of query parameters.

## Implementation: Next.js (xwanai.com)

### 1. Install Dependencies

```bash
npm install crypto-js
```

### 2. Create Token Validation Utility

Create `lib/shopify-sso.ts`:

```typescript
import crypto from 'crypto';

const SHOPIFY_SSO_SECRET = process.env.SHOPIFY_SSO_SECRET || '';
const TOKEN_EXPIRY_MINUTES = 15;

export interface CustomerSSOData {
  email: string;
  firstName?: string;
  lastName?: string;
  shopifyCustomerId?: string;
  createdAt: string;
  returnTo?: string;
}

export function validateShopifySSOToken(token: string): CustomerSSOData | null {
  if (!SHOPIFY_SSO_SECRET) {
    throw new Error('SHOPIFY_SSO_SECRET environment variable is required');
  }

  try {
    const tokenData = Buffer.from(token, 'base64url');
    const keyMaterial = crypto.createHash('sha256').update(SHOPIFY_SSO_SECRET).digest();
    const encryptionKey = keyMaterial.slice(0, 16);
    const signatureKey = keyMaterial.slice(16, 32);

    const signature = tokenData.slice(-32);
    const encryptedData = tokenData.slice(0, -32);

    const expectedSignature = crypto
      .createHmac('sha256', signatureKey)
      .update(encryptedData)
      .digest();

    if (!crypto.timingSafeEqual(signature, expectedSignature)) {
      return null;
    }

    const iv = encryptedData.slice(0, 16);
    const ciphertext = encryptedData.slice(16);

    const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
    let plaintext = decipher.update(ciphertext, undefined, 'utf8');
    plaintext += decipher.final('utf8');

    const customerData: CustomerSSOData = JSON.parse(plaintext);

    const createdAt = new Date(customerData.createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    if (diffMinutes > TOKEN_EXPIRY_MINUTES) {
      return null;
    }

    return customerData;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}
```

### 3. Create Callback Route

Create `app/auth/shopify-callback/route.ts` (Next.js App Router):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateShopifySSOToken } from '@/lib/shopify-sso';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const returnTo = searchParams.get('return_to') || '/dashboard';

  if (!token) {
    return NextResponse.redirect(
      new URL(`/login?error=missing_token`, request.url)
    );
  }

  // Validate token
  const customerData = validateShopifySSOToken(token);

  if (!customerData) {
    return NextResponse.redirect(
      new URL(`/login?error=invalid_token`, request.url)
    );
  }

  // Create session or JWT token for xwanai.com
  // Example: Store in session/database and set cookie
  const sessionToken = await createXwanAISession(customerData);

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  
  // Set authentication cookie
  response.cookies.set('xwanai_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}

async function createXwanAISession(customerData: CustomerSSOData) {
  // Implement your session creation logic
  // This could be:
  // 1. Create user if doesn't exist (matching by email)
  // 2. Generate JWT token
  // 3. Store session in database
  
  // Example: Return a session ID
  return `session_${Date.now()}_${customerData.email}`;
}
```

### 4. Add Redirect Button to Shopify

Create a component that redirects logged-in users to Shopify:

```typescript
// components/ShopRedirectButton.tsx
'use client';

import { useRouter } from 'next/navigation';

export default function ShopRedirectButton() {
  const router = useRouter();

  const redirectToShop = async () => {
    // Get current user session
    const response = await fetch('/api/auth/shopify-token', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const { redirectUrl } = await response.json();
      window.location.href = redirectUrl;
    }
  };

  return (
    <button onClick={redirectToShop} className="btn btn-primary">
      Go to Shop
    </button>
  );
}
```

## Implementation: FastAPI (xwanai.com)

### 1. Create Token Validation Utility

Create `utils/shopify_sso.py`:

```python
import json
import base64
import hmac
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
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
        padding_length = plaintext[-1]
        plaintext = plaintext[:-padding_length]

        customer_data = json.loads(plaintext.decode("utf-8"))

        # Check expiry
        created_at = datetime.fromisoformat(customer_data["created_at"])
        now = datetime.utcnow()
        diff_minutes = (now - created_at).total_seconds() / 60

        if diff_minutes > TOKEN_EXPIRY_MINUTES:
            return None

        return customer_data

    except Exception as e:
        print(f"Token validation error: {e}")
        return None
```

### 2. Create Callback Endpoint

Create `app/routes/auth/shopify_callback.py`:

```python
from fastapi import APIRouter, Request, Response, Query
from fastapi.responses import RedirectResponse
from utils.shopify_sso import validate_shopify_sso_token
from utils.auth import create_session

router = APIRouter()


@router.get("/auth/shopify-callback")
async def shopify_callback(
    request: Request,
    token: str = Query(...),
    return_to: str = Query("/dashboard"),
):
    """Handle SSO callback from Shopify"""
    if not token:
        return RedirectResponse(url=f"/login?error=missing_token")

    customer_data = validate_shopify_sso_token(token)

    if not customer_data:
        return RedirectResponse(url=f"/login?error=invalid_token")

    # Create session for xwanai.com
    session_token = await create_session(
        email=customer_data["email"],
        first_name=customer_data.get("first_name"),
        last_name=customer_data.get("last_name"),
        shopify_customer_id=customer_data.get("shopify_customer_id"),
    )

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
```

## Reverse SSO: xwanai.com → Shopify

For redirecting from xwanai.com to Shopify with authentication, you have two options:

### Option 1: Shopify Plus Multipass (Recommended)

If you have Shopify Plus, use Multipass:

```typescript
// In your Next.js/FastAPI app
import { generateMultipassToken } from '@/lib/multipass'; // Implement Multipass token generation

export async function redirectToShop(customerEmail: string, shopDomain: string) {
  const multipassSecret = process.env.SHOPIFY_MULTIPASS_SECRET;
  const token = generateMultipassToken({
    email: customerEmail,
    created_at: new Date().toISOString(),
  }, multipassSecret);

  return `https://${shopDomain}/account/login/multipass/${token}`;
}
```

### Option 2: Custom App Proxy

Create a similar token system in reverse and set up an App Proxy endpoint that validates tokens from xwanai.com.

## Security Best Practices

1. **Use HTTPS**: Always use HTTPS for all SSO redirects
2. **Token Expiry**: Tokens expire after 15 minutes
4. **Secure Secrets**: Store secrets in environment variables, never commit to git
5. **Validate on Both Sides**: Always validate tokens on both Shopify and xwanai.com
6. **Rate Limiting**: Implement rate limiting on SSO endpoints
7. **Logging**: Log all SSO attempts for security monitoring

## Testing

1. **Test Token Generation**: Verify tokens are generated correctly
2. **Test Token Validation**: Ensure tokens validate correctly on xwanai.com
3. **Test Expiry**: Verify expired tokens are rejected
4. **Test Invalid Tokens**: Ensure tampered tokens are rejected
5. **Test End-to-End**: Test complete flow from shop → xwanai.com

## Troubleshooting

- **Token validation fails**: Check that `SHOPIFY_SSO_SECRET` matches on both sides
- **Redirect loop**: Verify redirect URLs are correct
- **Customer not authenticated**: Ensure customer is logged in on Shopify storefront
- **CORS errors**: Check App Proxy configuration in Shopify Admin

## Next Steps

1. Update App Proxy route to handle Storefront API customer sessions properly
2. Implement session synchronization
3. Add error handling and logging
4. Set up monitoring and alerts
5. Test in production environment
