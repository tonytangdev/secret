// Worker entry. Cloudflare routes only /api/* here (`run_worker_first` in wrangler.jsonc); every
// other path is a static asset or the single-page-application fallback.
import { HttpRouter } from "effect/http"
import { Layer } from "effect"
import { ApiLive, webHandlerOptions } from "./api.ts"
import { SecretStoreDurableObject } from "./durable-object.ts"

export { SecretObject } from "./durable-object.ts"

// Built once per isolate; bindings come from `env` in cloudflare:workers, not from the request.
const app = HttpRouter.toWebHandler(
  ApiLive.pipe(Layer.provide(SecretStoreDurableObject)),
  webHandlerOptions,
)

export default {
  fetch: (request: Request): Promise<Response> => app.handler(request),
}
