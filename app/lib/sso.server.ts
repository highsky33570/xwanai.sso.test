import crypto from "crypto";

/**
 * SSO Token Utility for bidirectional SSO between Shopify storefront and xwanai.com
 * 
 * This implements a secure token-based SSO system similar to Shopify Multipass
 * but for custom integration with www.xwanai.com
 */

const SHOPIFY_SSO_SECRET = process.env.SHOPIFY_SSO_SECRET || "";
const XWANAI_SSO_SECRET = process.env.XWANAI_SSO_SECRET || "";
const XWANAI_DOMAIN = process.env.XWANAI_DOMAIN || "https://www.xwanai.com";
export const XWANAI_FRONTEND_DOMAIN = process.env.XWANAI_FRONTEND_DOMAIN || process.env.XWANAI_DOMAIN || "https://www.xwanai.com";
const TOKEN_EXPIRY_MINUTES = 15;

export interface CustomerSSOData {
  email: string;
  firstName?: string;
  lastName?: string;
  shopifyCustomerId?: string;
  createdAt: string;
  returnTo?: string;
}

/**
 * Generate a secure SSO token for Shopify → xwanai.com flow
 * This token is generated when a customer clicks "go to xwanai.com" on the shop
 */
export function generateShopifyToXwanAIToken(
  customerData: Omit<CustomerSSOData, "createdAt">
): string {
  if (!SHOPIFY_SSO_SECRET) {
    throw new Error("SHOPIFY_SSO_SECRET environment variable is required");
  }

  // Prepare customer data with timestamp
  const data: CustomerSSOData = {
    ...customerData,
    createdAt: new Date().toISOString(),
  };

  // Derive encryption and signature keys from secret
  const keyMaterial = crypto.createHash("sha256").update(SHOPIFY_SSO_SECRET).digest();
  const encryptionKey = keyMaterial.slice(0, 16);
  const signatureKey = keyMaterial.slice(16, 32);

  // Serialize to JSON
  const plaintext = JSON.stringify(data);

  // Encrypt using AES-128-CBC
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-128-cbc", encryptionKey, iv);
  let ciphertext = cipher.update(plaintext, "utf8");
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);

  // Combine IV + ciphertext
  const encryptedData = Buffer.concat([iv, ciphertext]);

  // Sign the encrypted data using HMAC-SHA256
  const signature = crypto.createHmac("sha256", signatureKey).update(encryptedData).digest();

  // Combine encrypted data + signature
  const tokenData = Buffer.concat([encryptedData, signature]);

  // Base64 URL-safe encode
  return tokenData.toString("base64url");
}

/**
 * Validate and decrypt SSO token from Shopify → xwanai.com flow
 * This is used on xwanai.com to verify and extract customer data
 */
export function validateShopifyToXwanAIToken(token: string): CustomerSSOData | null {
  if (!SHOPIFY_SSO_SECRET) {
    throw new Error("SHOPIFY_SSO_SECRET environment variable is required");
  }

  try {
    // Decode base64
    const tokenData = Buffer.from(token, "base64url");

    // Derive keys
    const keyMaterial = crypto.createHash("sha256").update(SHOPIFY_SSO_SECRET).digest();
    const encryptionKey = keyMaterial.slice(0, 16);
    const signatureKey = keyMaterial.slice(16, 32);

    // Extract signature (last 32 bytes)
    const signature = tokenData.slice(-32);
    const encryptedData = tokenData.slice(0, -32);

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", signatureKey)
      .update(encryptedData)
      .digest();

    if (!crypto.timingSafeEqual(signature, expectedSignature)) {
      return null; // Invalid signature
    }

    // Extract IV (first 16 bytes) and ciphertext
    const iv = encryptedData.slice(0, 16);
    const ciphertext = encryptedData.slice(16);

    // Decrypt
    const decipher = crypto.createDecipheriv("aes-128-cbc", encryptionKey, iv);
    let plaintext = decipher.update(ciphertext, undefined, "utf8");
    plaintext += decipher.final("utf8");

    const customerData: CustomerSSOData = JSON.parse(plaintext);

    // Check token expiry (15 minutes)
    const createdAt = new Date(customerData.createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    if (diffMinutes > TOKEN_EXPIRY_MINUTES) {
      return null; // Token expired
    }

    return customerData;
  } catch (error) {
    console.error("Token validation error:", error);
    return null;
  }
}

/**
 * Generate SSO redirect URL for xwanai.com
 * 
 * Format: /api/v1/auth/shopify-callback?email=...&shop=...&customer_id=...&first_name=...&last_name=...&return_to=...
 * 
 * Example: GET /api/v1/auth/shopify-callback?email=customer@example.com&shop=myshop.myshopify.com&customer_id=123456&first_name=John&last_name=Doe&return_to=/dashboard
 */
export function generateXwanAIRedirectURL(
  customerData: {
    email: string;
    shop: string;
    customerId?: string;
    firstName?: string;
    lastName?: string;
    returnTo?: string;
  }
): string {
  const url = new URL(`${XWANAI_DOMAIN}/api/v1/auth/shopify-callback`);
  
  // Required parameters
  url.searchParams.set("email", customerData.email);
  url.searchParams.set("shop", customerData.shop);
  
  // Optional parameters
  if (customerData.customerId) {
    url.searchParams.set("customer_id", customerData.customerId);
  }
  if (customerData.firstName) {
    url.searchParams.set("first_name", customerData.firstName);
  }
  if (customerData.lastName) {
    url.searchParams.set("last_name", customerData.lastName);
  }
  if (customerData.returnTo) {
    url.searchParams.set("return_to", customerData.returnTo);
  }
  
  return url.toString();
}

/**
 * Generate token for xwanai.com → Shopify flow (for reverse SSO)
 * This uses Multipass-like token if Shopify Plus, or similar custom token
 */
export function generateXwanAIToShopifyToken(
  customerData: Omit<CustomerSSOData, "createdAt">,
  shopDomain: string
): string {
  // If using Shopify Plus Multipass, use that
  // Otherwise, generate custom token for App Proxy
  const data: CustomerSSOData = {
    ...customerData,
    createdAt: new Date().toISOString(),
  };

  // Similar encryption as above, but with different secret if needed
  if (!XWANAI_SSO_SECRET) {
    throw new Error("XWANAI_SSO_SECRET environment variable is required");
  }

  const keyMaterial = crypto.createHash("sha256").update(XWANAI_SSO_SECRET).digest();
  const encryptionKey = keyMaterial.slice(0, 16);
  const signatureKey = keyMaterial.slice(16, 32);

  const plaintext = JSON.stringify(data);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-128-cbc", encryptionKey, iv);
  let ciphertext = cipher.update(plaintext, "utf8");
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);

  const encryptedData = Buffer.concat([iv, ciphertext]);
  const signature = crypto.createHmac("sha256", signatureKey).update(encryptedData).digest();
  const tokenData = Buffer.concat([encryptedData, signature]);

  return tokenData.toString("base64url");
}

/**
 * Generate Shopify storefront redirect URL (for reverse SSO)
 */
export function generateShopifyRedirectURL(token: string, shopDomain: string): string {
  // If Shopify Plus with Multipass enabled:
  // return `https://${shopDomain}/account/login/multipass/${token}`;
  
  // For App Proxy approach:
  return `https://${shopDomain}/apps/xwan-ai-sso/login?token=${token}`;
}
