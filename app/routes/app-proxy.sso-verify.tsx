import type { LoaderFunctionArgs } from "react-router";
import { validateShopifyToXwanAIToken } from "../lib/sso.server";

/**
 * App Proxy Route to verify SSO tokens (optional - for debugging/verification)
 * 
 * Accessible at: https://your-shop.myshopify.com/apps/xwan-ai-sso/verify
 */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return Response.json({ error: "Token parameter is required" }, { status: 400 });
    }

    const customerData = validateShopifyToXwanAIToken(token);

    if (!customerData) {
      return Response.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // Return customer data (without sensitive info in production)
    return Response.json({
      valid: true,
      customer: {
        email: customerData.email,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        createdAt: customerData.createdAt,
      },
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return Response.json({ error: "Verification failed" }, { status: 500 });
  }
};
