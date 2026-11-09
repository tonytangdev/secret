// Browser entry, and the build's prerender entry (`prerender` below runs in Node at build time).
import "./styles.css"
import { Effect, Layer, ManagedRuntime } from "effect"
import { hydrate, render } from "preact"
import { ErrorBoundary, LocationProvider, Route, Router, lazy } from "preact-iso"
import { Layout } from "./layout.tsx"
import { Home } from "./pages/home.tsx"
import { NotFound } from "./pages/not-found.tsx"
import { SecretCrypto } from "../shared/crypto.ts"
import { ApiClient } from "./api-client.ts"
import { type Run, RunContext } from "./run.ts"
import { headElements, pageFor } from "./seo.ts"

// Built on first use: prerendering has no `location.origin`, and renders without running anything.
let runtime: ManagedRuntime.ManagedRuntime<ApiClient | SecretCrypto, never> | undefined
const run: Run = (effect) => {
  runtime ??= ManagedRuntime.make(Layer.merge(ApiClient.layer(location.origin), SecretCrypto.layer))
  return runtime.runPromise(Effect.result(effect))
}

const Reveal = lazy(() => import("./pages/reveal.tsx").then((m) => m.Reveal))
const HowItWorks = lazy(() => import("./pages/how-it-works.tsx").then((m) => m.HowItWorks))

const App = () => (
  <RunContext.Provider value={run}>
    <LocationProvider>
      <ErrorBoundary>
        <Layout>
          <Router>
            <Route path="/" component={Home} />
            <Route path="/s/:id" component={Reveal} />
            <Route path="/how-it-works" component={HowItWorks} />
            <Route default component={NotFound} />
          </Router>
        </Layout>
      </ErrorBoundary>
    </LocationProvider>
  </RunContext.Provider>
)

/** Called by the build for each page (vite-prerender-plugin): its HTML and its <head>. */
export const prerender = async ({ url }: { readonly url: string }) => {
  const { default: renderPage } = await import("preact-iso/prerender")
  const { html, links } = await renderPage(<App />)
  return {
    html,
    links,
    head: { lang: "en", title: pageFor(url).title, elements: new Set(headElements(url)) },
  }
}

if (typeof document !== "undefined") {
  const root = document.getElementById("app")
  if (root !== null) {
    // Prerendered pages carry their own canonical link. Any other path (a Reveal, a 404) got the
    // main page's HTML as the SPA fallback: throw it away rather than hydrate the wrong page.
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical !== null && new URL(canonical.href).pathname === location.pathname) {
      hydrate(<App />, root)
    } else {
      root.replaceChildren()
      render(<App />, root)
    }
    document.documentElement.classList.remove("app-pending")
  }
}
