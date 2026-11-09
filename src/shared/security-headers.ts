// Headers every response carries. The Worker sets them on /api/*; vite.config.ts writes them into
// the `_headers` file that Cloudflare's asset server applies to pages, scripts, styles and fonts.
export const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const

// Responses from /api/* also carry these.
export const API_HEADERS = { ...SECURITY_HEADERS, "Cache-Control": "no-store" } as const
