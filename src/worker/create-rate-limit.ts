// CreateRateLimit: about 20 creations per hour per client. Cloudflare's rate-limiting binding only
// counts per 10 s or 60 s (spec amendment 1), so this is a fixed one-hour window per client,
// counted in memory (tests) or in a Durable Object (production). Clients are known only by an
// HMAC of their IP under the IP_HASH_KEY Worker secret; the raw IP is never stored, and without
// the secret the hash can't be reversed by hashing every possible IP.
import { Clock, Context, Effect, Layer, Ref } from "effect"
import { Base64Url } from "effect/encoding"

export const CREATES_PER_HOUR = 20
export const WINDOW_MILLIS = 60 * 60 * 1000

/** One client's count in its current window. */
export interface QuotaWindow {
  readonly start: number
  readonly count: number
}

/** Counts one creation at `now`; `allowed` is false once the window's limit is used up. */
export const countCreation = (
  window: QuotaWindow | undefined,
  now: number,
  limit: number,
): { readonly allowed: boolean; readonly window: QuotaWindow } => {
  const current =
    window === undefined || now >= window.start + WINDOW_MILLIS ? { start: now, count: 0 } : window
  if (current.count >= limit) return { allowed: false, window: current }
  return { allowed: true, window: { start: current.start, count: current.count + 1 } }
}

export class CreateRateLimit extends Context.Service<
  CreateRateLimit,
  {
    /** Counts a creation by `clientKey` (a hash, never an IP); false if over the limit. */
    readonly admit: (clientKey: string) => Effect.Effect<boolean>
  }
>()("CreateRateLimit") {}

/** The only form in which a client is known: HMAC-SHA256(IP_HASH_KEY, IP), base64url. */
export class ClientKey extends Context.Service<
  ClientKey,
  { readonly of: (ip: string) => Effect.Effect<string> }
>()("ClientKey") {
  /** Keys clients with `ipHashKey`, the IP_HASH_KEY Worker secret (or a test value). */
  static readonly hmac = (ipHashKey: string): Layer.Layer<ClientKey> =>
    Layer.effect(
      ClientKey,
      Effect.gen(function* () {
        const key = yield* Effect.promise(() =>
          crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(ipHashKey),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          ),
        )
        return ClientKey.of({
          of: (ip) =>
            Effect.promise(() =>
              crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip)),
            ).pipe(Effect.map((mac) => Base64Url.encode(new Uint8Array(mac)))),
        })
      }),
    )
}

/** In-memory CreateRateLimit, driven by Effect's Clock. */
export const CreateRateLimitMemory = (
  limit: number = CREATES_PER_HOUR,
): Layer.Layer<CreateRateLimit> =>
  Layer.effect(
    CreateRateLimit,
    Effect.gen(function* () {
      const windows = yield* Ref.make<ReadonlyMap<string, QuotaWindow>>(new Map())
      return CreateRateLimit.of({
        admit: (key) =>
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis
            return yield* Ref.modify(windows, (m) => {
              const { allowed, window } = countCreation(m.get(key), now, limit)
              return [allowed, new Map(m).set(key, window)] as const
            })
          }),
      })
    }),
  )
