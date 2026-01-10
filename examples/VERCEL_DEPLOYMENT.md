# Deploying to Vercel

## Important: Never Commit `.env` Files!

**DO NOT commit `.env` files to git** - they contain secrets that will be exposed publicly.

Instead, use Vercel's environment variables feature.

---

## Step 1: Remove `.env` from Git History

If you already committed `.env`, remove it:

```bash
# Remove from current commit
git rm --cached .env

# If it's in previous commits, rewrite history:
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (be careful!)
git push origin --force --all
```

Or use GitHub's secret scanning tool to revoke the exposed secret.

---

## Step 2: Set Environment Variables in Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to your project on [Vercel](https://vercel.com/)
2. Click **Settings** > **Environment Variables**
3. Add each variable:

| Variable | Description | Required |
|----------|-------------|----------|
| `SHOPIFY_API_KEY` | Shopify API Client ID | ✅ Yes |
| `SHOPIFY_API_SECRET` | Shopify API Client Secret | ✅ Yes |
| `SCOPES` | Comma-separated scopes | ✅ Yes |
| `SHOPIFY_APP_URL` | Your app URL | ✅ Yes |
| `SHOPIFY_SSO_SECRET` | SSO secret (must match backend) | ✅ Yes |
| `XWANAI_DOMAIN` | Your Next.js website URL | ✅ Yes |
| `XWANAI_API_URL` | Backend API URL (optional) | ❌ No |
| `XWANAI_API_KEY` | Backend API key (optional) | ❌ No |
| `DATABASE_URL` | Database connection string | ✅ Yes (if using DB) |

4. Select environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development (optional)

5. Click **Save**

### Option B: Via Vercel Website Dashboard (Recommended)

**No CLI needed!** Everything is done through the Vercel website:

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **Settings** > **Environment Variables**
4. Click **"Add New"** for each variable
5. Fill in Key, Value, and select environments (Production, Preview)
6. Click **Save** for each variable

See `VERCEL_ENV_SETUP.md` for detailed step-by-step instructions using only the website!

---

## Step 3: Configure Vercel Build Settings

### Build Command
```
npm run build
```

### Output Directory
```
build/client
```

### Install Command
```
npm install
```

### Node.js Version
```
20.x
```

### Framework Preset
```
Other
```

---

## Step 4: Deploy

### First Deployment

```bash
# Push to GitHub (without .env!)
git push origin main

# Or deploy directly
vercel --prod
```

### Automatic Deployments

Vercel automatically deploys on:
- Push to `main` branch → Production
- Push to other branches → Preview
- Pull requests → Preview

---

## Step 5: Verify Environment Variables

After deployment, verify variables are set:

1. Go to Vercel Dashboard > Your Project > **Deployments**
2. Click on latest deployment
3. Click **Runtime Logs**
4. Check that environment variables are loaded

Or add a temporary debug route:

```typescript
// app/routes/debug.env.tsx (REMOVE AFTER TESTING!)
export const loader = async () => {
  return Response.json({
    hasApiKey: !!process.env.SHOPIFY_API_KEY,
    hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
    hasSsoSecret: !!process.env.SHOPIFY_SSO_SECRET,
    // Don't expose actual values!
  });
};
```

**Remember to remove this route after testing!**

---

## Troubleshooting

### Environment Variables Not Loading

**Problem**: Variables not accessible in app

**Solutions**:
1. Verify variables are set in Vercel dashboard
2. Check environment scope (Production/Preview/Development)
3. Redeploy after adding variables
4. Restart deployment if needed
5. Check variable names match exactly (case-sensitive)

### Build Fails

**Problem**: Build fails due to missing env vars

**Solutions**:
1. Check all required variables are set
2. Verify `SHOPIFY_APP_URL` is correct
3. Check build logs for specific errors
4. Ensure Node.js version matches

### Secrets Exposed in Logs

**Problem**: Secrets appear in build logs

**Solutions**:
1. Never log environment variables
2. Use `console.log()` only for non-sensitive data
3. Use Vercel's built-in secret masking
4. If exposed, rotate secrets immediately

---

## Security Best Practices

1. ✅ **Never commit `.env` files**
2. ✅ **Use `.env.example` as template** (without secrets)
3. ✅ **Set variables in Vercel dashboard**
4. ✅ **Use different secrets for dev/staging/prod**
5. ✅ **Rotate secrets if exposed**
6. ✅ **Use Vercel's secret scanning**
7. ✅ **Limit access to environment variables**
8. ✅ **Review deployment logs for leaks**

---

## Example `.env.example` Template

Create `.env.example` in your repo (commit this, but not `.env`):

```env
# .env.example (safe to commit)
SHOPIFY_API_KEY=your-client-id-here
SHOPIFY_API_SECRET=your-client-secret-here
SCOPES=read_customers,write_customers,read_orders,read_products
SHOPIFY_APP_URL=https://your-app.vercel.app
SHOPIFY_SSO_SECRET=generate-with-openssl-rand-base64-32
XWANAI_DOMAIN=https://www.xwanai.com
DATABASE_URL=file:./prisma/dev.sqlite
```

Then developers can:
```bash
cp .env.example .env
# Fill in actual values locally
```

---

## Quick Reference

### Required Environment Variables

```bash
SHOPIFY_API_KEY          # From Partner Dashboard or client
SHOPIFY_API_SECRET       # From Partner Dashboard or client  
SCOPES                   # read_customers,write_customers,...
SHOPIFY_APP_URL          # Your Vercel deployment URL
SHOPIFY_SSO_SECRET       # Generate secret (must match backend!)
XWANAI_DOMAIN            # https://www.xwanai.com
DATABASE_URL             # For Prisma (if using database)
```

### Generate SSO Secret

```bash
openssl rand -base64 32
```

### Verify Variables in Vercel

1. Dashboard > Settings > Environment Variables
2. Check all variables are set
3. Verify environments (Production/Preview)
4. Redeploy if needed

---

## Next Steps

1. ✅ Remove `.env` from git history
2. ✅ Create `.env.example` template
3. ✅ Set variables in Vercel dashboard
4. ✅ Deploy and verify
5. ✅ Remove any debug routes
6. ✅ Rotate exposed secrets if any
