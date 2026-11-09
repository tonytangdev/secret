// In-process test harness (spec "Testing Decisions", primary seam). The browser program's typed
// client gets a `fetch` that calls the Worker's real web handler directly, so every request
// crosses a genuine HTTP boundary (Web Request/Response) without a network. The server runs on the
// test fiber's services, so TestClock drives server time too.
//
// Extend by adding options (e.g. a different SecretStore layer, a test rate limiter) rather than
// a second harness.
import { Context, Effect, Layer, Ref } from "effect"
import { FetchHttpClient, HttpRouter } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { Api } from "../shared/api.ts"
import { SecretCrypto } from "../shared/crypto.ts"
import { ApiClient } from "../web/api-client.ts"
import { ApiLive, webHandlerOptions } from "../worker/api.ts"
import { type CreateRateLimit, CreateRateLimitMemory } from "../worker/create-rate-limit.ts"
import type { SecretStore } from "../worker/secret-store.ts"
import { SecretStoreMemory } from "../worker/secret-store-memory.ts"

/** A request as the server received it. */
export interface WireRequest {
  readonly method: string
  readonly url: string
  readonly body: string
}

export interface HarnessOptions {
  readonly store?: Layer.Layer<SecretStore>
  /** Defaults to the in-memory limiter at the production limit. */
  readonly rateLimit?: Layer.Layer<CreateRateLimit>
}

const BASE_URL = "http://secret.test"

export class Harness extends Context.Service<
  Harness,
  {
    /** Every request the server has received so far, in order. */
    readonly requests: Effect.Effect<ReadonlyArray<WireRequest>>
    /** Sends a raw request to the server, bypassing the typed client. Path is relative. */
    readonly fetch: (path: string, init?: RequestInit) => Effect.Effect<Response>
  }
>()("Harness") {
  /** Provides Harness, ApiClient and SecretCrypto. */
  static readonly layer = (
    options: HarnessOptions = {},
  ): Layer.Layer<Harness | ApiClient | SecretCrypto> => {
    const harness = Layer.effectContext(
      Effect.gen(function* () {
        const testContext = yield* Effect.context()
        const server = yield* Effect.acquireRelease(
          Effect.sync(() =>
            HttpRouter.toWebHandler(
              ApiLive.pipe(
                Layer.provide(options.store ?? SecretStoreMemory),
                Layer.provide(options.rateLimit ?? CreateRateLimitMemory()),
                Layer.provide(Layer.succeedContext(testContext)),
              ),
              webHandlerOptions,
            ),
          ),
          (s) => Effect.promise(() => s.dispose()),
        )
        const log = yield* Ref.make<ReadonlyArray<WireRequest>>([])
        const send = (request: Request) =>
          Effect.gen(function* () {
            const body = yield* Effect.promise(() => request.clone().text())
            yield* Ref.update(log, (xs) => [
              ...xs,
              { method: request.method, url: request.url, body },
            ])
            return yield* Effect.promise(() => server.handler(request))
          })
        const fakeFetch: typeof globalThis.fetch = (input, init) =>
          Effect.runPromiseWith(testContext)(send(new Request(input, init)))
        const client = yield* HttpApiClient.make(Api, { baseUrl: BASE_URL }).pipe(
          Effect.provide(FetchHttpClient.layer),
          Effect.provideService(FetchHttpClient.Fetch, fakeFetch),
        )
        return Context.make(ApiClient, client).pipe(
          Context.add(
            Harness,
            Harness.of({
              requests: Ref.get(log),
              fetch: (path, init) => send(new Request(BASE_URL + path, init)),
            }),
          ),
        )
      }),
    )
    return Layer.merge(harness, SecretCrypto.layer)
  }
}
