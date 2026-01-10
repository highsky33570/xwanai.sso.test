# Shopify App Configuration & Deployment Guide

Complete guide for configuring and deploying your Shopify app with SSO functionality.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Shopify App Configuration](#shopify-app-configuration)
3. [Environment Variables Setup](#environment-variables-setup)
4. [App Proxy Configuration](#app-proxy-configuration)
5. [Webhook Configuration](#webhook-configuration)
6. [Deployment Steps](#deployment-steps)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

**Choose your scenario:**

### Scenario 1: Partner Dashboard
- Shopify Partner account
- Shopify app created in Partner Dashboard
- Access to Partner Dashboard

### Scenario 2: Client Store ⭐
- Client invited you to their Shopify store
- Access to client's store admin (or app credentials from client)
- App installed in client's store

### Both Scenarios Need:
- Your Next.js website deployed at www.xwanai.com
- Your Shopify app deployed (React Router/Remix)
- Supabase project (if using FastAPI backend)
- Domain name for your app (or ngrok for development)

## Important: Two Separate Deployments

You have **two separate applications** to deploy:

1. **Shopify App** (React Router/Remix) - **This codebase** (`xwan-ai-app`)
   - What it does: Handles App Proxy routes, webhooks, SSO token generation
   - Deploy to: Heroku, Railway, Render, Fly.io, etc.
   - Example URL: `https://xwan-ai-app.herokuapp.com`
   - **This is the "Shopify App URL" you'll configure in Partner Dashboard**

2. **Next.js Website** (www.xwanai.com) - Your customer-facing website
   - What it does: Your main website, handles SSO callback, user authentication
   - Deploy to: Vercel, Netlify, etc.
   - URL: `https://www.xwanai.com`
   - **This is separate from the Shopify app**

**Visual Flow:**
```
Shopify Store → App Proxy → Shopify App (React Router) → Generates Token → Redirects to → Next.js Website (www.xwanai.com)
```

---

## Shopify App Configuration

### What is "Your Shopify App URL"?

**Your Shopify App** is the React Router/Remix application in this codebase (`xwan-ai-app`). This app:
- Handles App Proxy routes (like `/app-proxy/sso`)
- Receives webhooks from Shopify
- Generates SSO tokens
- Needs to be deployed to a hosting service

**Your Shopify App URL** is where you deploy this React Router app. Examples:
- `https://xwan-ai-app.herokuapp.com`
- `https://xwan-ai-app.railway.app`
- `https://xwan-ai-app.render.com`
- Or your custom domain: `https://app.xwanai.com`

**This is NOT:**
- ❌ Your Next.js website (www.xwanai.com) - that's separate
- ❌ Your Shopify store URL (your-shop.myshopify.com) - that's the merchant's store

---

## Two Scenarios: Partner Dashboard vs Client Store

### Scenario 1: You're Creating Your Own App (Partner Dashboard)

If you're a Shopify Partner creating your own app, use the [Partner Dashboard](https://partners.shopify.com/).

### Scenario 2: Client Invited You to Their Store (Store Admin) ⭐

If your client invited you to their Shopify store, you'll configure everything through **their store's admin**, not the Partner Dashboard.

**This guide covers both scenarios below.**

---

## Scenario 1: Using Partner Dashboard

### Step 1: Create App in Partner Dashboard

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Click **Apps** > **Create app**
3. Choose **Create app manually**
4. Fill in:
   - **App name**: XWAN AI
   - **App URL**: The URL where you'll deploy your React Router app
     - Example: `https://xwan-ai-app.herokuapp.com`
     - Or: `https://app.xwanai.com` (if using custom domain)
   - **Allowed redirection URL(s)**: 
     - `https://xwan-ai-app.herokuapp.com/auth/callback`
     - `https://xwan-ai-app.herokuapp.com/auth/shopify/callback`
     - (Use your actual deployment URL)

### Step 2: Configure App Settings

1. In your app settings, go to **App setup**
2. Configure the following:

#### Client Credentials
- **Client ID**: Copy this (you'll need it for `SHOPIFY_API_KEY`)
- **Client secret**: Copy this (you'll need it for `SHOPIFY_API_SECRET`)

#### API Scopes
Enable the following scopes:
- `read_customers`
- `write_customers`
- `read_orders`
- `read_products`

#### App URLs
- **App URL**: `https://xwan-ai-app.herokuapp.com` (Replace with your actual deployment URL)
- **Allowed redirection URL(s)**:
  ```
  https://xwan-ai-app.herokuapp.com/auth/callback
  https://xwan-ai-app.herokuapp.com/auth/shopify/callback
  ```
  (Replace with your actual deployment URL)

---

## Scenario 2: Client Invited You (Store Admin) ⭐

If your client invited you to their store, follow these steps:

### Step 1: Get App Credentials from Client

Ask your client (store owner) to provide:
- **API Key** (Client ID)
- **API Secret** (Client Secret)
- **Store Domain** (e.g., `client-shop.myshopify.com`)

**OR** if the app is already installed, you can find these in:
1. Go to the client's Shopify Admin
2. **Settings** > **Apps and sales channels**
3. Find your app and click **Configure** or **API credentials**

### Step 2: Configure App Proxy in Store Admin

1. Go to the client's Shopify Admin
2. **Settings** > **Apps and sales channels**
3. Find your app (or install it if not already installed)
4. Click **Configure** or **App settings**
5. Look for **App proxies** section
6. Click **Add app proxy** or **Configure**

Configure:
- **Subpath prefix**: `xwan-ai-sso`
- **Subpath**: `/sso`
- **Proxy URL**: `https://xwan-ai-app.herokuapp.com/app-proxy/sso`
  - (Replace with your actual deployment URL)

### Step 3: Set Environment Variables

In your React Router app (this codebase), set these environment variables:

```env
# Get these from the client's store admin
SHOPIFY_API_KEY=client-provided-api-key
SHOPIFY_API_SECRET=client-provided-api-secret
SCOPES=read_customers,write_customers,read_orders,read_products

# Your app deployment URL
SHOPIFY_APP_URL=https://xwan-ai-app.herokuapp.com

# SSO Configuration
SHOPIFY_SSO_SECRET=your-random-secret-key-here-min-32-chars
XWANAI_DOMAIN=https://www.xwanai.com
```

### Step 4: Verify App Installation

1. The app should be installed in the client's store
2. If not, ask the client to install it from the App Store or provide installation link
3. Verify you have the necessary permissions (scopes)

**Important Notes for Client Store Scenario:**
- You don't need Partner Dashboard access
- All configuration is done in the client's store admin
- The client controls app installation and permissions
- You may need to ask the client to enable certain features

---

## Environment Variables Setup

### For Shopify App (React Router/Remix)

Create `.env` file in your Shopify app root:

```env
# Shopify App Credentials
SHOPIFY_API_KEY=your-client-id
SHOPIFY_API_SECRET=your-client-secret
SCOPES=read_customers,write_customers,read_orders,read_products

# App URL (Your Shopify app URL)
SHOPIFY_APP_URL=https://your-shopify-app.herokuapp.com

# SSO Configuration
SHOPIFY_SSO_SECRET=your-random-secret-key-here-min-32-chars
XWANAI_DOMAIN=https://www.xwanai.com

# Backend API
XWANAI_API_URL=https://api.xwanai.com
XWANAI_API_KEY=your-api-key
```

**Important**: Generate a secure random string for `SHOPIFY_SSO_SECRET`:
```bash
# Generate secret (32+ characters recommended)
openssl rand -base64 32
```

### For FastAPI Backend

Create `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Shopify SSO Secret (MUST MATCH Shopify app)
SHOPIFY_SSO_SECRET=your-random-secret-key-here-min-32-chars

# Application Settings
ENVIRONMENT=production
ALLOWED_ORIGINS=https://www.xwanai.com
```

### For Next.js Backend

Create `.env.local` file:

```env
# Database (if using Supabase)
DATABASE_URL=your-database-url
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Shopify SSO Secret (MUST MATCH Shopify app)
SHOPIFY_SSO_SECRET=your-random-secret-key-here-min-32-chars

# Application
NEXT_PUBLIC_APP_URL=https://www.xwanai.com
```

**Critical**: `SHOPIFY_SSO_SECRET` must be **exactly the same** in both Shopify app and your backend!

---

## App Proxy Configuration

### For Partner Dashboard Scenario

1. In Partner Dashboard, go to your app
2. **App setup** > **App proxies**
3. Click **Add app proxy** or **Configure**

### For Client Store Scenario ⭐

1. Go to the **client's Shopify Admin**
2. **Settings** > **Apps and sales channels**
3. Find your app and click **Configure**
4. Look for **App proxies** section
5. Click **Add app proxy** or **Configure**

### Set App Proxy Details (Both Scenarios)

Configure as follows:

- **Subpath prefix**: `xwan-ai-sso`
- **Subpath**: `/sso`
- **Proxy URL**: `https://xwan-ai-app.herokuapp.com/app-proxy/sso`
   - Replace `xwan-ai-app.herokuapp.com` with your actual Shopify app deployment URL
   - This points to your React Router app (this codebase), not your Next.js website

**Result**: Your SSO endpoint will be accessible at:
```
https://client-shop.myshopify.com/apps/xwan-ai-sso/sso
```
(Replace `client-shop` with the actual store domain)

**Important**: The Proxy URL points to your **Shopify app** (React Router), which then redirects to your **Next.js website** (www.xwanai.com).

### Step 3: Verify App Proxy Route

In your Shopify app code, ensure you have the route:

**File**: `app/routes/app-proxy.sso.tsx`

```typescript
// This route should already exist
// It handles SSO token generation and redirect
```

---

## Webhook Configuration

### Step 1: Register Webhooks

Your app should automatically register webhooks. Verify in your code:

**File**: `app/routes/webhooks.customers.create.tsx`
**File**: `app/routes/webhooks.customers.update.tsx`
**File**: `app/routes/webhooks.customers.delete.tsx`

### Step 2: Verify Webhook Endpoints

Webhooks should be accessible at your **Shopify app** URL:
- `https://your-shopify-app.herokuapp.com/webhooks/customers/create`
- `https://your-shopify-app.herokuapp.com/webhooks/customers/update`
- `https://your-shopify-app.herokuapp.com/webhooks/customers/delete`

### Step 3: Test Webhooks

1. Create a test customer in Shopify
2. Check your app logs for webhook events
3. Verify customer sync to your backend

---

## Deployment Steps

### Option 1: Deploy Shopify App (React Router/Remix)

Your Shopify app is built with React Router. Deploy it to any Node.js hosting:

#### Using Shopify CLI (Recommended)

```bash
# Build and deploy
npm run deploy

# Or use Shopify CLI
shopify app deploy
```

#### Manual Deployment

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Deploy to hosting** (Heroku, Railway, Render, etc.):
   - Set all environment variables
   - Point to your built app
   - Ensure Node.js runtime

3. **Update Shopify App URL**:
   - Go to Partner Dashboard > Your App
   - Update **App URL** to your deployed URL
   - Update **Allowed redirection URLs**

### Option 2: Deploy Next.js Backend (www.xwanai.com)

Your Next.js website should be deployed separately from the Shopify app.

#### Deploy to Vercel (Recommended for Next.js)

1. **Connect Repository**:
   - Go to [Vercel](https://vercel.com/)
   - Import your Next.js repository
   - Configure build settings

2. **Add Environment Variables**:
   ```env
   SHOPIFY_SSO_SECRET=your-secret-key-must-match-shopify-app
   DATABASE_URL=your-database-url
   # ... other variables
   ```

3. **Deploy**:
   - Vercel automatically deploys on git push
   - Your site will be at: `https://www.xwanai.com`

#### Deploy to Other Platforms

- **Netlify**: Similar to Vercel
- **Railway**: Supports Next.js
- **Render**: Full-stack hosting
- **AWS/GCP/Azure**: Enterprise options

### Option 3: Deploy FastAPI Backend (Alternative to Next.js)

If using FastAPI instead of Next.js for your backend:

#### Using Railway/Render

1. **Connect Repository**:
   - Go to Railway or Render
   - Import your FastAPI repository

2. **Set Environment Variables**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-key
   SHOPIFY_SSO_SECRET=your-secret-key-must-match
   ```

3. **Configure Build**:
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

#### Using Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t xwanai-sso-api .
docker run -p 8000:8000 --env-file .env xwanai-sso-api
```

---

## Testing

### Step 1: Test App Installation

1. Go to your development store
2. Install your app
3. Verify app loads correctly

### Step 2: Test SSO Flow

1. **Login as customer** on Shopify storefront
2. **Click "Go to Xwan" button** in header
3. **Verify redirect** to your website
4. **Check authentication** - should be logged in
5. **Verify redirect** to dashboard

### Step 3: Test Webhooks

1. **Create test customer** in Shopify
2. **Check logs** for webhook event
3. **Verify customer** created in your database

### Step 4: Test App Proxy

Visit directly:
```
https://your-shop.myshopify.com/apps/xwan-ai-sso/sso
```

Should redirect to your website with SSO token.

---

## Troubleshooting

### App Installation Fails

**Problem**: App won't install
**Solutions**:
- Check App URL is correct and accessible
- Verify API credentials are correct
- Check browser console for errors
- Verify OAuth callback URL matches

### SSO Redirect Not Working

**Problem**: Button click doesn't redirect
**Solutions**:
- Verify App Proxy is configured correctly
- Check App Proxy URL is accessible
- Verify customer is logged in
- Check browser console for JavaScript errors
- Verify `SHOPIFY_SSO_SECRET` matches in both apps

### Token Validation Fails

**Problem**: "Invalid token" error
**Solutions**:
- Ensure `SHOPIFY_SSO_SECRET` is **exactly the same** in both apps
- Check token hasn't expired (15 minutes)
- Verify token format (base64url)
- Check server logs for validation errors

### Webhooks Not Firing

**Problem**: Webhooks not received
**Solutions**:
- Verify webhook endpoints are accessible
- Check webhook registration in Partner Dashboard
- Verify webhook authentication
- Check server logs for webhook events
- Test webhook endpoint manually

### Database Connection Issues

**Problem**: Can't connect to Supabase
**Solutions**:
- Verify `SUPABASE_URL` is correct
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify database schema is created
- Check Supabase project is active
- Verify network/firewall allows connections

### CORS Errors

**Problem**: CORS errors in browser
**Solutions**:
- Add your domain to `ALLOWED_ORIGINS`
- Verify CORS middleware is configured
- Check preflight requests are handled
- Verify credentials are included in requests

---

## Security Checklist

- [ ] `SHOPIFY_SSO_SECRET` is strong (32+ characters)
- [ ] `SHOPIFY_SSO_SECRET` matches in both apps
- [ ] Environment variables are not committed to git
- [ ] HTTPS is enabled in production
- [ ] Session cookies are httpOnly and secure
- [ ] CORS is properly configured
- [ ] Database credentials are secure
- [ ] Webhook authentication is verified
- [ ] Rate limiting is implemented
- [ ] Error messages don't leak sensitive info

---

## Next Steps

1. ✅ Configure App Proxy
2. ✅ Set environment variables
3. ✅ Deploy application
4. ✅ Test SSO flow
5. ✅ Add header button to theme
6. ✅ Monitor logs and errors
7. ✅ Set up error tracking (Sentry, etc.)
8. ✅ Configure monitoring (Uptime Robot, etc.)

---

## Support

For issues:
1. Check logs: `heroku logs --tail` (Heroku) or your platform's logs
2. Check browser console for frontend errors
3. Verify all environment variables are set
4. Test endpoints manually with curl/Postman
5. Review this guide's troubleshooting section

---

## Quick Reference

### Important URLs Explained

- **Shopify App URL**: `https://xwan-ai-app.herokuapp.com`
  - This is where you deploy **this React Router codebase**
  - Used for: App Proxy, webhooks, SSO token generation
  - Configure this in Partner Dashboard > App setup
  
- **Next.js Website**: `https://www.xwanai.com`
  - This is your **separate Next.js website**
  - Used for: Customer-facing site, SSO callback handler
  - Deploy separately to Vercel/Netlify
  
- **App Proxy URL**: `https://your-shop.myshopify.com/apps/xwan-ai-sso/sso`
  - This is accessible on the merchant's Shopify store
  - Points to: Your Shopify App's `/app-proxy/sso` route
  
- **SSO Callback**: `https://www.xwanai.com/auth/shopify-callback`
  - This is on your Next.js website
  - Receives the SSO token and logs the customer in
  
- **Partner Dashboard**: https://partners.shopify.com/
  - Where you configure your app settings

### Environment Variables Checklist

**Shopify App**:
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_SSO_SECRET` ⚠️ Must match backend
- `XWANAI_DOMAIN`

**Backend**:
- `SHOPIFY_SSO_SECRET` ⚠️ Must match Shopify app
- `SUPABASE_URL` (FastAPI)
- `SUPABASE_SERVICE_ROLE_KEY` (FastAPI)
- `DATABASE_URL` (Next.js)

---

**Last Updated**: 2024
