import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { NextRequest } from "next/server"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the public-facing server origin for building download URLs.
 * Strips any path (like /api/auth) that may have been appended to NEXTAUTH_URL.
 */
export function getServerOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      // fall through
    }
  }
  return req.nextUrl.origin;
}

/**
 * Get server origin in contexts without a request object (server actions/jobs).
 */
export function getServerOriginFromEnv(fallback = "http://localhost:3000"): string {
  const envUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      // fall through
    }
  }
  return fallback;
}
