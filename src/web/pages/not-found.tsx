import { useEffect } from "preact/hooks"
import { noindex } from "../noindex.ts"

export const NotFound = () => {
  // Unknown paths get the SPA fallback with status 200: keep them out of search results.
  useEffect(() => noindex<HTMLMetaElement>(document), [])
  return (
    <section>
      <h1 class="text-headline text-ink-strong">Nothing here.</h1>
      <p class="mt-md text-body">
        <a class="text-accent-strong underline" href="/">
          Back to the start
        </a>
      </p>
    </section>
  )
}
