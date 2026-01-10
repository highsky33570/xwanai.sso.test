# How SSO Works on Shopify Side

Complete guide explaining the SSO flow from Shopify storefront to your website.

---

## Overview

When a customer logs in or registers on Shopify, they can seamlessly authenticate on your website (www.xwanai.com) without entering credentials again. This is achieved through a secure token-based SSO system.

---

## Complete SSO Flow

### Step-by-Step Process

```
1. Customer logs in/registers on Shopify
   ↓
2. Customer data synced via webhooks (automatic)
   ↓
3. Customer clicks "Go to Xwan" button in header
   ↓
4. Button redirects to App Proxy: /apps/xwan-ai-sso/sso
   ↓
5. Shopify App Proxy route generates encrypted SSO token
   ↓
6. Redirects to: https://www.xwanai.com/auth/shopify-callback?token=...
   ↓
7. Your backend validates token and creates user session
   ↓
8. Customer is logged into www.xwanai.com
   ↓
9. Redirects to dashboard
```

---

## Part 1: Customer Login/Registration on Shopify

### What Happens Automatically

When a customer logs in or registers on Shopify:

1. **Shopify creates/updates customer record**
2. **Webhook fires** → `customers/create` or `customers/update`
3. **Your app receives webhook** → `app/routes/webhooks.customers.create.tsx`
4. **Customer data synced** → Sent to your backend API
5. **Customer is now in your database**

**No action required** - this happens automatically via webhooks.

---

## Part 2: "Go to Xwan" Button in Header

### How It Works

The button is a Liquid snippet that:

1. **Checks if customer is logged in**:
   ```liquid
   {% if customer %}
     <!-- Show button -->
   {% endif %}
   ```

2. **When clicked, redirects to App Proxy**:
   ```
   /apps/xwan-ai-sso/sso?return_to=/dashboard
   ```

3. **App Proxy route** (`app/routes/app-proxy.sso.tsx`) handles the request:
   - Gets customer data (from query params or customer access token)
   - Generates encrypted SSO token
   - Redirects to www.xwanai.com with token

### Button Implementation

**File**: `examples/xwan-header-button.liquid`

The button:
- Only shows when `customer` is logged in
- Uses JavaScript to handle click (with fallback)
- Tries to use customer access token (more secure)
- Falls back to query params if token unavailable

---

## Part 3: App Proxy Route (SSO Token Generation)

### Location

**File**: `app/routes/app-proxy.sso.tsx`

### What It Does

1. **Receives request** from button click
2. **Extracts customer data**:
   - From query params (if available)
   - Or from customer access token cookie
   - Or from Storefront API (if token provided)

3. **Generates SSO token**:
   ```typescript
   const token = generateShopifyToXwanAIToken({
     email: customer.email,
     firstName: customer.firstName,
     lastName: customer.lastName,
     shopifyCustomerId: customer.id,
     returnTo: '/dashboard'
   });
   ```

4. **Token is encrypted** using:
   - AES-128-CBC encryption
   - HMAC-SHA256 signature
   - Base64 URL-safe encoding
   - 15-minute expiry

5. **Redirects to your website**:
   ```
   https://www.xwanai.com/auth/shopify-callback?token=ENCRYPTED_TOKEN&return_to=/dashboard
   ```

### Token Security

- **Encrypted**: Customer data is encrypted
- **Signed**: HMAC signature prevents tampering
- **Time-limited**: Expires after 15 minutes
- **One-time use**: Token is validated once

---

## Part 4: Your Backend (www.xwanai.com)

### SSO Callback Handler

**Next.js**: `app/auth/shopify-callback/route.ts`
**FastAPI**: `app/routes/auth/shopify_callback.py`

### What Happens

1. **Receives token** from query parameter
2. **Validates token**:
   - Decrypts token
   - Verifies signature
   - Checks expiry (15 minutes)
   - Extracts customer data

3. **Creates/updates user** in database:
   - Email
   - First name
   - Last name
   - Shopify customer ID

4. **Creates session**:
   - Generates session token
   - Stores in database
   - Sets httpOnly cookie

5. **Redirects customer**:
   - To `return_to` URL (default: `/dashboard`)
   - Customer is now authenticated

---

## Part 5: Customer Experience

