# SSO Implementation for Shopify Storefront ↔ www.xwanai.com

This implementation provides bidirectional Single Sign-On (SSO) between your Shopify storefront and www.xwanai.com.

## Quick Start

### 1. Set Environment Variables

Add these to your `.env` file:

```bash
SHOPIFY_SSO_SECRET=<generate-random-32-char-secret>
XWANAI_SSO_SECRET=<generate-random-32-char-secret>
XWANAI_DOMAIN=https://www.xwanai.com
```

Generate secrets:
```bash
openssl rand -base64 32
```

### 2. Configure App Proxy in Shopify Admin

1. Go to **Settings** > **Apps and sales channels** > **App and embed settings**
2. Click **App proxies**
3. Add new proxy:
   - **Subpath prefix**: `xwan-ai-sso`
   - **Proxy prefix**: `apps`
   - **Proxy subpath**: `sso`
   - **Proxy URL**: `https://your-app-url.com/app-proxy/sso`

### 3. Add Button to Shopify Theme

Add this to your Liquid template (see `examples/shopify-liquid-button.liquid`):

```liquid
{% if customer %}
  <a href="/apps/xwan-ai-sso/sso?customer_email={{ customer.email | url_param_escape }}&customer_id={{ customer.id }}&return_to=/dashboard" 
     class="btn">
    Go to XWAN.AI
  </a>
{% endif %}
```

### 4. Implement Token Validation on xwanai.com

See `SSO_IMPLEMENTATION.md` for complete Next.js and FastAPI examples.

## Files Created

- `app/lib/sso.server.ts` - SSO token generation and validation utilities
- `app/routes/app-proxy.sso.tsx` - App Proxy route for SSO redirect
- `app/routes/app-proxy.sso-verify.tsx` - Token verification endpoint
- `SSO_IMPLEMENTATION.md` - Complete implementation guide
- `examples/` - Example implementations for Next.js, FastAPI, and Liquid

## How It Works

### Shopify → xwanai.com Flow

1. Customer clicks "Go to xwanai.com" button on shop
2. Browser requests `/apps/xwan-ai-sso/sso` (App Proxy)
3. App Proxy route generates encrypted SSO token with customer data
4. Customer is redirected to `https://www.xwanai.com/auth/shopify-callback?token=<token>`
5. xwanai.com validates token and creates user session

### xwanai.com → Shopify Flow

1. Customer logs into xwanai.com
2. Customer clicks "Go to Shop" button
3. xwanai.com generates SSO token
4. Customer is redirected to Shopify storefront with token
5. Shopify validates token and logs customer in

## Security Features

- ✅ AES-128-CBC encryption
- ✅ HMAC-SHA256 signatures
- ✅ 15-minute token expiry
- ✅ Secure secrets stored in environment variables
- ✅ HTTPS-only redirects

## Testing

1. **Generate Token**: Test token generation in development
2. **Validate Token**: Test token validation on xwanai.com
3. **Expiry**: Verify expired tokens are rejected
4. **End-to-End**: Test complete flow from shop to xwanai.com

## Troubleshooting

**Token validation fails:**
- Ensure `SHOPIFY_SSO_SECRET` matches on both sides
- Check token hasn't expired (>15 minutes)
- Verify base64 encoding/decoding

**Redirect doesn't work:**
- Verify App Proxy is configured correctly
- Check proxy URL is accessible
- Ensure customer is logged in

**Customer not authenticated:**
- Verify customer is logged in on Shopify storefront
- Check customer access token is valid
- Ensure Storefront API has correct scopes

## Next Steps

1. Set up environment variables
2. Configure App Proxy in Shopify Admin
3. Add button to Shopify theme
4. Implement token validation on xwanai.com
5. Test end-to-end flow
6. Deploy to production

For detailed implementation guides, see `SSO_IMPLEMENTATION.md`.
