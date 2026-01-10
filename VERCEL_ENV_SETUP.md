# Vercel Environment Variables Setup Guide (Website Only)

## ✅ Correct Approach: Never Commit `.env` Files

**DO NOT commit `.env` files** - They contain secrets that will be exposed publicly on GitHub.

Instead:
1. ✅ Keep `.env` local only (already in `.gitignore`)
2. ✅ Use `env.template.txt` as a template (safe to commit - no secrets)
3. ✅ Set real values in **Vercel Website Dashboard** (no CLI needed!)

**This guide uses only the Vercel website** - everything is done through the web interface! 🌐

---

## Step-by-Step: Setting Environment Variables in Vercel

### Step 1: Create `.env` File Locally (For Development Only)

```bash
# Copy the template file
cp env.template.txt .env

# Edit .env with your actual values
# (This file stays on your computer, never gets committed to git)
```

### Step 2: Set Environment Variables in Vercel Website Dashboard

**All configuration is done through the Vercel website** - no CLI needed!

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Login or sign up (use GitHub, GitLab, or Bitbucket)

2. **Import Your Project**
   - If new project: Click **"Add New..."** > **"Project"**
   - Click **"Import Git Repository"**
   - Select your GitHub repository: `highsky33570/xwanai.sso.test`
   - Click **"Import"**

3. **Configure Project Settings** (First time only)
   - **Framework Preset**: Select **"Other"** or **"React Router"**
   - **Root Directory**: `./` (project root)
   - **Build Command**: `npm run build` (already set automatically)
   - **Output Directory**: `build/client` (already set automatically)
   - **Install Command**: `npm install` (already set automatically)
   - Click **"Deploy"** (or skip and add env vars first)

4. **Navigate to Environment Variables**
   - After project is created, click on your project name
   - Click **"Settings"** tab (top navigation)
   - Click **"Environment Variables"** in the left sidebar

5. **Add Each Environment Variable**

   Click **"Add New"** button for each variable. For each one:

   **Variable 1: `SHOPIFY_API_KEY`**
   - **Key**: `SHOPIFY_API_KEY`
   - **Value**: `your-shopify-api-key-here` (paste your actual key)
   - **Environments**: ✅ Check **Production** and **Preview**
   - Click **"Save"**

   **Variable 2: `SHOPIFY_API_SECRET`**
   - **Key**: `SHOPIFY_API_SECRET`
   - **Value**: `your-shopify-api-secret-here` (paste your actual secret)
   - **Environments**: ✅ Check **Production** and **Preview**
   - Click **"Save"**

   **Variable 3: `SCOPES`**
   - **Key**: `SCOPES`
   - **Value**: `read_customers,write_customers,read_orders,read_products`
   - **Environments**: ✅ Check **Production** and **Preview**
   - Click **"Save"**

   **Variable 4: `SHOPIFY_APP_URL`**
   - **Key**: `SHOPIFY_APP_URL`
   - **Value**: `https://your-app-name.vercel.app` (or leave empty - Vercel sets it automatically)
   - **Environments**: ✅ Check **Production** and **Preview**
   - Click **"Save"**

   **Variable 5: `SHOPIFY_SSO_SECRET`**
   - **Key**: `SHOPIFY_SSO_SECRET`
   - **Value**: Generate with `openssl rand -base64 32` (copy the output)
   - **Environments**: ✅ Check **Production** and **Preview**
   - ⚠️ **Important**: Use the same secret in your Next.js/FastAPI backend!
   - Click **"Save"**

   **Variable 6: `XWANAI_DOMAIN`**
   - **Key**: `XWANAI_DOMAIN`
   - **Value**: `https://www.xwanai.com`
   - **Environments**: ✅ Check **Production** and **Preview**
   - Click **"Save"**

   **Optional Variables** (if needed):
   - `XWANAI_API_URL`: `https://api.xwanai.com`
   - `XWANAI_API_KEY`: `your-api-key`
   - `DATABASE_URL`: `your-database-url` (if using database)

