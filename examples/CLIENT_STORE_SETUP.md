# Setting Up SSO on Client's Shopify Store

Complete guide for when your client invited you to their Shopify store (not using Partner Dashboard).

---

## Overview

When a client invites you to their store, you don't need Partner Dashboard access. Everything is configured through their store's admin panel.

---

## Step 1: Get App Credentials

### Option A: Client Provides Credentials

Ask your client to provide:
- **API Key** (Client ID)
- **API Secret Key** (Client Secret)
- **Store Domain** (e.g., `client-shop.myshopify.com`)

### Option B: Find in Store Admin

If you have access to the store admin:

1. Go to **Settings** > **Apps and sales channels**
2. Find your app (or ask client to install it)
3. Click **Configure** or **API credentials**
4. Copy the API Key and Secret

---

## Step 2: Install/Configure App in Store

### If App Not Installed

1. Client goes to **Settings** > **Apps and sales channels**
2. Click **Develop apps** (if custom app) or find in App Store
3. Install the app
4. Grant necessary permissions

### If App Already Installed

1. Go to **Settings** > **Apps and sales channels**
2. Find your app
3. Click **Configure**

---

## Step 3: Configure App Proxy

1. In store admin: **Settings** > **Apps and sales channels**
2. Find your app > **Configure**
3. Look for **App proxies** section
4. Click **Add app proxy** or **Configure**

**Configure:**
- **Subpath prefix**: `xwan-ai-sso`
- **Subpath**: `/sso`
- **Proxy URL**: `https://your-app.herokuapp.com/app-proxy/sso`
  - (Your React Router app deployment URL)

**Result URL:**
```
https://client-shop.myshopify.com/apps/xwan-ai-sso/sso
```

---

## Step 4: Set Environment Variables

In your React Router app (this codebase), create `.env`:

```env
# From client's store
SHOPIFY_API_KEY=client-provided-api-key
SHOPIFY_API_SECRET=client-provided-api-secret
SCOPES=read_customers,write_customers,read_orders,read_products

# Your app deployment URL
SHOPIFY_APP_URL=https://your-app.herokuapp.com

# SSO Configuration (generate this yourself)
SHOPIFY_SSO_SECRET=your-random-secret-key-here-min-32-chars
XWANAI_DOMAIN=https://www.xwanai.com

# Backend API (if needed)
XWANAI_API_URL=https://api.xwanai.com
XWANAI_API_KEY=your-api-key
```

**Generate SSO Secret:**
```bash
openssl rand -base64 32
```

**Important**: `SHOPIFY_SSO_SECRET` must match in both:
- Your React Router app (this codebase)
- Your Next.js/FastAPI backend (www.xwanai.com)

---

## Step 5: Verify Permissions (Scopes)

Ensure the app has these permissions:
- `read_customers`
- `write_customers`
- `read_orders`
- `read_products`

If missing, ask client to grant these permissions in app settings.

---

## Step 6: Test App Proxy

1. Visit: `https://client-shop.myshopify.com/apps/xwan-ai-sso/sso`
2. Should redirect to your app's `/app-proxy/sso` route
3. Then redirect to www.xwanai.com with SSO token

---

## Step 7: Add Header Button to Theme

1. Go to **Online Store** > **Themes**
2. Click **Actions** > **Edit code**
3. Create snippet: `snippets/xwan-header-button.liquid`
4. Copy from `examples/xwan-header-button.liquid`
5. Add to header: `{% render 'xwan-header-button' %}`

---

## Troubleshooting

### Can't Find App in Store

- Ask client to install the app
- Check if you have admin access
- Verify app is enabled

### App Proxy Not Working

- Verify Proxy URL is correct
- Check your app is deployed and accessible
- Verify route exists: `app/routes/app-proxy.sso.tsx`

### Permission Denied

- Ask client to grant necessary scopes
- Check API credentials are correct
- Verify app is properly installed

### SSO Token Invalid

- Ensure `SHOPIFY_SSO_SECRET` matches in both apps
- Check token hasn't expired (15 minutes)
- Verify backend is receiving callback

---

## What You DON'T Need

- ❌ Partner Dashboard access
- ❌ To create app in Partner Dashboard
- ❌ App Store listing
- ❌ Partner account (unless you want one)

---

## What You DO Need

- ✅ Access to client's store admin (or credentials)
- ✅ App installed in client's store
- ✅ App Proxy configured
- ✅ Your app deployed and accessible
- ✅ Environment variables set correctly

---

## Quick Checklist

- [ ] Got API credentials from client
- [ ] App installed in client's store
- [ ] App Proxy configured
- [ ] Environment variables set
- [ ] App deployed and accessible
- [ ] Header button added to theme
- [ ] Tested SSO flow end-to-end

---

## Next Steps

1. Deploy your React Router app
2. Configure App Proxy in client's store
3. Add header button to theme
4. Test SSO flow
5. Deploy Next.js backend
6. Test complete flow

---

## Support

If you need help:
1. Check `SHOPIFY_APP_DEPLOYMENT_GUIDE.md` for deployment
2. Check `SHOPIFY_SSO_FLOW_GUIDE.md` for SSO flow details
3. Verify all environment variables are set
4. Check app logs for errors
