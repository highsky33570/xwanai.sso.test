import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import {
  generateShopifyToXwanAIToken,
  generateXwanAIRedirectURL,
} from "../lib/sso.server";

/**
 * App Proxy Route for SSO from Shopify Storefront to xwanai.com
 * 
 * This route should be accessible from your Shopify storefront via App Proxy.
 * Configure in Shopify Admin: Settings > Apps and sales channels > App and embed settings > App proxies
 * 
 * Proxy subpath: /sso
 * Proxy prefix: apps
 * Subpath prefix: xwan-ai-sso
 * 
 * This will make the route accessible at: https://your-shop.myshopify.com/apps/xwan-ai-sso/sso
 * 
 * Usage:
 * 1. GET request (from Liquid template): /apps/xwan-ai-sso/sso?return_to=/dashboard
 * 2. POST request (with customer access token): Include X-Customer-Access-Token header
 */

/**
 * GET handler - For direct links from Liquid templates
 * Customer info should be passed via query params or extracted from Shopify session
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop") || url.searchParams.get("*.myshopify.com");

    if (!shop) {
      throw new Error("Shop parameter is required");
    }

    // Try to get customer info from query params (for Liquid template usage)
    const customerEmail = url.searchParams.get("customer_email");
    const customerId = url.searchParams.get("customer_id");
    const firstName = url.searchParams.get("first_name");
    const lastName = url.searchParams.get("last_name");
    const returnTo = url.searchParams.get("return_to") || undefined;

    // If customer info not in query params, check for customer access token in cookies
    // This requires the customer to be logged in via Customer Account API
    const cookies = request.headers.get("cookie") || "";
    let customerAccessToken: string | null = null;

    // Extract customer access token from cookie
    const cookieMatch = cookies.match(/customerAccessToken=([^;]+)/);
    if (cookieMatch) {
      customerAccessToken = cookieMatch[1];
    }

    // If no customer info and no token, redirect to login
    if (!customerEmail && !customerAccessToken) {
      const shopDomain = shop.includes(".") ? shop : `${shop}.myshopify.com`;
      return redirect(
        `https://${shopDomain}/account/login?checkout_url=${encodeURIComponent(request.url)}`
      );
    }

    // If we have customer access token, fetch customer data from Storefront API
    let email = customerEmail || undefined;
    let shopifyCustomerId = customerId || undefined;
    let first_name = firstName || undefined;
    let last_name = lastName || undefined;

    if (customerAccessToken && !email) {
      try {
        // Use Storefront API to get customer info
        const customerData = await fetchCustomerFromStorefront(
          shop,
          customerAccessToken
        );
        if (customerData) {
          email = customerData.email;
          shopifyCustomerId = customerData.id;
          first_name = customerData.firstName ?? undefined;
          last_name = customerData.lastName ?? undefined;
        }
      } catch (error) {
        console.error("Failed to fetch customer from Storefront API:", error);
      }
    }

    if (!email) {
      throw new Error("Unable to retrieve customer information");
    }

    return redirect(`http://localhost:3000/app-proxy/sso?email=${email}&firstName=${first_name}&lastName=${last_name}&shopifyCustomerId=${shopifyCustomerId}&returnTo=${returnTo}`);

    // // Generate SSO token
    // const token = generateShopifyToXwanAIToken({
    //   email,
    //   firstName: first_name,
    //   lastName: last_name,
    //   shopifyCustomerId,
    //   returnTo,
    // });

    // // Generate redirect URL to xwanai.com
    // const redirectURL = generateXwanAIRedirectURL(token, returnTo);

    // // Redirect to xwanai.com with SSO token
    // return redirect(redirectURL);
  } catch (error) {
    console.error("SSO token generation error:", error);
    // Redirect to error page or back to shop
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop") || url.searchParams.get("*.myshopify.com");
    const shopDomain = shop && shop.includes(".") ? shop : `${shop}.myshopify.com`;
    const shopURL = shop ? `https://${shopDomain}` : url.origin;
    return redirect(`${shopURL}/account?error=sso_failed`);
  }
};

/**
 * POST handler - For programmatic access with customer access token
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop") || url.searchParams.get("*.myshopify.com");

    if (!shop) {
      return Response.json({ error: "Shop parameter is required" }, { status: 400 });
    }

    // Get customer access token from header
    const customerAccessToken = request.headers.get("X-Customer-Access-Token");

    if (!customerAccessToken) {
      return Response.json({ error: "Customer access token required" }, { status: 401 });
    }

    // Fetch customer data from Storefront API
    const customerData = await fetchCustomerFromStorefront(shop, customerAccessToken);

    if (!customerData) {
      return Response.json({ error: "Failed to fetch customer data" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const returnTo = body.return_to || url.searchParams.get("return_to") || undefined;

    // Generate SSO token
    const token = generateShopifyToXwanAIToken({
      email: customerData.email,
      firstName: customerData.firstName ?? undefined,
      lastName: customerData.lastName ?? undefined,
      shopifyCustomerId: customerData.id,
      returnTo,
    });

    // Generate redirect URL to xwanai.com
    const redirectURL = generateXwanAIRedirectURL(token, returnTo);

    return Response.json({ redirectUrl: redirectURL, token });
  } catch (error) {
    console.error("SSO token generation error:", error);
    return Response.json({ error: "SSO token generation failed" }, { status: 500 });
  }
};

/**
 * Fetch customer data from Shopify Storefront API using customer access token
 */
async function fetchCustomerFromStorefront(
  shop: string,
  customerAccessToken: string
): Promise<{
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
} | null> {
  try {
    const shopDomain = shop.includes(".") ? shop : `${shop}.myshopify.com`;
    const storefrontUrl = `https://${shopDomain}/api/2024-10/graphql.json`;

    const query = `
      query getCustomer {
        customer {
          id
          email
          firstName
          lastName
        }
      }
    `;

    const response = await fetch(storefrontUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": customerAccessToken,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Storefront API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors || !data.data?.customer) {
      throw new Error(data.errors?.[0]?.message || "Customer not found");
    }

    return {
      id: data.data.customer.id.split("/").pop() || "",
      email: data.data.customer.email,
      firstName: data.data.customer.firstName,
      lastName: data.data.customer.lastName,
    };
  } catch (error) {
    console.error("Error fetching customer from Storefront API:", error);
    return null;
  }
}
