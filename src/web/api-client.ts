// The typed client for the shared contract, as a service so tests can wire it to the Worker.
import { Context, Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { Api } from "../shared/api.ts"

export class ApiClient extends Context.Service<ApiClient, HttpApiClient.ForApi<typeof Api>>()(
  "ApiClient",
) {
  /** Talks to `baseUrl` (the page's own origin in the browser) with `fetch`. */
  static readonly layer = (baseUrl: string): Layer.Layer<ApiClient> =>
    Layer.effect(ApiClient, HttpApiClient.make(Api, { baseUrl })).pipe(
      Layer.provide(FetchHttpClient.layer),
    )
}
