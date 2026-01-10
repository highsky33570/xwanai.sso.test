# FastAPI + Supabase Setup Guide

## Quick Start

### 1. File Structure

Copy the entire `fastapi-supabase-sso/` folder to your FastAPI project:

```
your-fastapi-project/
├── main.py
├── app/
│   ├── routes/
│   │   └── auth/
│   │       └── shopify_callback.py
│   └── middleware/
│       └── auth.py
├── utils/
│   ├── shopify_sso.py
│   ├── database.py
│   └── auth.py
└── requirements.txt
```

### 2. Install Dependencies

```bash
pip install fastapi uvicorn supabase cryptography python-dotenv
```

Or use the requirements file:
```bash
pip install -r requirements.txt
```

### 3. Supabase Setup

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create new project
   - Wait for database to be ready

2. **Get Credentials**
   - Go to **Settings** > **API**
   - Copy **Project URL** → `SUPABASE_URL`
   - Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

3. **Create Database Schema**
   - Go to **SQL Editor**
   - Run the SQL from `supabase_schema.sql`
   - Verify tables are created: `users` and `sessions`

### 4. Environment Variables

Create `.env` file:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SHOPIFY_SSO_SECRET=your-secret-key-must-match-shopify-app
ENVIRONMENT=production
ALLOWED_ORIGINS=https://www.xwanai.com
```

**Important**: `SHOPIFY_SSO_SECRET` must match the secret in your Shopify app!

### 5. Run Application

```bash
# Development
uvicorn main:app --reload

# Production
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Testing

### Test SSO Callback

```bash
# Generate a test token from your Shopify app first
curl "http://localhost:8000/auth/shopify-callback?token=TEST_TOKEN&return_to=/dashboard"
```

### Test Database Connection

```python
from utils.database import get_supabase

supabase = get_supabase()
result = supabase.table("users").select("*").limit(1).execute()
print(result.data)
```

## Integration with Existing FastAPI App

If you already have a FastAPI app:

1. **Copy utility files** to your `utils/` folder
2. **Add route** to your existing router:
   ```python
   from app.routes.auth import shopify_callback
   app.include_router(shopify_callback.router)
   ```
3. **Update CORS** to include your frontend domain
4. **Set environment variables**

## Next Steps

1. ✅ Set up Supabase database
2. ✅ Configure environment variables
3. ✅ Test SSO callback endpoint
4. ✅ Deploy to production
5. ✅ Configure Shopify App Proxy
6. ✅ Add header button to Shopify theme

See `SHOPIFY_APP_DEPLOYMENT_GUIDE.md` for complete deployment instructions.
