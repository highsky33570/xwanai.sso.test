# Quick Start: SSO Implementation

## Overview

When a customer logs in or registers on Shopify, they can click a "Go to Xwan" button in the header to seamlessly authenticate on your website.

## Two Scenarios

- **Scenario 1**: You're a Shopify Partner creating your own app → Use Partner Dashboard
- **Scenario 2**: Client invited you to their store → Use store admin (see `CLIENT_STORE_SETUP.md`)

## Implementation Steps

### 1. Shopify Side (5 minutes)

#### Add Header Button
1. Copy `examples/xwan-header-button.liquid`
2. In Shopify Admin: **Online Store** > **Themes** > **Actions** > **Edit code**
3. Create new snippet: `snippets/xwan-header-button.liquid`
4. Paste the code
5. In `header.liquid` or `theme.liquid`, add:
   ```liquid
   {% render 'xwan-header-button' %}
   ```

#### Configure App Proxy
1. **Settings** > **Apps and sales channels** > **App and embed settings**
2. Configure App Proxy:
   - Subpath prefix: `xwan-ai-sso`
   - Subpath: `/sso`
   - Proxy URL: Your app's SSO endpoint

### 2. Backend Side (10 minutes)

#### Next.js
1. Copy code from `examples/nextjs-complete-sso-implementation.ts`
2. Create files:
   - `lib/shopify-sso.ts` (token validation)
   - `app/auth/shopify-callback/route.ts` (callback handler)
   - `lib/auth.ts` (user management)
3. Set environment variable:
   ```env
   SHOPIFY_SSO_SECRET=your-secret-key
   ```

#### FastAPI
1. Copy code from `examples/fastapi-implementation-example.py`
2. Create files:
   - `utils/shopify_sso.py` (token validation)
   - `app/routes/auth/shopify_callback.py` (callback handler)
   - `utils/auth.py` (user management)
3. Set environment variable:
   ```env
   SHOPIFY_SSO_SECRET=your-secret-key
   ```

### 3. Test (2 minutes)

1. Log in as a customer on Shopify
2. Click "Go to Xwan" button
3. Verify redirect to your website
4. Verify you're logged in

## Important Notes

- **Secret Key**: `SHOPIFY_SSO_SECRET` must match in both Shopify app and your backend
- **Token Expiry**: Tokens expire after 15 minutes
- **HTTPS**: Always use HTTPS in production
- **Customer Data**: Webhooks automatically sync customer data when they register/login

## Full Documentation

- **`SHOPIFY_SSO_FLOW_GUIDE.md`** - How SSO works on Shopify side
- **`SSO_COMPLETE_IMPLEMENTATION_GUIDE.md`** - Complete implementation guide
- **`SHOPIFY_APP_DEPLOYMENT_GUIDE.md`** - Deployment instructions

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Button doesn't appear | Check if customer is logged in |
| Redirect fails | Verify App Proxy configuration |
| Token validation fails | Check `SHOPIFY_SSO_SECRET` matches |
| User not created | Check database connection |
