import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { NextRequest } from "next/server"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Public-facing server origin for building URLs (download links, approval URLs, etc.).
 * Uses SERVER_URL env var; falls back to the request origin.
 */
export function getServerOrigin(req: NextRequest): string {
  return process.env.SERVER_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
}

/**
 * Server origin in contexts without a request object (server actions/jobs).
 */
export function getServerOriginFromEnv(fallback = "http://localhost:3000"): string {
  return process.env.SERVER_URL?.replace(/\/+$/, "") || fallback;
}
