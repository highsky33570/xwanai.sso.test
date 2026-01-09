import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { syncCustomerToXwanAI, type ShopifyCustomer } from "../services/xwanai-sync.server";

/**
 * Webhook handler for customer creation events
 * 
 * This webhook is triggered when a new customer is created in Shopify.
 * It syncs the customer data to xwanai.com platform.
 * 
 * Webhook topic: customers/create
 */

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, payload, topic } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Extract customer data from webhook payload
    // The payload structure depends on Shopify's webhook format
    // For GraphQL webhooks, the customer is in payload.customer
    // For REST webhooks, the customer is directly in the payload
    const customer = (payload as any).customer || payload;

    if (!customer || !customer.email) {
      console.error("Invalid customer data in webhook payload");
      return new Response("Invalid customer data", { status: 400 });
    }

    const shopifyCustomer: ShopifyCustomer = {
      id: customer.id || customer.gid || "",
      email: customer.email,
      first_name: customer.first_name || customer.firstName,
      last_name: customer.last_name || customer.lastName,
      phone: customer.phone,
      created_at: customer.created_at || customer.createdAt,
      updated_at: customer.updated_at || customer.updatedAt,
      accepts_marketing: customer.accepts_marketing || customer.acceptsMarketing,
      tags: customer.tags,
      note: customer.note,
      verified_email: customer.verified_email || customer.verifiedEmail,
      multipass_identifier: customer.multipass_identifier || customer.multipassIdentifier,
      addresses: customer.addresses?.map((addr: any) => ({
        id: addr.id || addr.gid,
        first_name: addr.first_name || addr.firstName,
        last_name: addr.last_name || addr.lastName,
        company: addr.company,
        address1: addr.address1 || addr.address1,
        address2: addr.address2 || addr.address2,
        city: addr.city,
        province: addr.province || addr.provinceCode,
        country: addr.country || addr.countryCode,
        zip: addr.zip || addr.zipCode,
        phone: addr.phone,
        default: addr.default || addr.isDefault,
      })),
    };

    // Sync customer to xwanai.com
    const result = await syncCustomerToXwanAI(shopifyCustomer, shop);

    if (!result.success) {
      console.error(`Failed to sync customer ${shopifyCustomer.email} to xwanai.com:`, result.error);
      // Don't fail the webhook - log error but return success to Shopify
      // This prevents webhook retries for API errors on xwanai.com side
    }

    return new Response(JSON.stringify({ success: true, synced: result.success }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing customers/create webhook:", error);
    // Return 500 to trigger Shopify webhook retry
    return new Response("Internal server error", { status: 500 });
  }
};
