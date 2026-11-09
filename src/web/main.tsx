// Browser entry.
import "./styles.css"
import { Effect, Layer, ManagedRuntime } from "effect"
import { render } from "preact"
import { ErrorBoundary, LocationProvider, Route, Router, lazy } from "preact-iso"
import { Layout } from "./layout.tsx"
import { Home } from "./pages/home.tsx"
import { NotFound } from "./pages/not-found.tsx"
import { SecretCrypto } from "../shared/crypto.ts"
import { ApiClient } from "./api-client.ts"
import { type Run, RunContext } from "./run.ts"

const runtime = ManagedRuntime.make(
  Layer.merge(ApiClient.layer(location.origin), SecretCrypto.layer),
)
const run: Run = (effect) => runtime.runPromise(Effect.result(effect))

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

const root = document.getElementById("app")
if (root !== null) render(<App />, root)
