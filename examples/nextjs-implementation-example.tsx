/**
 * Complete Next.js Implementation Example for xwanai.com
 * 
 * This example shows how to:
 * 1. Validate SSO tokens from Shopify
 * 2. Create user sessions
 * 3. Handle authentication
 * 4. Generate tokens for reverse SSO (xwanai.com → Shopify)
 */

// ============================================================================
// 1. Token Validation Utility (lib/shopify-sso.ts)
// ============================================================================

import crypto from 'crypto';

const SHOPIFY_SSO_SECRET = process.env.SHOPIFY_SSO_SECRET!;
const TOKEN_EXPIRY_MINUTES = 15;

export interface CustomerSSOData {
  email: string;
  firstName?: string;
  lastName?: string;
  shopifyCustomerId?: string;
  createdAt: string;
  returnTo?: string;
}

export function validateShopifySSOToken(token: string): CustomerSSOData | null {
  if (!SHOPIFY_SSO_SECRET) {
    throw new Error('SHOPIFY_SSO_SECRET environment variable is required');
  }

  try {
    const tokenData = Buffer.from(token, 'base64url');
    const keyMaterial = crypto.createHash('sha256').update(SHOPIFY_SSO_SECRET).digest();
    const encryptionKey = keyMaterial.slice(0, 16);
    const signatureKey = keyMaterial.slice(16, 32);

    const signature = tokenData.slice(-32);
    const encryptedData = tokenData.slice(0, -32);

    const expectedSignature = crypto
      .createHmac('sha256', signatureKey)
      .update(encryptedData)
      .digest();

    if (!crypto.timingSafeEqual(signature, expectedSignature)) {
      return null;
    }

    const iv = encryptedData.slice(0, 16);
    const ciphertext = encryptedData.slice(16);

    const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
    let plaintext = decipher.update(ciphertext, undefined, 'utf8');
    plaintext += decipher.final('utf8');

    const customerData: CustomerSSOData = JSON.parse(plaintext);

    const createdAt = new Date(customerData.createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    if (diffMinutes > TOKEN_EXPIRY_MINUTES) {
      return null;
    }

    return customerData;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

// ============================================================================
// 2. Callback Route (app/auth/shopify-callback/route.ts)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validateShopifySSOToken } from '@/lib/shopify-sso';
import { createUserSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const returnTo = searchParams.get('return_to') || '/dashboard';

  if (!token) {
    return NextResponse.redirect(
      new URL(`/login?error=missing_token`, request.url)
    );
  }

  const customerData = validateShopifySSOToken(token);

  if (!customerData) {
    return NextResponse.redirect(
      new URL(`/login?error=invalid_token`, request.url)
    );
  }

  // Create or update user in your database
  const user = await createOrUpdateUser({
    email: customerData.email,
    firstName: customerData.firstName,
    lastName: customerData.lastName,
    shopifyCustomerId: customerData.shopifyCustomerId,
  });

  // Create session
  const sessionToken = await createUserSession(user.id);

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  
  response.cookies.set('xwanai_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}

async function createOrUpdateUser(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  shopifyCustomerId?: string;
}) {
  // Implement your user creation/update logic
  // Example with Prisma:
  // return await prisma.user.upsert({
  //   where: { email: data.email },
  //   update: data,
  //   create: data,
  // });
  return { id: 'user-123', ...data };
}

// ============================================================================
// 3. API Route for Generating Reverse SSO Tokens (app/api/auth/shopify-token/route.ts)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { generateShopifyRedirectToken } from '@/lib/shopify-redirect'; // Implement this

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const user = await getUserById(session.userId);
    if (!user || !user.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate redirect token for Shopify
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || 'your-shop.myshopify.com';
    const token = generateShopifyRedirectToken({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // If using Shopify Plus Multipass:
    const redirectUrl = `https://${shopDomain}/account/login/multipass/${token}`;
    
    // Or if using App Proxy:
    // const redirectUrl = `https://${shopDomain}/apps/xwan-ai-sso/login?token=${token}`;

    return NextResponse.json({ redirectUrl });
  } catch (error) {
    console.error('Error generating Shopify redirect:', error);
    return NextResponse.json(
      { error: 'Failed to generate redirect' },
      { status: 500 }
    );
  }
}

// ============================================================================
// 4. Client Component for Redirect Button (components/ShopRedirectButton.tsx)
// ============================================================================

'use client';

import { useState } from 'react';

export default function ShopRedirectButton() {
  const [loading, setLoading] = useState(false);

  const redirectToShop = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/shopify-token', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get redirect URL');
      }

      const { redirectUrl } = await response.json();
      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Redirect error:', error);
      alert('Failed to redirect to shop. Please try again.');
      setLoading(false);
    }
  };

  return (
    <button
      onClick={redirectToShop}
      disabled={loading}
      className="btn btn-primary"
    >
      {loading ? 'Redirecting...' : 'Go to Shop'}
    </button>
  );
}
