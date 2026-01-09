# Customer Login Check and Token Exchange Guide

This guide explains how to check if a customer is logged in on Shopify and authenticate them on xwanai.com with token exchange.

## Overview

The complete flow:
1. **Check Login Status** - Verify if customer is logged in on Shopify storefront
2. **Generate SSO Token** - If logged in, generate Shopify SSO token
3. **Redirect to xwanai.com** - Redirect customer with SSO token
4. **Exchange Token** - xwanai.com validates token and returns xwanai.com token
5. **Customer Authenticated** - Customer can use xwanai.com platform

## 1. Check Customer Login Status

### Endpoint: `/apps/xwan-ai-sso/check-login`

This App Proxy endpoint checks if a customer is logged in on Shopify and generates SSO token.

**Request:**
```
GET /apps/xwan-ai-sso/check-login?customer_access_token={token}&return_to=/dashboard
```

**Headers:**
```
X-Customer-Access-Token: {customer_access_token}  # Optional, alternative to query param
Cookie: customerAccessToken={token}  # Fallback if no header/param
```

**Response (Logged In):**
```json
{
  "isLoggedIn": true,
  "token": "shopify_sso_token_here",
  "redirectUrl": "https://www.xwanai.com/auth/shopify-callback?token=...&return_to=/dashboard",
  "customer": {
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "id": "123456789"
  }
}
```

**Response (Not Logged In):**
```json
{
  "isLoggedIn": false,
  "loginUrl": "https://shop.myshopify.com/account/login?checkout_url=..."
}
```

## 2. Usage in Shopify Storefront

### Option 1: JavaScript/TypeScript Client

```typescript
async function checkLoginAndRedirect() {
  // Get customer access token from Shopify customer account
  const customerAccessToken = getCustomerAccessToken(); // Implement this based on your auth

  if (!customerAccessToken) {
    // Customer not logged in, redirect to login
    window.location.href = '/account/login?checkout_url=/apps/xwan-ai-sso/check-login';
    return;
  }

  // Check login status
  const response = await fetch(
    `/apps/xwan-ai-sso/check-login?customer_access_token=${customerAccessToken}&return_to=/dashboard`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  const data = await response.json();

  if (data.isLoggedIn) {
    // Redirect to xwanai.com with SSO token
    window.location.href = data.redirectUrl;
  } else {
    // Redirect to login
    window.location.href = data.loginUrl;
  }
}

// Helper function to get customer access token
function getCustomerAccessToken(): string | null {
  // Method 1: From cookie (if using Customer Account API)
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'customerAccessToken') {
      return decodeURIComponent(value);
    }
  }

  // Method 2: From localStorage (if stored there)
  return localStorage.getItem('customerAccessToken');

  // Method 3: From Storefront API session
  // This depends on your implementation
}
```

### Option 2: Liquid Template Button

```liquid
{% if customer %}
  <button onclick="redirectToXwanAI()" class="btn btn-primary">
    Go to XWAN.AI
  </button>

  <script>
    async function redirectToXwanAI() {
      // Get customer data from Liquid
      const customerEmail = '{{ customer.email | escape }}';
      const customerId = '{{ customer.id }}';
      const firstName = '{{ customer.first_name | escape }}';
      const lastName = '{{ customer.last_name | escape }}';

      // Direct redirect with customer data (simpler approach)
      window.location.href = `/apps/xwan-ai-sso/sso?customer_email=${encodeURIComponent(customerEmail)}&customer_id=${customerId}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&return_to=/dashboard`;
    }
  </script>
{% else %}
  <a href="/account/login?checkout_url=/apps/xwan-ai-sso/check-login" class="btn btn-primary">
    Login to Access XWAN.AI
  </a>
{% endif %}
```

## 3. Token Exchange on xwanai.com

### Endpoint: `POST /api/auth/shopify-token-exchange`

This endpoint receives the Shopify SSO token and returns an xwanai.com token.

