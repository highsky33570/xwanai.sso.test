import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import {
  generateXwanAIRedirectURL,
} from "../lib/sso.server";
import { generateErrorPage, getShopDomain } from "../lib/error-page.server";

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
      return generateErrorPage({
        title: "Missing Shop Parameter",
        message: `${url.toString()}`,
        errorCode: "missing_shop1",
        statusCode: 400,
      });
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

    // If no customer info and no token, show error page
    if (!customerEmail && !customerAccessToken) {
      const shopDomain = getShopDomain(shop);
      const loginUrl = shopDomain
        ? `https://${shopDomain}/account/login?checkout_url=${encodeURIComponent(request.url)}`
        : undefined;

      return generateErrorPage({
        title: "Authentication Required",
        message: "Please log in to your account to continue to XWAN.AI",
        errorCode: "missing_customer",
        shopDomain,
        accountUrl: loginUrl,
        statusCode: 401,
        icon: "🔒",
      });
    }

    // If we have customer access token, fetch customer data from Storefront API
    let email = customerEmail || undefined;
    let shopifyCustomerId = customerId || undefined;
    let first_name = firstName || undefined;
    let last_name = lastName || undefined;
    let customerData = undefined;

    if (customerAccessToken && !email) {
      try {
        // Use Storefront API to get customer info
        customerData = await fetchCustomerFromStorefront(
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
        return generateErrorPage({
          title: `Failed to fetch customer from Storefront API: ${JSON.stringify(cookies)}`,
          message: `${JSON.stringify(error)}`,
          errorCode: "fetch_customer_error",
          shopDomain: getShopDomain(shop),
          statusCode: 500,
        });
    
      }
    }

    if (!email) {
      const shopDomain = getShopDomain(shop);
      const loginUrl = shopDomain
        ? `https://${shopDomain}/account/login?checkout_url=${encodeURIComponent(request.url)}`
        : undefined;

      return generateErrorPage({
        title: "Unable to Retrieve Customer Information",
        message: "We couldn't retrieve your customer information. Please log in again and try.",
        errorCode: "missing_customer",
        shopDomain,
        accountUrl: loginUrl,
        statusCode: 400,
      });
    }
    // Get shop domain
    const shopDomain = shop.includes(".") ? shop : `${shop}.myshopify.com`;

    // Generate redirect URL to xwanai.com with customer data as query parameters
    const redirectURL = generateXwanAIRedirectURL({
      email,
      shop: shopDomain,
      customerId: shopifyCustomerId,
      firstName: first_name,
      lastName: last_name,
      returnTo,
    });

    // Fetch content from redirectURL
    try {
      const response = await fetch(redirectURL, {
        method: "GET",
        headers: {
          "Accept": "text/html,application/json",
          "User-Agent": request.headers.get("User-Agent") || "Shopify-App-Proxy",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("Content-Type") || "";
      
      // If it's JSON, parse and return as JSON
      if (contentType.includes("application/json")) {
        const jsonData = await response.json();

        // Extract tokens from nested session object
        // Response structure: { status, message, session: { access_token, refresh_token, ... }, user, redirect_to }
        const accessToken = jsonData.session?.access_token || jsonData.access_token;
        const refreshToken = jsonData.session?.refresh_token || jsonData.refresh_token;
        const redirectTo = jsonData.redirect_to || returnTo || "/";

        if (!accessToken) {
          throw new Error("No access_token found in response");
        }

        // Build redirect URL with access_token
        const frontendDomain = process.env.XWANAI_DOMAIN?.replace(/^https?:\/\//, "").split("/")[0] || "xwanai-front-vercel.vercel.app";
        const frontendUrl = process.env.XWANAI_DOMAIN || `https://${frontendDomain}`;
        
        const redirectUrl = new URL(frontendUrl);
        redirectUrl.searchParams.set("access_token", accessToken);
        if (refreshToken) {
          redirectUrl.searchParams.set("refresh_token", refreshToken);
        }

        // Redirect to frontend site with access_token
        return redirect(redirectUrl.toString());
      }

      // If it's HTML or other text, return as HTML
      const htmlContent = await response.text();
      return new Response(htmlContent, {
        status: response.status,
        headers: {
          "Content-Type": contentType || "text/html",
        },
      });
    } catch (fetchError) {
      console.error("Error fetching redirectURL content:", fetchError);
      return generateErrorPage({
        title: "Failed to Fetch Content",
        message: `Unable to fetch content from: ${redirectURL}\nError: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        errorCode: "fetch_content_error",
        shopDomain: getShopDomain(shop),
        statusCode: 500,
      });
    }

    // Alternative: Redirect to xwanai.com with customer data
    // return redirect(redirectURL);
  } catch (error) {
    console.error("SSO token generation error:", error);
    
    // Get error details
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop") || url.searchParams.get("*.myshopify.com");
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    // Determine error code and user-friendly message
    let errorCode = "sso_failed";
    let friendlyMessage = "Unable to complete SSO authentication. Please try again or contact support.";
    let title = "SSO Authentication Failed";
    let statusCode = 500;

    // if (errorMessage.includes("Shop parameter") || errorMessage.includes("required")) {
    //   errorCode = "missing_shop2";
    //   friendlyMessage = "Shop parameter is required. Please try again.";
    //   title = "Missing Shop Parameter";
    //   statusCode = 400;
    // } else if (errorMessage.includes("customer") || errorMessage.includes("Unable to retrieve")) {
    //   errorCode = "missing_customer";
    //   friendlyMessage = "Customer information not found. Please log in to your account first.";
    //   title = "Authentication Required";
    //   statusCode = 401;
    // } else if (errorMessage.includes("token") || errorMessage.includes("SHOPIFY_SSO_SECRET")) {
    //   errorCode = "token_generation_failed";
    //   friendlyMessage = "Failed to generate authentication token. Please try again.";
    //   title = "Token Generation Error";
    //   statusCode = 500;
    // } else if (errorMessage.includes("Storefront API") || errorMessage.includes("401") || errorMessage.includes("403")) {
    //   errorCode = "invalid_customer_token";
    //   friendlyMessage = "Invalid customer session. Please log in again.";
    //   title = "Invalid Session";
    //   statusCode = 401;
    // }

    // Return error page
    const shopDomain = getShopDomain(shop);
    
    return generateErrorPage({
      title: `${title} : ${errorMessage.toString()}`,
      message: `${friendlyMessage} : ${url.toString()}`,
      errorCode,
      shopDomain,
      statusCode,
    });
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

    // Get shop domain
    const shopDomain = shop.includes(".") ? shop : `${shop}.myshopify.com`;

    // Generate redirect URL to xwanai.com with customer data as query parameters
    const redirectURL = generateXwanAIRedirectURL({
      email: customerData.email,
      shop: shopDomain,
      customerId: customerData.id,
      firstName: customerData.firstName ?? undefined,
      lastName: customerData.lastName ?? undefined,
      returnTo,
    });

    return Response.json({ redirectUrl: redirectURL });
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
