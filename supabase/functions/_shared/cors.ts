/**
 * Shared CORS utilities for Edge Functions
 * Provides secure, environment-aware CORS headers
 */

interface CorsConfig {
  production: string[];
  preview: string[];
  development: string[];
}

// Configure your allowed origins here
const ALLOWED_ORIGINS: CorsConfig = {
  // Your production domain(s)
  production: [
    'https://app.digitaldeltawebdesign.com',      // Primary production domain
    'https://underwraps-gift-list.vercel.app',    // Secondary Vercel domain
  ],

  // Vercel preview deployments (pattern matching)
  preview: [
    'https://*-alexandersteimle-mbp.vercel.app',  // Matches preview URLs
  ],

  // Local development
  development: [
    'http://localhost:8080',
    'http://localhost:5173',  // Vite default
    'http://127.0.0.1:8080',
  ],
};

/**
 * Check if an origin matches a pattern (supports wildcards)
 */
function matchesPattern(origin: string, pattern: string): boolean {
  if (pattern === origin) return true;

  if (pattern.includes('*')) {
    // Convert wildcard pattern to regex
    // e.g., "https://*-user.vercel.app" -> "https://.*-user\.vercel\.app"
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
      .replace(/\*/g, '.*');                    // Replace * with .*

    return new RegExp(`^${regexPattern}$`).test(origin);
  }

  return false;
}

/**
 * Determine if an origin is allowed based on environment
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allAllowedOrigins = [
    ...ALLOWED_ORIGINS.production,
    ...ALLOWED_ORIGINS.preview,
    ...ALLOWED_ORIGINS.development,
  ];

  return allAllowedOrigins.some(allowed => matchesPattern(origin, allowed));
}

/**
 * Get the appropriate CORS origin header value
 */
export function getAllowedOrigin(requestOrigin: string | null): string {
  // If origin is allowed, return it (enables credentials)
  if (requestOrigin && isOriginAllowed(requestOrigin)) {
    return requestOrigin;
  }

  // Default to primary production origin
  return ALLOWED_ORIGINS.production[0];
}

/**
 * Get standard CORS headers for a request
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');

  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(origin),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle CORS preflight requests
 * Returns a Response if this is a preflight, null otherwise
 */
export function handleCorsPreFlight(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }
  return null;
}

/**
 * Convenience function to create a JSON response with CORS headers
 */
export function corsResponse(
  request: Request,
  body: any,
  status: number = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}

/**
 * Convenience function to create an error response with CORS headers
 */
export function corsErrorResponse(
  request: Request,
  error: string,
  status: number = 400
): Response {
  return corsResponse(request, { success: false, error }, status);
}