### From Customer's Perspective

1. **Customer logs into Shopify** → Normal login process
2. **Sees "Go to Xwan" button** → In header (only when logged in)
3. **Clicks button** → Button shows "Redirecting..."
4. **Automatically redirected** → To www.xwanai.com
5. **Logged in automatically** → No password needed
6. **Lands on dashboard** → Ready to use

**Total time**: ~2-3 seconds
**User action**: Just one click

---

## Technical Details

### App Proxy Configuration

**In Shopify Admin**:
- **Subpath prefix**: `xwan-ai-sso`
- **Subpath**: `/sso`
- **Proxy URL**: `https://your-shopify-app.herokuapp.com/app-proxy/sso`

**Result URL**:
```
https://your-shop.myshopify.com/apps/xwan-ai-sso/sso
```

### Token Format

```
Base64URL(
  IV (16 bytes) +
  EncryptedData (variable) +
  HMAC Signature (32 bytes)
)
```

### Token Contents

```json
{
  "email": "customer@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "shopifyCustomerId": "123456789",
  "createdAt": "2024-01-01T12:00:00Z",
  "returnTo": "/dashboard"
}
```

---

## Security Features

1. **Encryption**: AES-128-CBC encryption
2. **Signature**: HMAC-SHA256 prevents tampering
3. **Expiry**: 15-minute token lifetime
4. **HTTPS**: All communication over HTTPS
5. **HttpOnly Cookies**: Session cookies are httpOnly
6. **Secret Key**: Shared secret between apps

---

## Error Handling

### If Customer Not Logged In

- Button doesn't appear (Liquid `{% if customer %}`)
- Or shows "Login to Access Xwan" link

### If Token Invalid

- Redirects to `/login?error=invalid_token`
- Customer can try again

### If Token Expired

- Token expires after 15 minutes
- Customer needs to click button again

### If App Proxy Fails

- Falls back to query params method
- Still works, but less secure

---

## Testing the Flow

### Step 1: Test Customer Login

1. Go to Shopify storefront
2. Create account or login
3. Verify customer is logged in

### Step 2: Test Button

1. Check header for "Go to Xwan" button
2. Button should be visible
3. Click button

### Step 3: Verify Redirect

1. Should redirect to App Proxy
2. Then redirect to www.xwanai.com
3. Check URL has `?token=...` parameter

### Step 4: Verify Authentication

1. Should be logged into www.xwanai.com
2. Should redirect to dashboard
3. Check session cookie is set

---

## Troubleshooting

### Button Doesn't Appear

**Check**:
- Customer is logged in (`{% if customer %}`)
- Snippet is included in header
- No JavaScript errors in console

### Redirect Fails

**Check**:
- App Proxy is configured correctly
- App Proxy URL is accessible
- Route exists: `app/routes/app-proxy.sso.tsx`

### Token Validation Fails

**Check**:
- `SHOPIFY_SSO_SECRET` matches in both apps
- Token hasn't expired (15 minutes)
- Token format is correct

### Customer Not Created

**Check**:
- Backend is receiving callback
- Database connection works
- User creation function works

---

## Configuration Checklist

- [ ] App Proxy configured in Shopify Admin
- [ ] App Proxy route exists: `app/routes/app-proxy.sso.tsx`
- [ ] Header button added to theme
- [ ] `SHOPIFY_SSO_SECRET` set in Shopify app
- [ ] `SHOPIFY_SSO_SECRET` set in backend (must match!)
- [ ] Webhooks configured for customer sync
- [ ] Backend callback route: `/auth/shopify-callback`
- [ ] HTTPS enabled in production

---

## Next Steps

1. ✅ Understand the flow
2. ✅ Configure App Proxy
3. ✅ Add header button
4. ✅ Test end-to-end
5. ✅ Deploy to production
6. ✅ Monitor for errors

---

## Summary

**Shopify Side**:
1. Customer logs in → Webhook syncs data
2. Customer clicks button → Redirects to App Proxy
3. App Proxy generates token → Encrypts customer data
4. Redirects to www.xwanai.com → With token

**Your Website**:
1. Receives token → Validates and decrypts
2. Creates user session → Logs customer in
3. Redirects to dashboard → Customer authenticated

**Result**: Seamless single sign-on experience!