6. **Verify All Variables Are Added**
   - Scroll down to see the list of all environment variables
   - Make sure all required variables are listed
   - Check that each has ✅ **Production** and ✅ **Preview** selected

7. **Redeploy to Apply Variables**
   - Go to **"Deployments"** tab
   - Find the latest deployment
   - Click the **"⋯"** (three dots) menu
   - Click **"Redeploy"**
   - Or simply push new code to trigger a new deployment

### Step 3: Verify Variables Are Set (Using Vercel Website)

After deployment, verify through the Vercel website:

1. **Check Deployment Logs**
   - Go to **"Deployments"** tab in Vercel dashboard
   - Click on the latest deployment
   - Click **"View Build Logs"** or **"Runtime Logs"**
   - Check for any errors about missing environment variables

2. **Test Your App**
   - Click **"Visit"** button on your deployment
   - Your app should load without errors
   - If errors occur, check the logs for missing variables

3. **Verify Variables Are Available** (Optional - remove after testing)
   
   You can temporarily add a debug route to verify variables are loaded:

   Create file: `app/routes/debug.env.tsx`
   ```typescript
   // ⚠️ REMOVE THIS FILE AFTER TESTING!
   export const loader = async () => {
     return Response.json({
       hasApiKey: !!process.env.SHOPIFY_API_KEY,
       hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
       hasSsoSecret: !!process.env.SHOPIFY_SSO_SECRET,
       hasXwanaiDomain: !!process.env.XWANAI_DOMAIN,
       appUrl: process.env.SHOPIFY_APP_URL || "not set",
       // ⚠️ NEVER expose actual secret values!
     });
   };
   ```
   
   Then visit: `https://your-app.vercel.app/debug/env`
   
   **Remember to delete this file after verifying!**

---

## Quick Reference: All Required Variables

### Required for Shopify App

```env
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SCOPES=read_customers,write_customers,read_orders,read_products
SHOPIFY_APP_URL=https://your-app.vercel.app
```

### Required for SSO

```env
SHOPIFY_SSO_SECRET=generate-with-openssl-rand-base64-32
XWANAI_DOMAIN=https://www.xwanai.com
```

### Optional

```env
XWANAI_API_URL=https://api.xwanai.com
XWANAI_API_KEY=your-api-key
DATABASE_URL=your-database-url
```

---

## Generate Secrets Safely

### Generate SSO Secret

```bash
# Generate a secure random secret
openssl rand -base64 32

# Copy the output and use it for SHOPIFY_SSO_SECRET
# ⚠️ IMPORTANT: Use the SAME secret in both:
#   1. This Shopify app (Vercel)
#   2. Your Next.js/FastAPI backend (www.xwanai.com)
```

### Example Output
```
SHOPIFY_SSO_SECRET=Kx8pL2mN9qR4tV6wY8zA1bC3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7=
```

---

## Workflow Summary

### Local Development
```bash
# 1. Copy template file
cp env.template.txt .env

# 2. Fill in actual values (never commit this!)
# Edit .env with your secrets

# 3. Run locally
npm run dev
```

### Deploy to Vercel (Using Website Only)

**Method 1: Automatic Deployment (Recommended)**
1. **Connect GitHub Repository**
   - In Vercel dashboard, go to your project
   - Click **"Settings"** > **"Git"**
   - Connect your GitHub repository if not already connected
   - Vercel will automatically deploy on every push to `main` branch

2. **Push Code to GitHub**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

3. **Vercel Automatically**
   - Detects the push to GitHub
   - Builds your app
   - Uses environment variables you set in dashboard
   - Deploys to production
   - You'll see the deployment in **"Deployments"** tab

**Method 2: Manual Deployment via Website**
1. Go to your project in Vercel dashboard
2. Click **"Deployments"** tab
3. Click **"⋯"** (three dots) on any deployment
4. Click **"Redeploy"**
5. Or click **"Create Deployment"** button (top right)
6. Select branch and click **"Deploy"**

