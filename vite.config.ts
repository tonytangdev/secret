import { cloudflare } from "@cloudflare/vite-plugin"
import preact from "@preact/preset-vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type Plugin } from "vite"
import { SECURITY_HEADERS } from "./src/shared/security-headers.ts"

// Static assets never run through the Worker, so their headers come from a `_headers` file.
// Generating it from SECURITY_HEADERS keeps one source of truth.
const securityHeadersFile = (): Plugin => ({
  name: "secret:security-headers",
  generateBundle() {
    if (this.environment.name !== "client") return
    const lines = Object.entries(SECURITY_HEADERS).map(([name, value]) => `  ${name}: ${value}`)
    this.emitFile({ type: "asset", fileName: "_headers", source: ["/*", ...lines, ""].join("\n") })
  },
})

export default defineConfig({
  plugins: [preact(), tailwindcss(), cloudflare(), securityHeadersFile()],
  build: {
    // font-src and img-src fall back to default-src 'self', which blocks data: URIs.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
})
