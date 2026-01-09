# Customer Webhook Sync Implementation

This document explains how customer data is synced from Shopify to xwanai.com using webhooks.

## Overview

Instead of using App Proxy SSO, this implementation uses **webhooks** to keep customer data synchronized between Shopify and xwanai.com. When customers are created, updated, or deleted in Shopify, webhooks automatically sync the changes to xwanai.com.

## How It Works

1. **Customer registers/logs in on Shopify store**
2. **Shopify sends webhook** to your Shopify app
3. **App receives webhook** and extracts customer data
4. **App calls xwanai.com API** to sync customer
5. **xwanai.com creates/updates customer** in its database
6. **Customer can now use SSO** because data is synced

## Webhook Events

### 1. `customers/create`
- Triggered when a new customer is created in Shopify
- Syncs customer data to xwanai.com
- Route: `/webhooks/customers/create`

### 2. `customers/update`
- Triggered when customer data is updated in Shopify
- Syncs updated data to xwanai.com
- Route: `/webhooks/customers/update`

### 3. `customers/delete`
- Triggered when a customer is deleted in Shopify
- Removes customer from xwanai.com
- Route: `/webhooks/customers/delete`

## Files Created

- `app/services/xwanai-sync.server.ts` - Service to sync customers to xwanai.com
- `app/routes/webhooks.customers.create.tsx` - Customer creation webhook handler
- `app/routes/webhooks.customers.update.tsx` - Customer update webhook handler
- `app/routes/webhooks.customers.delete.tsx` - Customer deletion webhook handler
- `WEBHOOK_IMPLEMENTATION.md` - Complete implementation guide

## Setup Steps

### 1. Configure Environment Variables

```bash
XWANAI_API_URL=https://www.xwanai.com/api
XWANAI_API_KEY=your_secure_api_key_here
```

### 2. Implement API Endpoints on xwanai.com

You need to create these endpoints:

- `POST /api/customers/sync` - Create or update customer
- `DELETE /api/customers/{customer_id}` - Delete customer

See `WEBHOOK_IMPLEMENTATION.md` for complete implementation examples.

### 3. Reinstall App

After configuration, reinstall the app to register webhooks:

1. Go to Shopify Admin > Apps
2. Uninstall your app
3. Reinstall your app
4. Webhooks will be automatically registered

### 4. Test Webhooks

1. Create a test customer in Shopify
2. Check app logs for webhook receipt
3. Verify customer was synced to xwanai.com
4. Test customer update and delete

## Customer Data Flow

```
Shopify Customer Created
    ↓
Webhook Triggered (customers/create)
    ↓
App Receives Webhook
    ↓
Transform Customer Data
    ↓
POST to xwanai.com/api/customers/sync
    ↓
xwanai.com Creates/Updates Customer
    ↓
Customer Available in xwanai.com Platform
```

## Combining with SSO

You can combine webhooks with SSO:

1. **Webhooks sync customer data** (background sync)
2. **SSO provides authentication** (when customer clicks "Go to xwanai.com")
3. **Customer already exists** in xwanai.com (synced via webhook)
4. **SSO token authenticates** using existing customer data

## Benefits

✅ **Reliable Sync**: Customer data is always up-to-date
✅ **Real-time Updates**: Changes sync immediately
✅ **Background Process**: No user interaction needed
✅ **Error Handling**: Failed syncs are logged
✅ **Scalable**: Handles multiple customers efficiently

## Troubleshooting

**Webhooks not received:**
- Reinstall app to register webhooks
- Check webhook URL is publicly accessible
- Check app logs for errors

**Customer not syncing:**
- Verify `XWANAI_API_KEY` is correct
- Verify `XWANAI_API_URL` is correct
- Check xwanai.com API logs
- Check webhook handler logs

**API errors:**
- Verify API endpoint exists
- Check authentication headers
- Verify request format matches expected schema

## Next Steps

1. ✅ Set environment variables
2. ✅ Implement API endpoints on xwanai.com
3. ✅ Reinstall app to register webhooks
4. ✅ Test customer creation/update/delete
5. ✅ Monitor logs for errors
6. ✅ Set up alerts for failed syncs

For detailed implementation, see `WEBHOOK_IMPLEMENTATION.md`.
