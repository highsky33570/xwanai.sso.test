# Complete SSO Implementation Guide: Shopify ↔ XWAN.AI

This guide covers the complete implementation of Single Sign-On (SSO) between Shopify storefront and your XWAN.AI website (Next.js or FastAPI backend).

## Overview

The SSO flow works as follows:

1. **Customer logs in/registers on Shopify** → Customer data is synced via webhooks
2. **Customer clicks "Go to Xwan" button** → Redirects to App Proxy SSO endpoint
3. **App Proxy generates secure token** → Encrypts customer data and creates SSO token
4. **Redirects to www.xwanai.com** → With token in query parameter
5. **Your backend validates token** → Decrypts and verifies customer data
6. **Creates user session** → Logs customer into your website
7. **Redirects to dashboard** → Customer is now authenticated

---

## Part 1: Shopify Setup

### Step 1: Configure App Proxy

1. In Shopify Admin, go to **Settings** > **Apps and sales channels**
2. Click **App and embed settings** (or **App proxies** if available)
3. Find your XWAN AI app and configure the App Proxy:
   - **Subpath prefix**: `xwan-ai-sso`
   - **Subpath**: `/sso`
   - **Proxy URL**: Your app's URL (e.g., `https://your-app.ngrok.io/app-proxy/sso`)

This makes your SSO endpoint accessible at: `https://your-shop.myshopify.com/apps/xwan-ai-sso/sso`

### Step 2: Add Header Button to Theme

#### Option A: Using Theme Customizer (Recommended)

1. Go to **Online Store** > **Themes**
2. Click **Customize** on your active theme
3. Navigate to **Header** section
4. Add a **Custom HTML** or **Custom Liquid** block
5. Paste the code from `examples/xwan-header-button.liquid`

#### Option B: Direct Theme Edit

1. Go to **Online Store** > **Themes** > **Actions** > **Edit code**
2. Create a new snippet: `snippets/xwan-header-button.liquid`
3. Copy the content from `examples/xwan-header-button.liquid`
4. In your `header.liquid` or `theme.liquid`, add:
   ```liquid
   {% render 'xwan-header-button' %}
   ```

#### Option C: Using App Blocks (Advanced)

If you're building a theme app extension, you can create an app block that injects the button.

### Step 3: Test the Button

1. Log in as a customer on your Shopify storefront
2. Verify the "Go to Xwan" button appears in the header
3. Click the button and verify it redirects correctly

---

## Part 2: Backend Implementation

### For Next.js Applications

#### Step 1: Install Dependencies

```bash
npm install crypto
```

#### Step 2: Create SSO Token Validation Utility

Create `lib/shopify-sso.ts`:

```typescript
import crypto from 'crypto';

const SHOPIFY_SSO_SECRET = process.env.SHOPIFY_SSO_SECRET!;
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

#### Step 3: Create SSO Callback Route

Create `app/auth/shopify-callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateShopifySSOToken } from '@/lib/shopify-sso';
import { createUserSession, createOrUpdateUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const returnTo = searchParams.get('return_to') || '/dashboard';

  if (!token) {
    return NextResponse.redirect(
      new URL(`/login?error=missing_token`, request.url)
    );
  }

  const customerData = validateShopifySSOToken(token);

  if (!customerData) {
    return NextResponse.redirect(
      new URL(`/login?error=invalid_token`, request.url)
    );
  }

  // Create or update user in your database
  const user = await createOrUpdateUser({
    email: customerData.email,
    firstName: customerData.firstName,
    lastName: customerData.lastName,
    shopifyCustomerId: customerData.shopifyCustomerId,
  });

  // Create session
  const sessionToken = await createUserSession(user.id);

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  
  response.cookies.set('xwanai_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
```

#### Step 4: Implement User Management

Create `lib/auth.ts`:

```typescript
import { prisma } from '@/lib/prisma'; // or your database client

export async function createOrUpdateUser(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  shopifyCustomerId?: string;
}) {
  return await prisma.user.upsert({
    where: { email: data.email },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      shopifyCustomerId: data.shopifyCustomerId,
    },
    create: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      shopifyCustomerId: data.shopifyCustomerId,
    },
  });
}

