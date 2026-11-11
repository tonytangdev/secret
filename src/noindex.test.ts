// The not-found page arrives as the SPA fallback (status 200, the main page's HTML), so it tells
// search engines itself not to index it, and stops saying so when the app navigates away.
import { describe, expect, it } from "@effect/vitest"
import { noindex } from "./web/noindex.ts"

const fakeDocument = () => {
  const head: Array<{ name: string; content: string }> = []
  const document = {
    head: { append: (meta: (typeof head)[number]) => void head.push(meta) },
    createElement: (_tag: "meta") => {
      const meta = {
        name: "",
        content: "",
        remove: () => void head.splice(head.indexOf(meta), 1),
      }
      return meta
    },
  }
  return { document, head }
}

describe("noindex", () => {
  it("adds a robots noindex meta tag to the head", () => {
    const { document, head } = fakeDocument()
    noindex(document)
    expect(head).toMatchObject([{ name: "robots", content: "noindex" }])
  })

  it("removes it again on cleanup", () => {
    const { document, head } = fakeDocument()
    const cleanup = noindex(document)
    cleanup()
    expect(head).toEqual([])
  })
})
