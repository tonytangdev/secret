// What search engines and link previews see for each page, structured data (JSON-LD) included.
// The build prerenders these pages (main.tsx `prerender`) with this head and lists them in
// sitemap.xml (vite.config.ts); the app updates title and description on navigation
// (layout.tsx). public/boot.js keeps its own copy of the paths: update it when a page is added
// here. No imports: vite.config.ts loads this in Node.

export const ORIGIN = "https://secret.tonytang.dev"

interface Page {
  readonly title: string
  readonly description: string
}

export const PAGES: Readonly<Record<string, Page>> = {
  "/": {
    title: "Send secrets online with one-time encrypted links · secret",
    description:
      "Send a password, API key or any secret online through a link that works once. Encrypted in your browser, deleted after one read. Free, no sign-up.",
  },
  "/how-it-works": {
    title: "How it works: end-to-end encrypted one-time links · secret",
    description:
      "How secret.tonytang.dev encrypts your secret in the browser, keeps the key out of my server, and burns it after one read. What it protects, and what it can't.",
  },
}

const FALLBACK: Page = {
  title: "secret · tonytang.dev",
  description: PAGES["/"]?.description ?? "",
}

export const pageFor = (path: string): Page => PAGES[path] ?? FALLBACK

const SITE = `${ORIGIN}/`
const AUTHOR = { "@type": "Person", name: "Tony Tang", url: "https://tonytang.dev/" }

// schema.org nodes for each prerendered page, from facts the pages state.
const STRUCTURED_DATA: Readonly<Record<string, ReadonlyArray<object>>> = {
  "/": [
    // Gives Google a site name for this subdomain instead of tonytang.dev's.
    {
      "@type": "WebSite",
      "@id": `${SITE}#website`,
      name: "secret",
      alternateName: "secret.tonytang.dev",
      url: SITE,
    },
    {
      "@type": "WebApplication",
      name: "secret",
      description: PAGES["/"]?.description,
      url: SITE,
      applicationCategory: "SecurityApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: AUTHOR,
      license: "https://github.com/tonytangdev/secret/blob/main/LICENSE",
      sameAs: "https://github.com/tonytangdev/secret",
    },
  ],
  "/how-it-works": [
    {
      "@type": "TechArticle",
      headline: "How it works",
      description: PAGES["/how-it-works"]?.description,
      url: `${ORIGIN}/how-it-works`,
      author: AUTHOR,
      isPartOf: { "@id": `${SITE}#website` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "secret", item: SITE },
        { "@type": "ListItem", position: 2, name: "How it works", item: `${ORIGIN}/how-it-works` },
      ],
    },
  ],
}

type HeadElement = {
  readonly type: "meta" | "link" | "script"
  readonly props: Record<string, string>
  readonly children?: string
}

/**
 * A JSON-LD data block. Browsers never run it, so the CSP's script-src doesn't apply. The
 * prerenderer writes the text as is: escaping "<" keeps it from closing the <script> early.
 */
const jsonLd = (path: string): ReadonlyArray<HeadElement> => {
  const graph = STRUCTURED_DATA[path]
  if (graph === undefined) return []
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph })
  return [
    {
      type: "script",
      props: { type: "application/ld+json" },
      children: json.replace(/</g, "\\u003c"),
    },
  ]
}

/** Per-page <head> elements for the prerendered HTML; index.html holds the shared ones. */
export const headElements = (path: string): ReadonlyArray<HeadElement> => {
  const page = pageFor(path)
  const url = `${ORIGIN}${path}`
  return [
    { type: "meta", props: { name: "description", content: page.description } },
    { type: "link", props: { rel: "canonical", href: url } },
    { type: "meta", props: { property: "og:url", content: url } },
    { type: "meta", props: { property: "og:title", content: page.title } },
    { type: "meta", props: { property: "og:description", content: page.description } },
    { type: "meta", props: { name: "twitter:title", content: page.title } },
    { type: "meta", props: { name: "twitter:description", content: page.description } },
    ...jsonLd(path),
  ]
}
