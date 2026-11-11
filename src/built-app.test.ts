// Runs against the built app (`vite build` first; `npm test` does it). Static assets never reach
// the Worker, so their headers come from the generated `_headers` file and only a real asset
// server shows whether they are applied. `vite preview` boots the build in workerd.
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, layer } from "@effect/vitest"
import { Context, Effect, Layer, Schema } from "effect"
import { preview } from "vite"

const clientDir = join(import.meta.dirname, "../dist/client")

class App extends Context.Service<
  App,
  {
    readonly get: (path: string) => Effect.Effect<Response>
    readonly post: (path: string, body: unknown) => Effect.Effect<Response>
  }
>()("App") {}

const AppPreview = Layer.effect(App)(
  Effect.gen(function* () {
    // Wrangler passes these process variables to the Worker as bindings: a test IP_HASH_KEY
    // (production: `wrangler secret put IP_HASH_KEY`; local dev: `.dev.vars`).
    yield* Effect.sync(() => {
      process.env["CLOUDFLARE_INCLUDE_PROCESS_ENV"] = "true"
      process.env["IP_HASH_KEY"] ??= "built-app-test-ip-hash-key"
    })
    const server = yield* Effect.acquireRelease(
      Effect.promise(() => preview({ preview: { port: 0 }, logLevel: "silent" })),
      (s) => Effect.promise(() => s.close()),
    )
    const base = (server.resolvedUrls?.local[0] ?? "").replace(/\/$/, "")
    // Local Durable Object state persists between runs; a fresh documentation-range IP per run
    // keeps earlier runs' creations from counting against this one's rate limit.
    const ip = `2001:db8::${crypto.randomUUID().slice(0, 4)}`
    return {
      get: (path: string) =>
        Effect.promise(() =>
          fetch(base + path, { headers: { accept: "text/html", "sec-fetch-mode": "navigate" } }),
        ),
      post: (path: string, body: unknown) =>
        Effect.promise(() =>
          fetch(base + path, {
            method: "POST",
            headers: { "content-type": "application/json", "cf-connecting-ip": ip },
            body: JSON.stringify(body),
          }),
        ),
    }
  }),
)

const directives = (csp: string | null): Record<string, string> =>
  Object.fromEntries(
    (csp ?? "")
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0] !== "")
      .map(([name = "", ...values]) => [name, values.join(" ")]),
  )

const expectHardened = (res: Response) => {
  const csp = directives(res.headers.get("content-security-policy"))
  expect(csp["default-src"]).toBe("'self'")
  expect(csp["script-src"]).toBe("'self'")
  expect(csp["connect-src"]).toBe("'self'")
  expect(csp["frame-ancestors"]).toBe("'none'")
  expect(res.headers.get("referrer-policy")).toBe("no-referrer")
}

