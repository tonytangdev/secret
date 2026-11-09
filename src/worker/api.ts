// The Worker's implementation of the shared contract. Long-lived services (SecretStore) are taken
// in the group build functions, so handlers carry no per-request requirements.
import { Clock, Effect, Layer } from "effect"
import { HttpEffect, HttpRouter, HttpServer, HttpServerResponse } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../shared/api.ts"
import { API_HEADERS } from "../shared/security-headers.ts"
import { expiryMillis } from "../shared/expiry.ts"
import { SecretStore } from "./secret-store.ts"
import { Usage } from "./usage.ts"

const SecretsLive = HttpApiBuilder.group(Api, "secrets", (handlers) =>
  Effect.gen(function* () {
    const store = yield* SecretStore
    const usage = yield* Usage
    return handlers
      .handle("create", ({ payload: { expiry, ...secret } }) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const id = yield* store.put(secret, now + expiryMillis(expiry))
          yield* usage.record("created")
          return { id }
        }),
      )
      .handle("reveal", ({ payload }) =>
        store.take(payload.id).pipe(Effect.tap(() => usage.record("revealed"))),
      )
  }),
)

const HealthLive = HttpApiBuilder.group(Api, "health", (handlers) =>
  Effect.succeed(handlers.handle("check", () => Effect.succeed({ status: "ok" as const }))),
)

/** Every response, decode failures and router 404s included, gets the API headers. */
const ApiHeaders = HttpRouter.middleware(
  (app) =>
    Effect.andThen(
      HttpEffect.appendPreResponseHandler((_request, response) =>
        Effect.succeed(HttpServerResponse.setHeaders(response, API_HEADERS)),
      ),
      app,
    ),
  { global: true },
)

/** The API routes; needs a SecretStore and Usage. Serve with `HttpRouter.toWebHandler(ApiLive, webHandlerOptions)`. */
export const ApiLive = Layer.mergeAll(
  HttpApiBuilder.layer(Api).pipe(Layer.provide([SecretsLive, HealthLive])),
  ApiHeaders,
).pipe(Layer.provide(HttpServer.layerServices))

// disableLogger keeps request paths (and anything in them) out of logs.
export const webHandlerOptions = { disableLogger: true } as const
