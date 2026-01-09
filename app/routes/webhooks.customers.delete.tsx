import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteCustomerFromXwanAI } from "../services/xwanai-sync.server";

/**
 * Webhook handler for customer deletion events
 * 
 * This webhook is triggered when a customer is deleted in Shopify.
 * It removes the customer from xwanai.com platform.
 * 
 * Webhook topic: customers/delete
 */

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, payload, topic } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Extract customer ID from webhook payload
    const customer = (payload as any).customer || payload;
    const customerId = customer?.id || customer?.gid || customer;

    if (!customerId) {
      console.error("Invalid customer ID in webhook payload");
      return new Response("Invalid customer ID", { status: 400 });
    }

    // Delete customer from xwanai.com
    const result = await deleteCustomerFromXwanAI(customerId, shop);

    if (!result.success) {
      console.error(`Failed to delete customer ${customerId} from xwanai.com:`, result.error);
      // Don't fail the webhook - log error but return success to Shopify
    }

    return new Response(JSON.stringify({ success: true, deleted: result.success }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing customers/delete webhook:", error);
    // Return 500 to trigger Shopify webhook retry
    return new Response("Internal server error", { status: 500 });
  }
};
