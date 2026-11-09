// The security explainer: the three steps on the main page and /how-it-works. Rendered to HTML
// in Node; the copy itself is checked by reading it against the code.
import { describe, expect, it } from "@effect/vitest"
import { h } from "preact"
import { renderToString } from "preact-render-to-string"
import { Layout } from "./web/layout.tsx"
import { RunContext } from "./web/run.ts"
import { Home } from "./web/pages/home.tsx"
import { HowItWorks } from "./web/pages/how-it-works.tsx"

const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")

describe("main page", () => {
  // Rendering runs nothing; a runner that refuses proves it.
  const html = renderToString(
    h(
      RunContext.Provider,
      { value: () => Promise.reject(new Error("not in a test")) },
      h(Home, {}),
    ),
  )

  it("explains the security in three steps, in order", () => {
    const page = text(html)
    const steps = [
      "Encrypted in your browser",
      "Key never leaves the link",
      "Deleted after one read",
    ].map((step) => page.indexOf(step))
    expect(steps.every((i) => i >= 0)).toBe(true)
    expect([...steps].sort((a, b) => a - b)).toEqual(steps)
  })

  it("links to /how-it-works", () => {
    expect(html).toContain('href="/how-it-works"')
  })
})

describe("/how-it-works", () => {
  const html = renderToString(h(HowItWorks, {}))
  const page = text(html)

  it.each([
    "What's protected",
    "What isn't",
    "The encryption",
    "Reveal, then Burn",
    "Expiry",
    "No third-party code",
    "What I keep",
    "Check it yourself",
  ])("has a %s section", (heading) => {
    expect(html).toMatch(new RegExp(`<h2[^>]*>${heading.replace(/'/g, "(?:'|&#39;)")}`))
  })

  it.each([
    "AES-256-GCM",
    "256-bit Link key",
    "96-bit IV",
    "600,000",
    "PBKDF2",
    "HKDF",
    "HMAC-SHA256",
    "128-bit salt",
    "Secret IDs are 128 random bits",
    "You pick 1 hour, 1 day (the default) or 7 days.",
    "Up to 10 KB of text",
    "20 Secrets per hour per IP address",
  ])("states %s", (fact) => {
    expect(page).toContain(fact)
  })

  it("names what isn't protected", () => {
    expect(page).toMatch(/compromised|malware/i)
    expect(page).toMatch(/without a Passphrase/)
    expect(page).toMatch(/copies the Secret/)
  })

  it("links to the public source and its AGPL-3.0 license", () => {
    expect(html).toContain('href="https://github.com/tonytangdev/secret"')
    expect(html).toContain('href="https://github.com/tonytangdev/secret/blob/main/LICENSE"')
    expect(page).toContain("AGPL-3.0")
  })
})

describe("layout", () => {
  it("links every page to /how-it-works and back to tonytang.dev/apps", () => {
    const html = renderToString(h(Layout, { children: null }))
    expect(html).toContain('href="/how-it-works"')
    expect(html).toContain('href="https://tonytang.dev/apps"')
  })
})
