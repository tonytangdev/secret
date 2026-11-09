// Runs against the built app (`vite build` first; `npm test` does it). Static assets never reach
// the Worker, so their headers come from the generated `_headers` file and only a real asset
// server shows whether they are applied. `vite preview` boots the build in workerd.
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, layer } from "@effect/vitest"
import { Context, Effect, Layer } from "effect"
import { preview } from "vite"

const clientDir = join(import.meta.dirname, "../dist/client")

class App extends Context.Service<
  App,
  { readonly get: (path: string) => Effect.Effect<Response> }
>()("App") {}

const AppPreview = Layer.effect(App)(
  Effect.gen(function* () {
    const server = yield* Effect.acquireRelease(
      Effect.promise(() => preview({ preview: { port: 0 }, logLevel: "silent" })),
      (s) => Effect.promise(() => s.close()),
    )
    const base = (server.resolvedUrls?.local[0] ?? "").replace(/\/$/, "")
    return {
      get: (path: string) =>
        Effect.promise(() =>
          fetch(base + path, { headers: { accept: "text/html", "sec-fetch-mode": "navigate" } }),
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
    app.effect("serves the app shell with hardened headers", () =>
      Effect.gen(function* () {
        const server = yield* App
        const res = yield* server.get(path)
        const body = yield* Effect.promise(() => res.text())
        expect(res.status).toBe(200)
        expect(body).toContain('<div id="app"></div>')
        expectHardened(res)
      }),
    )
  })

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

describe("built files", () => {
  const html = readFileSync(join(clientDir, "index.html"), "utf8")
  const css = readdirSync(join(clientDir, "assets"))
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(clientDir, "assets", f), "utf8"))
    .join("\n")

  it("has no inline scripts or styles in index.html", () => {
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0])
    expect(scripts.length).toBeGreaterThan(0)
    for (const tag of scripts) expect(tag).toMatch(/\ssrc="\//)
    expect(html).not.toMatch(/<style\b|\sstyle=/)
  })

  it("loads every resource from its own origin", () => {
    const htmlRefs = [...html.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1])
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
