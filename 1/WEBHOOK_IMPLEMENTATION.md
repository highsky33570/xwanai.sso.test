# Customer Webhook Implementation for xwanai.com Platform

This implementation syncs customer data from Shopify to xwanai.com using webhooks. When customers are created, updated, or deleted in Shopify, the changes are automatically synced to xwanai.com.

## Overview

The webhook system includes:

1. **Customer Creation Webhook** (`customers/create`) - Syncs new customers to xwanai.com
2. **Customer Update Webhook** (`customers/update`) - Syncs customer updates to xwanai.com
3. **Customer Deletion Webhook** (`customers/delete`) - Removes customers from xwanai.com

## Architecture

```
Shopify Store → Webhook Event → Shopify App → xwanai.com API
```

1. Customer action occurs in Shopify (create/update/delete)
2. Shopify sends webhook to your app
3. App processes webhook and transforms customer data
4. App sends customer data to xwanai.com API
5. xwanai.com creates/updates/deletes customer

## Setup

### 1. Environment Variables

Add these environment variables to your Shopify app:

```bash
# xwanai.com API configuration
XWANAI_API_URL=https://www.xwanai.com/api
XWANAI_API_KEY=your_api_key_here
```

### 2. Webhook Configuration

Webhooks are automatically configured in `shopify.app.toml`:

```toml
[[webhooks.subscriptions]]
topics = [ "customers/create" ]
uri = "/webhooks/customers/create"

[[webhooks.subscriptions]]
topics = [ "customers/update" ]
uri = "/webhooks/customers/update"

[[webhooks.subscriptions]]
topics = [ "customers/delete" ]
uri = "/webhooks/customers/delete"
```

### 3. Required Scopes

The app requires these scopes (already configured):
- `read_customers` - To receive customer webhook data
- `write_customers` - Optional, for updating customers if needed

### 4. Install/Reinstall App

After updating webhooks, reinstall the app to register the webhooks:
1. Uninstall the app from Shopify Admin
2. Reinstall the app
3. The webhooks will be automatically registered

## xwanai.com API Endpoints

You need to implement these endpoints on xwanai.com to receive customer data:

### 1. Sync Customer (POST `/api/customers/sync`)

This endpoint handles both customer creation and updates.

**Request Headers:**
```
Authorization: Bearer {XWANAI_API_KEY}
Content-Type: application/json
X-Shopify-Shop: {shop_domain}
```

**Request Body:**
```json
{
  "shopify_customer_id": "123456789",
  "email": "customer@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "accepts_marketing": true,
  "tags": ["vip", "premium"],
  "note": "Important customer",
  "verified_email": true,
  "addresses": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "company": "Example Inc",
      "address1": "123 Main St",
      "address2": "Suite 100",
      "city": "New York",
      "province": "NY",
      "country": "US",
      "zip": "10001",
      "phone": "+1234567890",
      "is_default": true
    }
  ]
}
```

