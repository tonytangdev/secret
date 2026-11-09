// The only module allowed to use Cloudflare runtime types (see AGENTS.md).
// One SecretObject per Secret, named by its ID (ADR-0002). SQLite-backed, so `ctx.storage.kv` is
// synchronous: `take` reads and deletes with no `await` in between, so no other request can
// interleave and at most one Reveal ever gets the Secret. An alarm at the Expiry Burns an
// unrevealed Secret; until it fires, `take` treats a past-Expiry record as gone. Either way an
// unrevealed Secret is counted `expired` exactly once (ADR-0005).
import { DurableObject, env } from "cloudflare:workers"
import { Clock, Effect, Layer } from "effect"
import { SecretGone, type StoredSecret } from "../shared/api.ts"
import { HOUR } from "../shared/expiry.ts"
import { CREATES_PER_HOUR } from "../shared/limits.ts"
import { ClientKey, CreateRateLimit, type QuotaWindow, countCreation } from "./create-rate-limit.ts"
import { type Entry, SecretStore, newSecretId } from "./secret-store.ts"
import { Usage, usageDataPoint } from "./usage.ts"

const ENTRY_KEY = "secret"
const QUOTA_KEY = "window"

export class SecretObject extends DurableObject {
  put(entry: Entry): Promise<void> {
    this.ctx.storage.kv.put(ENTRY_KEY, entry)
    return this.ctx.storage.setAlarm(entry.expiresAt)
  }

  take(): StoredSecret | null {
    const entry = this.ctx.storage.kv.get<Entry>(ENTRY_KEY)
    if (entry === undefined) return null
    this.ctx.storage.kv.delete(ENTRY_KEY)
    if (entry.expiresAt > Date.now()) return entry.secret
    env.USAGE.writeDataPoint(usageDataPoint("expired"))
    return null
  }

  /** The Expiry passed unrevealed: Burn. `deleteAll` clears the alarm too. */
  override alarm(): Promise<void> {
    if (this.ctx.storage.kv.get<Entry>(ENTRY_KEY) !== undefined) {
      env.USAGE.writeDataPoint(usageDataPoint("expired"))
    }
    return this.ctx.storage.deleteAll()
  }
}

/**
 * One CreateQuota per client, named by the hash of its IP (never the IP). `admit` is synchronous,
 * so concurrent creations from one client are counted one at a time. An alarm at the end of the
 * window deletes the count, so nothing about a client outlives the hour.
 */
export class CreateQuota extends DurableObject {
  admit(now: number, limit: number): boolean {
    const before = this.ctx.storage.kv.get<QuotaWindow>(QUOTA_KEY)
    const { allowed, window } = countCreation(before, now, limit)
    this.ctx.storage.kv.put(QUOTA_KEY, window)
    if (window.start !== before?.start) void this.ctx.storage.setAlarm(window.start + HOUR)
    return allowed
  }

  override alarm(): Promise<void> {
    return this.ctx.storage.deleteAll()
  }
}

declare global {
  // oxlint-disable-next-line typescript/no-namespace -- workers-types declares bindings by merging into Cloudflare.Env
  namespace Cloudflare {
    interface Env {
      readonly SECRETS: DurableObjectNamespace<SecretObject>
      readonly CREATE_QUOTA: DurableObjectNamespace<CreateQuota>
      readonly USAGE: AnalyticsEngineDataset
      /** HMAC key for client IPs: `wrangler secret put IP_HASH_KEY` (`.dev.vars` locally). */
      readonly IP_HASH_KEY?: string
    }
  }
}

const secretObject = (id: string) => env.SECRETS.getByName(id)

export const UsageAnalyticsEngine: Layer.Layer<Usage> = Usage.layer({
  writeDataPoint: (point) => {
    env.USAGE.writeDataPoint(point)
  },
})

export const SecretStoreDurableObject: Layer.Layer<SecretStore> = Layer.succeed(
  SecretStore,
  SecretStore.of({
    put: (secret, expiresAt) =>
      Effect.gen(function* () {
        const id = yield* newSecretId
        yield* Effect.promise(() => secretObject(id).put({ secret, expiresAt }))
        return id
      }),
    take: (id) =>
      Effect.gen(function* () {
        const secret = yield* Effect.promise(() => secretObject(id).take())
        if (secret === null) return yield* new SecretGone()
        return secret
      }),
  }),
)

export const CreateRateLimitDurableObject: Layer.Layer<CreateRateLimit> = Layer.succeed(
  CreateRateLimit,
  CreateRateLimit.of({
    admit: (key) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        return yield* Effect.promise(() =>
          env.CREATE_QUOTA.getByName(key).admit(now, CREATES_PER_HOUR),
        )
      }),
  }),
)

const IpHashKeyMissing = Layer.succeed(
  ClientKey,
  ClientKey.of({ of: () => Effect.die(new Error("IP_HASH_KEY is not set")) }),
)

/** ClientKey under the IP_HASH_KEY secret. If it's unset, creating a Secret fails: no fallback. */
export const ClientKeyFromEnv: Layer.Layer<ClientKey> = Layer.unwrap(
  Effect.sync(() =>
    env.IP_HASH_KEY === undefined || env.IP_HASH_KEY === ""
      ? IpHashKeyMissing
      : ClientKey.hmac(env.IP_HASH_KEY),
  ),
)