export async function createUserSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('base64url');
  
  // Store session in database or Redis
  await prisma.session.create({
    data: {
      token: sessionToken,
      userId: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  
  return sessionToken;
}
```

#### Step 5: Environment Variables

Add to your `.env.local`:

```env
SHOPIFY_SSO_SECRET=your-secret-key-here-must-match-shopify-app
```

**Important**: This must be the same secret used in your Shopify app!

---

### For FastAPI Applications

#### Step 1: Install Dependencies

```bash
pip install cryptography pycryptodome
```

#### Step 2: Create SSO Token Validation Utility

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
        created_at = datetime.fromisoformat(customer_data["createdAt"].replace('Z', '+00:00'))
        now = datetime.utcnow().replace(tzinfo=created_at.tzinfo)
        diff_minutes = (now - created_at).total_seconds() / 60

        if diff_minutes > TOKEN_EXPIRY_MINUTES:
            return None

        return customer_data

    except Exception as e:
        print(f"Token validation error: {e}")
        return None
```

#### Step 3: Create SSO Callback Route

Create `app/routes/auth/shopify_callback.py`:

```python
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import RedirectResponse
from utils.shopify_sso import validate_shopify_sso_token
from utils.auth import create_user_session, create_or_update_user
from utils.database import get_db

router = APIRouter()


@router.get("/auth/shopify-callback")
async def shopify_callback(
    token: str = Query(..., description="SSO token from Shopify"),
    return_to: str = Query("/dashboard", description="Return URL after authentication"),
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
        first_name=customer_data.get("firstName"),
        last_name=customer_data.get("lastName"),
        shopify_customer_id=customer_data.get("shopifyCustomerId"),
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
```

#### Step 4: Implement User Management

Create `utils/auth.py`:

```python
from sqlalchemy.orm import Session
from models import User, Session as SessionModel
import secrets

def create_or_update_user(
    db: Session,
    email: str,
    first_name: str = None,
    last_name: str = None,
    shopify_customer_id: str = None,
):
    """Create or update user in database"""
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.first_name = first_name
        user.last_name = last_name
        user.shopify_customer_id = shopify_customer_id
        db.commit()
        db.refresh(user)
        return user
    else:
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            shopify_customer_id=shopify_customer_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def create_user_session(user_id: str) -> str:
    """Create and return session token"""
    session_token = secrets.token_urlsafe(32)
    # Store session in database
    # Example: db.add(SessionModel(token=session_token, user_id=user_id))
    return session_token
```

#### Step 5: Environment Variables

Add to your `.env`:

```env
SHOPIFY_SSO_SECRET=your-secret-key-here-must-match-shopify-app
```

---

## Part 3: Testing

### Test Flow

1. **Log in as a customer** on your Shopify storefront
2. **Click "Go to Xwan" button** in the header
3. **Verify redirect** to `https://www.xwanai.com/auth/shopify-callback?token=...`
4. **Check authentication** - you should be logged into your website
5. **Verify redirect** to dashboard or return_to URL

### Debugging

- **Check browser console** for JavaScript errors
- **Check network tab** for failed requests
- **Check server logs** for token validation errors
- **Verify SHOPIFY_SSO_SECRET** matches between Shopify app and backend

---

## Part 4: Security Considerations

1. **Token Expiry**: Tokens expire after 15 minutes
2. **HTTPS Only**: Always use HTTPS in production
3. **Secret Key**: Keep `SHOPIFY_SSO_SECRET` secure and never commit to git
4. **Token Validation**: Always validate tokens on the backend
5. **Session Management**: Use secure, httpOnly cookies for sessions

---

## Troubleshooting

### Button doesn't appear
- Check if customer is logged in (`{% if customer %}`)
- Verify snippet is included in header template
- Check browser console for errors

### Redirect fails
- Verify App Proxy is configured correctly
- Check that `/apps/xwan-ai-sso/sso` route is accessible
- Verify customer access token is available (if using POST method)

### Token validation fails
- Ensure `SHOPIFY_SSO_SECRET` matches in both apps
- Check token hasn't expired (15 minutes)
- Verify token format (base64url encoded)

### User not created
- Check database connection
- Verify user creation function is working
- Check for duplicate email constraints

---

## Next Steps

- Implement reverse SSO (www.xwanai.com → Shopify)
- Add user profile sync
- Implement logout functionality
- Add error handling and user feedback

---

## Related Guides

- **`SHOPIFY_SSO_FLOW_GUIDE.md`** - Detailed explanation of how SSO works on Shopify side
- **`SHOPIFY_APP_DEPLOYMENT_GUIDE.md`** - Complete deployment instructions
