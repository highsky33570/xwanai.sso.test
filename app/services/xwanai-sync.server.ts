/**
 * Service to sync customer data from Shopify to xwanai.com platform
 */

const XWANAI_API_URL = process.env.XWANAI_API_URL || "https://www.xwanai.com/api";
const XWANAI_API_KEY = process.env.XWANAI_API_KEY || "";

export interface ShopifyCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
  accepts_marketing?: boolean;
  tags?: string;
  note?: string;
  verified_email?: boolean;
  multipass_identifier?: string;
  addresses?: Array<{
    id?: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
    phone?: string;
    default?: boolean;
  }>;
}

export interface XwanAICustomer {
  shopify_customer_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  accepts_marketing?: boolean;
  tags?: string[];
  note?: string;
  verified_email?: boolean;
  addresses?: Array<{
    first_name?: string;
    last_name?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
    phone?: string;
    is_default?: boolean;
  }>;
}

/**
 * Transform Shopify customer data to xwanai.com format
 */
function transformCustomer(shopifyCustomer: ShopifyCustomer): XwanAICustomer {
  return {
    shopify_customer_id: extractCustomerId(shopifyCustomer.id),
    email: shopifyCustomer.email,
    first_name: shopifyCustomer.first_name || undefined,
    last_name: shopifyCustomer.last_name || undefined,
    phone: shopifyCustomer.phone || undefined,
    accepts_marketing: shopifyCustomer.accepts_marketing || false,
    tags: shopifyCustomer.tags ? shopifyCustomer.tags.split(",").map((t) => t.trim()) : undefined,
    note: shopifyCustomer.note || undefined,
    verified_email: shopifyCustomer.verified_email || false,
    addresses: shopifyCustomer.addresses?.map((addr) => ({
      first_name: addr.first_name,
      last_name: addr.last_name,
      company: addr.company,
      address1: addr.address1,
      address2: addr.address2,
      city: addr.city,
      province: addr.province,
      country: addr.country,
      zip: addr.zip,
      phone: addr.phone,
      is_default: addr.default || false,
    })),
  };
}

/**
 * Extract customer ID from Shopify GID format (gid://shopify/Customer/123456)
 */
function extractCustomerId(shopifyGid: string): string {
  const parts = shopifyGid.split("/");
  return parts[parts.length - 1] || shopifyGid;
}

/**
 * Sync customer to xwanai.com platform (create or update)
 */
export async function syncCustomerToXwanAI(
  shopifyCustomer: ShopifyCustomer,
  shopDomain: string
): Promise<{ success: boolean; error?: string; customerId?: string }> {
  if (!XWANAI_API_KEY) {
    console.warn("XWANAI_API_KEY not configured. Skipping customer sync.");
    return { success: false, error: "XWANAI_API_KEY not configured" };
  }

  try {
    const xwanAICustomer = transformCustomer(shopifyCustomer);

    // Call xwanai.com API to create or update customer
    const response = await fetch(`${XWANAI_API_URL}/customers/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XWANAI_API_KEY}`,
        "X-Shopify-Shop": shopDomain,
      },
      body: JSON.stringify(xwanAICustomer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to sync customer to xwanai.com: ${response.status} ${errorText}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json().catch(() => ({}));
    
    console.log(`Successfully synced customer ${shopifyCustomer.email} to xwanai.com`);
    
    return {
      success: true,
      customerId: data.customer_id || data.id || xwanAICustomer.shopify_customer_id,
    };
  } catch (error) {
    console.error("Error syncing customer to xwanai.com:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete customer from xwanai.com platform
 */
export async function deleteCustomerFromXwanAI(
  shopifyCustomerId: string,
  shopDomain: string
): Promise<{ success: boolean; error?: string }> {
  if (!XWANAI_API_KEY) {
    console.warn("XWANAI_API_KEY not configured. Skipping customer deletion.");
    return { success: false, error: "XWANAI_API_KEY not configured" };
  }

  try {
    const customerId = extractCustomerId(shopifyCustomerId);

    const response = await fetch(`${XWANAI_API_URL}/customers/${customerId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${XWANAI_API_KEY}`,
        "X-Shopify-Shop": shopDomain,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.error(`Failed to delete customer from xwanai.com: ${response.status} ${errorText}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    console.log(`Successfully deleted customer ${customerId} from xwanai.com`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting customer from xwanai.com:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
