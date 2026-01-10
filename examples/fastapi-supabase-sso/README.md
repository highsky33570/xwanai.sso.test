# FastAPI + Supabase SSO Implementation

Complete FastAPI implementation for Shopify SSO using Supabase as the database.

## Project Structure

```
fastapi-supabase-sso/
├── main.py                 # FastAPI application entry point
├── app/
│   ├── routes/
│   │   └── auth/
│   │       └── shopify_callback.py  # SSO callback handler
│   └── middleware/
│       └── auth.py          # Authentication middleware
├── utils/
│   ├── shopify_sso.py      # Token validation
│   ├── database.py         # Supabase connection
│   └── auth.py             # User & session management
├── requirements.txt
├── .env.example
└── supabase_schema.sql     # Database schema
```

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to **Settings** > **API**
3. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Create Database Schema

1. Go to Supabase **SQL Editor**
2. Run the SQL from `supabase_schema.sql`

### 4. Set Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SHOPIFY_SSO_SECRET=your-secret-key-must-match-shopify-app
```

### 5. Run Application

```bash
# Development
uvicorn main:app --reload

# Production
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Usage

### SSO Callback Endpoint

When a customer clicks "Go to Xwan" on Shopify, they'll be redirected to:

```
GET /auth/shopify-callback?token=<sso-token>&return_to=/dashboard
```

This endpoint:
1. Validates the SSO token
2. Creates/updates user in Supabase
3. Creates a session
4. Sets session cookie
5. Redirects to `return_to` URL

### Protecting Routes

Use the authentication middleware:

```python
from fastapi import Depends
from app.middleware.auth import get_current_user

@app.get("/protected")
async def protected_route(current_user = Depends(get_current_user)):
    return {"user": current_user}
```

## API Endpoints

- `GET /` - Health check
- `GET /health` - Health status
- `GET /auth/shopify-callback` - SSO callback handler

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `SHOPIFY_SSO_SECRET` | Secret key for SSO (must match Shopify app) | Yes |
| `ENVIRONMENT` | `development` or `production` | No |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins | No |

## Database Schema

### Users Table

- `id` (UUID) - Primary key
- `email` (VARCHAR) - Unique email
- `first_name` (VARCHAR) - First name
- `last_name` (VARCHAR) - Last name
- `shopify_customer_id` (VARCHAR) - Shopify customer ID
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Sessions Table

- `id` (UUID) - Primary key
- `token` (VARCHAR) - Unique session token
- `user_id` (UUID) - Foreign key to users
- `expires_at` (TIMESTAMP) - Session expiry
- `created_at` (TIMESTAMP)

## Testing

### Test SSO Flow

1. Generate a test token (use your Shopify app's SSO endpoint)
2. Call the callback endpoint:
   ```bash
   curl "http://localhost:8000/auth/shopify-callback?token=TEST_TOKEN&return_to=/dashboard"
   ```
3. Check response for session cookie
4. Verify user created in Supabase

### Test Authentication

```python
# Get session token from cookie
session_token = "your-session-token"

# Test getting user
from utils.auth import get_user_from_session
user = get_user_from_session(session_token)
print(user)
```

## Deployment

See `SHOPIFY_APP_DEPLOYMENT_GUIDE.md` for complete deployment instructions.

### Quick Deploy to Heroku

```bash
# Create Procfile
echo "web: uvicorn main:app --host 0.0.0.0 --port \$PORT" > Procfile

# Deploy
git push heroku main
```

## Security Notes

1. **Never commit `.env` file** to git
2. **Use service role key** only on backend (never expose to frontend)
3. **Enable HTTPS** in production
4. **Set secure cookies** in production (`secure=True`)
5. **Rotate secrets** regularly
6. **Use environment variables** for all secrets

## Troubleshooting

### Database Connection Fails

- Verify `SUPABASE_URL` is correct
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify Supabase project is active
- Check network/firewall

### Token Validation Fails

- Ensure `SHOPIFY_SSO_SECRET` matches Shopify app
- Check token hasn't expired (15 minutes)
- Verify token format

### User Not Created

- Check database connection
- Verify schema is created
- Check Supabase logs
- Verify RLS policies allow service role

## License

MIT