**Response (Success):**
```json
{
  "success": true,
  "customer_id": "xwanai_customer_id_123",
  "message": "Customer synced successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

### 2. Delete Customer (DELETE `/api/customers/{customer_id}`)

**Request Headers:**
```
Authorization: Bearer {XWANAI_API_KEY}
X-Shopify-Shop: {shop_domain}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Customer deleted successfully"
}
```

## Implementation Examples

### Next.js (xwanai.com)

#### 1. Sync Customer Endpoint (`app/api/customers/sync/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    const shopDomain = request.headers.get('X-Shopify-Shop');

    if (!verifyApiKey(apiKey) || !shopDomain) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customerData = await request.json();

    // Upsert customer (create or update)
    const customer = await prisma.customer.upsert({
      where: {
        shopify_customer_id: customerData.shopify_customer_id,
      },
      update: {
        email: customerData.email,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        phone: customerData.phone,
        accepts_marketing: customerData.accepts_marketing,
        tags: customerData.tags,
        note: customerData.note,
        verified_email: customerData.verified_email,
        addresses: customerData.addresses,
        updated_at: new Date(),
      },
      create: {
        shopify_customer_id: customerData.shopify_customer_id,
        email: customerData.email,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        phone: customerData.phone,
        accepts_marketing: customerData.accepts_marketing,
        tags: customerData.tags,
        note: customerData.note,
        verified_email: customerData.verified_email,
        addresses: customerData.addresses,
        shop_domain: shopDomain,
      },
    });

    return NextResponse.json({
      success: true,
      customer_id: customer.id,
      message: 'Customer synced successfully',
    });
  } catch (error) {
    console.error('Error syncing customer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 2. Delete Customer Endpoint (`app/api/customers/[id]/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify API key
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!verifyApiKey(apiKey)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete customer by Shopify customer ID
    await prisma.customer.delete({
      where: {
        shopify_customer_id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { success: false, error: 'Customer not found' },
      { status: 404 }
    );
  }
}
```

### FastAPI (xwanai.com)

#### 1. Sync Customer Endpoint (`app/routes/api/customers.py`)

```python
from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from utils.auth import verify_api_key
from utils.database import get_db

router = APIRouter()

class Address(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None
    is_default: bool = False

class CustomerSync(BaseModel):
    shopify_customer_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    accepts_marketing: bool = False
    tags: Optional[List[str]] = None
    note: Optional[str] = None
    verified_email: bool = False
    addresses: Optional[List[Address]] = None

@router.post("/api/customers/sync")
async def sync_customer(
    customer: CustomerSync,
    authorization: str = Header(None),
    x_shopify_shop: str = Header(None),
    db = Depends(get_db),
):
    # Verify API key
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    api_key = authorization.replace("Bearer ", "")
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not x_shopify_shop:
        raise HTTPException(status_code=400, detail="X-Shopify-Shop header required")

    try:
        # Upsert customer in database
        # Example with SQLAlchemy:
        db_customer = db.query(Customer).filter(
            Customer.shopify_customer_id == customer.shopify_customer_id
        ).first()

        if db_customer:
            # Update existing customer
            db_customer.email = customer.email
            db_customer.first_name = customer.first_name
            db_customer.last_name = customer.last_name
            db_customer.phone = customer.phone
            db_customer.accepts_marketing = customer.accepts_marketing
            db_customer.tags = customer.tags
            db_customer.note = customer.note
            db_customer.verified_email = customer.verified_email
            db_customer.addresses = [addr.dict() for addr in customer.addresses] if customer.addresses else None
            db_customer.updated_at = datetime.utcnow()
        else:
            # Create new customer
            db_customer = Customer(
                shopify_customer_id=customer.shopify_customer_id,
                email=customer.email,
                first_name=customer.first_name,
                last_name=customer.last_name,
                phone=customer.phone,
                accepts_marketing=customer.accepts_marketing,
                tags=customer.tags,
                note=customer.note,
                verified_email=customer.verified_email,
                addresses=[addr.dict() for addr in customer.addresses] if customer.addresses else None,
                shop_domain=x_shopify_shop,
            )
            db.add(db_customer)

        db.commit()
        db.refresh(db_customer)

        return {
            "success": True,
            "customer_id": db_customer.id,
            "message": "Customer synced successfully",
        }
    except Exception as e:
        db.rollback()
        print(f"Error syncing customer: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/api/customers/{customer_id}")
async def delete_customer(
    customer_id: str,
    authorization: str = Header(None),
    db = Depends(get_db),
):
    # Verify API key
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    api_key = authorization.replace("Bearer ", "")
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        # Delete customer by Shopify customer ID
        db_customer = db.query(Customer).filter(
            Customer.shopify_customer_id == customer_id
        ).first()

        if not db_customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        db.delete(db_customer)
        db.commit()

        return {
            "success": True,
            "message": "Customer deleted successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error deleting customer: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

## Testing Webhooks

### 1. Test with Shopify CLI

```bash
# Trigger customer creation webhook
shopify app generate webhook --type customers/create

# Or test manually
shopify webhook trigger --topic customers/create
```

### 2. Test with Shopify Admin

1. Go to your Shopify store
2. Create a new customer manually
3. Check your app logs for the webhook
4. Verify customer was synced to xwanai.com

### 3. Test API Endpoints Directly

```bash
# Test sync endpoint
curl -X POST https://www.xwanai.com/api/customers/sync \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Shop: your-shop.myshopify.com" \
  -d '{
    "shopify_customer_id": "123456",
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User"
  }'

# Test delete endpoint
curl -X DELETE https://www.xwanai.com/api/customers/123456 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Shopify-Shop: your-shop.myshopify.com"
```

## Troubleshooting

### Webhooks Not Receiving

1. **Check webhook registration**: Reinstall the app to register webhooks
2. **Check webhook URL**: Ensure the URL is publicly accessible
3. **Check logs**: Look for webhook errors in your app logs
4. **Test manually**: Use Shopify CLI to test webhooks

### Customer Not Syncing

1. **Check API key**: Verify `XWANAI_API_KEY` is correct
2. **Check API URL**: Verify `XWANAI_API_URL` is correct and accessible
3. **Check logs**: Look for errors in webhook handlers
4. **Check response**: Ensure xwanai.com API returns 200 status

### Error Handling

The webhook handlers are designed to:
- Log errors but not fail the webhook (to prevent retries)
- Return success to Shopify even if xwanai.com sync fails
- Provide detailed error logs for debugging

## Security

1. **API Key Authentication**: All requests to xwanai.com must include valid API key
2. **HMAC Verification**: Shopify webhooks are automatically verified by the app
3. **HTTPS Only**: Use HTTPS for all API endpoints
4. **Rate Limiting**: Implement rate limiting on xwanai.com API endpoints

## Next Steps

1. Set up environment variables
2. Implement API endpoints on xwanai.com
3. Reinstall app to register webhooks
4. Test webhook flow
5. Monitor logs for errors
6. Set up alerts for failed syncs