### After Deployment
```bash
# 1. Test your app
# 2. Check logs in Vercel dashboard
# 3. Verify environment variables are loaded
# 4. Remove any debug routes
```

---

## Troubleshooting

### Variables Not Available in Code

**Problem**: `process.env.SHOPIFY_API_KEY` is undefined

**Solutions**:
1. ✅ Verify variables are set in Vercel dashboard
2. ✅ Check environment scope (Production/Preview)
3. ✅ Redeploy after adding variables
4. ✅ Check variable names match exactly (case-sensitive)
5. ✅ Restart deployment if needed

### Build Fails

**Problem**: Build fails due to missing env vars

**Solutions**:
1. ✅ Check all required variables are set
2. ✅ Verify `SHOPIFY_APP_URL` matches your deployment URL
3. ✅ Check build logs for specific errors
4. ✅ Ensure Node.js version matches (check `package.json` engines)

### Secrets Exposed in Logs

**Problem**: Secrets appear in build/deployment logs

**Solutions**:
1. ✅ Never use `console.log(process.env.SHOPIFY_API_SECRET)`
2. ✅ Use conditional logging: `console.log('Has API key:', !!process.env.SHOPIFY_API_KEY)`
3. ✅ Enable Vercel's built-in secret masking
4. ✅ Rotate exposed secrets immediately

### SSO Not Working

**Problem**: SSO redirect fails or token invalid

**Solutions**:
1. ✅ Verify `SHOPIFY_SSO_SECRET` matches in both apps
2. ✅ Check `XWANAI_DOMAIN` is correct
3. ✅ Verify `SHOPIFY_APP_URL` is set correctly
4. ✅ Check deployment logs for errors

---

## Security Best Practices

✅ **DO:**
- Use `env.template.txt` as template (safe to commit - no secrets)
- Set real values in **Vercel Website Dashboard** (Settings > Environment Variables)
- Keep `.env` local only (already in `.gitignore`)
- Use different secrets for dev/staging/prod
- Rotate secrets if exposed
- Use Vercel's secret scanning

❌ **DON'T:**
- Commit `.env` files
- Log environment variables
- Share secrets in chat/email
- Use same secrets across environments
- Hardcode secrets in code

---

## File Structure

```
your-project/
├── .env                    # Local only (in .gitignore) ❌ Don't commit
├── env.template.txt        # Template (safe to commit) ✅ Commit this
├── .gitignore              # Already ignores .env.* ✅
├── VERCEL_ENV_SETUP.md     # This guide
└── ...
```

---

## Next Steps (All via Vercel Website!)

1. ✅ Copy `env.template.txt` to `.env` locally (for development)
2. ✅ Fill in `.env` with your actual values (local only - never commit!)
3. ✅ Go to **Vercel Dashboard** > Your Project > **Settings** > **Environment Variables**
4. ✅ Add all required variables one by one (see Step 2 above)
5. ✅ Select **Production** and **Preview** for each variable
6. ✅ Push code to GitHub (triggers automatic deployment)
7. ✅ Check deployment logs in Vercel website
8. ✅ Test your app at the Vercel URL
9. ✅ Verify SSO flow works
10. ✅ Remove any temporary debug routes

---

## Quick Reference: Vercel Website URLs

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Project Settings**: https://vercel.com/dashboard/[your-project]/settings
- **Environment Variables**: https://vercel.com/dashboard/[your-project]/settings/environment-variables
- **Deployments**: https://vercel.com/dashboard/[your-project]/deployments

## Need Help?

- **Vercel Docs (Web-based setup)**: https://vercel.com/docs/environment-variables
- **Import Project Guide**: https://vercel.com/docs/deployments/git
- **GitHub Secret Scanning**: https://docs.github.com/code-security/secret-scanning
- **Shopify Partner Dashboard**: https://partners.shopify.com/

---

**Remember**: `.env` files stay local, Vercel variables are set in the dashboard! 🎉
