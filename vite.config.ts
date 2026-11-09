import { cloudflare } from "@cloudflare/vite-plugin"
import preact from "@preact/preset-vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type Plugin } from "vite"
import { SECURITY_HEADERS } from "./src/shared/security-headers.ts"
import { ORIGIN, PAGES } from "./src/web/seo.ts"

// Static assets never run through the Worker, so their headers come from a `_headers` file.
// Generating it from SECURITY_HEADERS keeps one source of truth.
const securityHeadersFile = (): Plugin => ({
  name: "secret:security-headers",
  generateBundle() {
    if (this.environment.name !== "client") return
    const lines = Object.entries(SECURITY_HEADERS).map(([name, value]) => `  ${name}: ${value}`)
    // Links are private: keep any that leak out of search results.
    const reveal = ["/s/*", "  X-Robots-Tag: noindex", ""]
    this.emitFile({
      type: "asset",
      fileName: "_headers",
      source: ["/*", ...lines, "", ...reveal].join("\n"),
    })
  },
})

// Search engines get every prerendered page (src/web/seo.ts) in sitemap.xml.
const sitemap = (): Plugin => ({
  name: "secret:sitemap",
  generateBundle() {
    if (this.environment.name !== "client") return
    const urls = Object.keys(PAGES).map((path) => `  <url><loc>${ORIGIN}${path}</loc></url>`)
    this.emitFile({
      type: "asset",
      fileName: "sitemap.xml",
      source: [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls,
        "</urlset>",
        "",
      ].join("\n"),
    })
  },
})

// Tidies the prerendered pages:
// - The prerenderer writes /how-it-works as how-it-works/index.html, which Cloudflare would serve
//   only after a redirect to /how-it-works/. As how-it-works.html it's served at /how-it-works.
// - preact-iso marks its output with an empty inline <script type="isodata">. main.tsx hydrates
//   without it, and pages carry no inline scripts.
const ISODATA = /<script type="isodata"><\/script>/g
const finishPages = (): Plugin => ({
  name: "secret:finish-pages",
  enforce: "post",
  generateBundle(_options, bundle) {
    if (this.environment.name !== "client") return
    for (const [fileName, output] of Object.entries(bundle)) {
      if (output.type !== "asset" || !fileName.endsWith(".html")) continue
      if (typeof output.source !== "string") continue
      const source = output.source.replace(ISODATA, "")
      output.source = source
      const match = /^(.+)\/index\.html$/.exec(fileName)
      if (match?.[1] === undefined) continue
      // oxlint-disable-next-line typescript/no-dynamic-delete -- moving the asset to its new name
      delete bundle[fileName]
      this.emitFile({ type: "asset", fileName: `${match[1]}.html`, source })
    }
  },
})

export default defineConfig({
  plugins: [
    // Prerenders "/" and every page linked from it (main.tsx `prerender`), so search engines and
    // link previews get real HTML.
    preact({ prerender: { enabled: true, renderTarget: "#app" } }),
    tailwindcss(),
    cloudflare(),
    securityHeadersFile(),
    sitemap(),
    finishPages(),
  ],
  build: {
    // font-src and img-src fall back to default-src 'self', which blocks data: URIs.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
})
