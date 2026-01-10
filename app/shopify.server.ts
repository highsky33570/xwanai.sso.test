import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env file if it exists (for local development/testing)
// This is a simple .env loader - in production, use proper environment variable management
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Try multiple possible paths for .env file
  const possiblePaths = [
    join(__dirname, "..", ".env"), // From app/ directory
    join(__dirname, "..", "..", ".env"), // From build/server/ directory
    join(process.cwd(), ".env"), // From project root
  ];
  
  let envFile: string | null = null;
  for (const envPath of possiblePaths) {
    try {
      envFile = readFileSync(envPath, "utf-8");
      break;
    } catch {
      // Try next path
      continue;
    }
  }
  
  if (envFile) {
    const envLines = envFile.split("\n");
    for (const line of envLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
} catch (error) {
  // .env file doesn't exist or can't be read - that's okay, use environment variables
}

// Fallback: Use HOST env var if SHOPIFY_APP_URL is not set (similar to vite.config.ts)
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
}

const appUrl = process.env.SHOPIFY_APP_URL || "";

// Validate appUrl before creating shopify instance

if (!appUrl || appUrl.trim() === "") {
  const errorMsg = 
    "SHOPIFY_APP_URL environment variable is required but is empty or not set.\n" +
    "\n" +
    "SOLUTIONS:\n" +
    "1. For development: Use 'shopify app dev' (recommended) - it sets env vars automatically\n" +
    "2. Create a .env file in project root with: SHOPIFY_APP_URL=https://your-app-url.com\n" +
    "3. Set environment variable: export SHOPIFY_APP_URL=https://your-app-url.com\n" +
    "4. For production: Set SHOPIFY_APP_URL in your hosting platform's environment variables\n" +
    "\n" +
    "Current status:\n" +
    `- SHOPIFY_APP_URL: ${process.env.SHOPIFY_APP_URL || 'NOT SET'}\n` +
    `- HOST: ${process.env.HOST || 'NOT SET'}\n` +
    `- Working directory: ${process.cwd()}\n` +
    `- NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`;
  console.error("[ERROR]", errorMsg);
  console.error("[DEBUG] All SHOPIFY env vars:", 
    Object.keys(process.env)
      .filter(k => k.startsWith('SHOPIFY'))
      .map(k => `${k}=${process.env[k] ? (k.includes('SECRET') || k.includes('KEY') ? '***HIDDEN***' : process.env[k]) : 'NOT_SET'}`)
      .join(', '));
  throw new Error("SHOPIFY_APP_URL is required. See console for details.");
}

let shopify;
try {
  shopify = shopifyApp({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
    apiVersion: ApiVersion.January26,
    scopes: process.env.SCOPES?.split(","),
    appUrl: appUrl,
    authPathPrefix: "/auth",
    sessionStorage: new PrismaSessionStorage(prisma),
    distribution: AppDistribution.AppStore,
    future: {
      expiringOfflineAccessTokens: true,
    },
    ...(process.env.SHOP_CUSTOM_DOMAIN
      ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
      : {}),
  });
} catch (error) {
  if (error instanceof Error && error.message.includes('appUrl')) {
    const errorMsg = 
      "Failed to initialize Shopify app: appUrl configuration is invalid.\n" +
      `Current appUrl value: "${appUrl}"\n` +
      "Please ensure SHOPIFY_APP_URL is set correctly.\n" +
      "For development, use 'shopify app dev' which sets this automatically.";
    console.error("[ERROR]", errorMsg);
    throw new Error(errorMsg);
  }
  throw error;
}

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
