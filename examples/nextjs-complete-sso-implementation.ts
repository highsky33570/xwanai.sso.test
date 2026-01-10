/**
 * Complete Next.js SSO Implementation for XWAN.AI
 * 
 * This file contains all the necessary code to implement SSO from Shopify
 * to your Next.js application.
 * 
 * Files to create:
 * 1. lib/shopify-sso.ts - Token validation utility
 * 2. app/auth/shopify-callback/route.ts - SSO callback handler
 * 3. lib/auth.ts - User and session management
 */

// ============================================================================
// File 1: lib/shopify-sso.ts
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
// File 2: app/auth/shopify-callback/route.ts
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validateShopifySSOToken } from '@/lib/shopify-sso';
import { createUserSession, createOrUpdateUser } from '@/lib/auth';

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

  try {
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
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('SSO callback error:', error);
    return NextResponse.redirect(
      new URL(`/login?error=authentication_failed`, request.url)
    );
  }
}

// ============================================================================
// File 3: lib/auth.ts
// ============================================================================

import crypto from 'crypto';
import { prisma } from '@/lib/prisma'; // Adjust import based on your setup

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  shopifyCustomerId?: string | null;
}

export async function createOrUpdateUser(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  shopifyCustomerId?: string;
}): Promise<User> {
  // Example using Prisma
  return await prisma.user.upsert({
    where: { email: data.email },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      shopifyCustomerId: data.shopifyCustomerId,
      updatedAt: new Date(),
    },
    create: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      shopifyCustomerId: data.shopifyCustomerId,
    },
  });
}

export async function createUserSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('base64url');
  
  // Store session in database
  // Example using Prisma:
  await prisma.session.create({
    data: {
      token: sessionToken,
      userId: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  
  return sessionToken;
}

export async function getSessionUser(sessionToken: string): Promise<User | null> {
  if (!sessionToken) {
    return null;
  }

  try {
    // Get session from database
    const session = await prisma.session.findFirst({
      where: {
        token: sessionToken,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      return null;
    }

    return session.user;
  } catch (error) {
    console.error('Error getting session user:', error);
    return null;
  }
}

// ============================================================================
// File 4: middleware.ts (Optional - for protecting routes)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  // Skip middleware for public routes
  if (
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/api/public')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = request.cookies.get('xwanai_session')?.value;

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify session
  const user = await getSessionUser(sessionToken);

  if (!user) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('xwanai_session');
    return response;
  }

  // Add user to request headers for use in server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.id);
  requestHeaders.set('x-user-email', user.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

// ============================================================================
// File 5: app/login/page.tsx (Example login page)
// ============================================================================

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    if (error === 'missing_token') {
      alert('SSO token is missing. Please try again.');
    } else if (error === 'invalid_token') {
      alert('SSO token is invalid or expired. Please try again.');
    } else if (error === 'authentication_failed') {
      alert('Authentication failed. Please try again.');
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to XWAN.AI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <a
              href="https://your-shop.myshopify.com/account/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              login via Shopify
            </a>
          </p>
        </div>
        {/* Add your login form here */}
      </div>
    </div>
  );
}

// ============================================================================
// Environment Variables (.env.local)
// ============================================================================

/*
SHOPIFY_SSO_SECRET=your-secret-key-here-must-match-shopify-app
DATABASE_URL=your-database-connection-string
*/

// ============================================================================
// Database Schema (Prisma example)
// ============================================================================

/*
// prisma/schema.prisma

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  firstName         String?
  lastName          String?
  shopifyCustomerId String?   @unique
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  sessions          Session[]
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@index([token])
  @@index([userId])
}
*/