layer(AppPreview, { timeout: 60_000 })("built app", (app) => {
  describe.each(["/", "/s/abc123", "/how-it-works"])("page %s", (path) => {
    app.effect("serves the app with hardened headers", () =>
      Effect.gen(function* () {
        const server = yield* App
        const res = yield* server.get(path)
        const body = yield* Effect.promise(() => res.text())
        expect(res.status).toBe(200)
        expect(body).toContain('<div id="app">')
        expectHardened(res)
      }),
    )
  })

  describe.each([
    ["/", "Send secrets online"],
    ["/how-it-works", "What isn"],
  ])("prerendered page %s", (path, heading) => {
    app.effect("arrives as HTML with its own canonical link", () =>
      Effect.gen(function* () {
        const server = yield* App
        const res = yield* server.get(path)
        const body = yield* Effect.promise(() => res.text())
        expect(res.status).toBe(200)
        expect(body).toContain(heading)
        expect(body).toContain(`<link rel="canonical" href="https://secret.tonytang.dev${path}">`)
      }),
    )
  })

  app.effect("keeps Reveal pages out of search engines", () =>
    Effect.gen(function* () {
      const server = yield* App
      const res = yield* server.get("/s/abc123")
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }),
  )

  app.effect("answers /api/health with no-store and hardened headers", () =>
    Effect.gen(function* () {
      const server = yield* App
      const res = yield* server.get("/api/health")
      const body: unknown = yield* Effect.promise(() => res.json())
      expect(res.status).toBe(200)
      expect(body).toEqual({ status: "ok" })
      expect(res.headers.get("cache-control")).toBe("no-store")
      expectHardened(res)
    }),
  )

  app.effect("keeps a Secret in a Durable Object until exactly one Reveal takes it", () =>
    Effect.gen(function* () {
      const server = yield* App
      const stored = { ciphertext: "Y2lwaGVy", iv: "aXZpdml2aXZpdml2", hasPassphrase: false }
      const created = yield* server.post("/api/secrets", { ...stored, expiry: "1d" })
      const { id } = yield* Effect.promise(() => created.text()).pipe(
        Effect.flatMap(
          Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Struct({ id: Schema.String }))),
        ),
      )
      const reveals = yield* Effect.forEach(
        [1, 2, 3],
        () =>
          Effect.flatMap(server.post("/api/secrets/reveal", { id }), (res) =>
            Effect.promise(() => res.text().then((text) => ({ status: res.status, text }))),
          ),
        { concurrency: "unbounded" },
      )
      expect(reveals.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 410, 410])
      expect(reveals.find((r) => r.status === 200)?.text).toBe(JSON.stringify(stored))
    }),
  )

  app.effect("answers unknown /api/* paths with a 404, not the app shell", () =>
    Effect.gen(function* () {
      const server = yield* App
      const res = yield* server.get("/api/nope")
      const body = yield* Effect.promise(() => res.text())
      expect(res.status).toBe(404)
      expect(body).not.toContain('<div id="app">')
      expect(res.headers.get("cache-control")).toBe("no-store")
      expectHardened(res)
    }),
  )
})

describe.each(["index.html", "how-it-works.html"])("built %s", (page) => {
  const html = readFileSync(join(clientDir, page), "utf8")
  const css = readdirSync(join(clientDir, "assets"))
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(clientDir, "assets", f), "utf8"))
    .join("\n")

  // JSON-LD is a data block: browsers never run it, so script-src doesn't apply to it.
  const JSON_LD = '<script type="application/ld+json">'
  const dataBlocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)]

  it("has no inline scripts or styles", () => {
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0])
    expect(scripts.length).toBeGreaterThan(dataBlocks.length)
    for (const tag of scripts) if (tag !== JSON_LD) expect(tag).toMatch(/\ssrc="\//)
    expect(html.split(JSON_LD).length - 1).toBe(dataBlocks.length)
    expect(html).not.toMatch(/<style\b|\sstyle=/)
  })

  it("carries one block of structured data for search engines, as valid JSON", () => {
    expect(dataBlocks).toHaveLength(1)
    const parsed = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(
      dataBlocks[0]?.[1],
    )
    expect(parsed).toMatchObject({ "@context": "https://schema.org" })
  })

  it("loads every resource from its own origin", () => {
    // Links to other pages (<a>, canonical) load nothing; scripts, styles and icons do.
    const htmlRefs = [
      ...html.matchAll(/<(?:script|img)\b[^>]*\ssrc="([^"]*)"/g),
      ...html.matchAll(/<link\b(?![^>]*rel="canonical")[^>]*\shref="([^"]*)"/g),
    ].map((m) => m[1])
    expect(htmlRefs.length).toBeGreaterThan(0)
    const cssRefs = [...css.matchAll(/url\(\s*["']?([^"')]*)/g)].map((m) => m[1])
    expect(cssRefs.length).toBeGreaterThan(0)
    for (const ref of [...htmlRefs, ...cssRefs]) expect(ref).toMatch(/^\/(?!\/)/)
  })

  it("self-hosts the three brand fonts", () => {
    const fonts = readdirSync(join(clientDir, "assets")).filter((f) => f.endsWith(".woff2"))
    for (const family of ["bricolage-grotesque", "public-sans", "jetbrains-mono"]) {
      expect(fonts.some((f) => f.startsWith(family))).toBe(true)
    }
  })
})