**Request:**
```json
{
  "token": "shopify_sso_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "token": "xwanai_jwt_token_here",
  "user": {
    "id": "user_id_123",
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### Implementation

See `examples/xwanai-token-exchange.md` for complete Next.js and FastAPI implementations.

## 4. Complete Flow Example

### Step 1: Customer Clicks "Go to xwanai.com"

```typescript
// On Shopify storefront
async function goToXwanAI() {
  // Check if customer is logged in
  const customerAccessToken = getCustomerAccessToken();

  if (!customerAccessToken) {
    // Redirect to login
    window.location.href = '/account/login?checkout_url=/apps/xwan-ai-sso/check-login';
    return;
  }

  // Check login status and get SSO token
  const response = await fetch(
    `/apps/xwan-ai-sso/check-login?customer_access_token=${customerAccessToken}&return_to=/dashboard`
  );

  const data = await response.json();

  if (data.isLoggedIn) {
    // Redirect to xwanai.com with SSO token
    window.location.href = data.redirectUrl;
  }
}
```

### Step 2: xwanai.com Receives Token

```typescript
// On xwanai.com callback page (app/auth/shopify-callback/page.tsx)
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function ShopifyCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const token = searchParams.get('token');
    const returnTo = searchParams.get('return_to') || '/dashboard';

    if (!token) {
      setStatus('error');
      router.push('/login?error=missing_token');
      return;
    }

    // Exchange token
    exchangeToken(token, returnTo);
  }, [searchParams, router]);

  async function exchangeToken(shopifyToken: string, returnTo: string) {
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

        // Set cookie (if not already set by API)
        document.cookie = `xwanai_token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

        setStatus('success');
        
        // Redirect to dashboard
        router.push(returnTo);
      } else {
        setStatus('error');
        router.push(`/login?error=${encodeURIComponent(data.error)}`);
      }
    } catch (error) {
      console.error('Token exchange error:', error);
      setStatus('error');
      router.push('/login?error=token_exchange_failed');
    }
  }

  if (status === 'loading') {
    return <div>Authenticating...</div>;
  }

  if (status === 'error') {
    return <div>Authentication failed. Redirecting to login...</div>;
  }

  return <div>Success! Redirecting...</div>;
}
```

## 5. Environment Variables

### Shopify App

```bash
SHOPIFY_SSO_SECRET=your_secure_secret_here
XWANAI_DOMAIN=https://www.xwanai.com
```

### xwanai.com

```bash
SHOPIFY_SSO_SECRET=your_secure_secret_here  # Same as Shopify app
JWT_SECRET=your_jwt_secret_here
```

## 6. Security Considerations

1. **HTTPS Only**: All endpoints must use HTTPS in production
2. **Token Expiry**: Shopify SSO tokens expire after 15 minutes
3. **JWT Expiry**: xwanai.com tokens should expire (recommended: 7 days)
4. **Secure Storage**: Store tokens securely (httpOnly cookies, secure localStorage)
5. **Token Validation**: Always validate tokens on both sides
6. **Rate Limiting**: Implement rate limiting on token exchange endpoint

## 7. Testing

### Test Customer Login Check

```bash
# With customer access token
curl -X GET "https://your-shop.myshopify.com/apps/xwan-ai-sso/check-login?customer_access_token=YOUR_TOKEN&return_to=/dashboard"

# Without token (should return loginUrl)
curl -X GET "https://your-shop.myshopify.com/apps/xwan-ai-sso/check-login"
```

### Test Token Exchange

```bash
curl -X POST "https://www.xwanai.com/api/auth/shopify-token-exchange" \
  -H "Content-Type: application/json" \
  -d '{"token": "shopify_sso_token_here"}'
```

## 8. Troubleshooting

### Customer Not Logged In

- **Issue**: `isLoggedIn: false` even though customer is logged in
- **Solution**: 
  - Verify customer access token is correct
  - Check token is being passed correctly (query param, header, or cookie)
  - Verify Storefront API is accessible

### Invalid Token

- **Issue**: Token validation fails on xwanai.com
- **Solution**:
  - Verify `SHOPIFY_SSO_SECRET` matches on both sides
  - Check token hasn't expired (>15 minutes)
  - Verify token format is correct

### Token Exchange Fails

- **Issue**: Token exchange returns error
- **Solution**:
  - Check token is valid
  - Verify customer exists in database
  - Check API endpoint is accessible
  - Review error logs

## Summary

✅ **Check Login**: Use `/apps/xwan-ai-sso/check-login` to verify customer login status
✅ **Get SSO Token**: If logged in, endpoint returns SSO token
✅ **Redirect**: Customer redirected to xwanai.com with token
✅ **Exchange Token**: xwanai.com validates token and returns JWT
✅ **Authenticate**: Customer logged in on xwanai.com platform

For complete implementation examples, see:
- `examples/xwanai-token-exchange.md` - Token exchange implementation
- `SSO_IMPLEMENTATION.md` - Complete SSO guide
- `app/routes/app-proxy.check-login.tsx` - Login check endpoint
