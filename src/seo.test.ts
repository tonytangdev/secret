// What search engines read in each prerendered page's <head>: the JSON-LD structured data.
import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { headElements } from "./web/seo.ts"

const Graph = Schema.fromJsonString(
  Schema.Struct({
    "@context": Schema.Literal("https://schema.org"),
    "@graph": Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  }),
)

const graphOf = (path: string) => {
  const blocks = headElements(path).filter((e) => e.type === "script")
  expect(blocks).toHaveLength(1)
  const [block] = blocks
  expect(block?.props).toEqual({ type: "application/ld+json" })
  return Schema.decodeUnknownSync(Graph)(block?.children)["@graph"]
}

const node = (path: string, type: string) => graphOf(path).find((n) => n["@type"] === type)

describe("structured data", () => {
  it("names the site secret, so it isn't shown under the parent domain's name", () => {
    expect(node("/", "WebSite")).toMatchObject({
      name: "secret",
      url: "https://secret.tonytang.dev/",
    })
  })

  it("describes the main page as a free browser app by Tony Tang, with its source", () => {
    expect(node("/", "WebApplication")).toMatchObject({
      name: "secret",
      url: "https://secret.tonytang.dev/",
      description: headElements("/").find((e) => e.props["name"] === "description")?.props[
        "content"
      ],
      applicationCategory: "SecurityApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: { "@type": "Person", name: "Tony Tang", url: "https://tonytang.dev/" },
      sameAs: "https://github.com/tonytangdev/secret",
    })
    expect(JSON.stringify(graphOf("/"))).not.toMatch(/"(aggregateRating|review)"/)
  })

  it("describes /how-it-works as an article under the main page", () => {
    expect(node("/how-it-works", "TechArticle")).toMatchObject({
      headline: "How it works",
      url: "https://secret.tonytang.dev/how-it-works",
      author: { "@type": "Person", name: "Tony Tang" },
    })
    expect(node("/how-it-works", "BreadcrumbList")).toMatchObject({
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "secret", item: "https://secret.tonytang.dev/" },
        {
          "@type": "ListItem",
          position: 2,
          name: "How it works",
          item: "https://secret.tonytang.dev/how-it-works",
        },
      ],
    })
  })

  it("can't close its <script> block early", () => {
    // The prerenderer writes the block's text as is.
    for (const path of ["/", "/how-it-works"]) {
      for (const e of headElements(path)) expect(e.children ?? "").not.toContain("<")
    }
  })

  it("is left out of pages that aren't prerendered", () => {
    expect(headElements("/s/abc").filter((e) => e.type === "script")).toEqual([])
  })
})
