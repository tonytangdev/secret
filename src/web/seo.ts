// What search engines and link previews see for each page. The build prerenders these pages
// (main.tsx `prerender`) with this head and lists them in sitemap.xml (vite.config.ts); the app
// updates title and description on navigation (layout.tsx). public/boot.js keeps its own copy of
// the paths: update it when a page is added here. No imports: vite.config.ts loads this in Node.

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

type HeadElement = { readonly type: "meta" | "link"; readonly props: Record<string, string> }

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
  ]
}
