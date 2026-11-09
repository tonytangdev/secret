// Browser entry.
import "./styles.css"
import { render } from "preact"
import { ErrorBoundary, LocationProvider, Route, Router, lazy } from "preact-iso"
import { Layout } from "./layout.tsx"
import { Home } from "./pages/home.tsx"
import { NotFound } from "./pages/not-found.tsx"

const Reveal = lazy(() => import("./pages/reveal.tsx").then((m) => m.Reveal))
const HowItWorks = lazy(() => import("./pages/how-it-works.tsx").then((m) => m.HowItWorks))

const App = () => (
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
)

const root = document.getElementById("app")
if (root !== null) render(<App />, root)
