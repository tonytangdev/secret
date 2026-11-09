// The only module allowed to use Cloudflare runtime types (see AGENTS.md).
// One SecretObject per Secret, named by its ID (ADR-0002). SQLite-backed, so `ctx.storage.kv` is
// synchronous: `take` reads and deletes with no `await` in between, so no other request can
// interleave and at most one Reveal ever gets the Secret.
import { DurableObject, env } from "cloudflare:workers"
import { Clock, Effect, Layer } from "effect"
import { SecretGone, type StoredSecret } from "../shared/api.ts"
import {
  CreateRateLimit,
  CREATES_PER_HOUR,
  type QuotaWindow,
  WINDOW_MILLIS,
  countCreation,
} from "./create-rate-limit.ts"
import { SecretStore, newSecretId } from "./secret-store.ts"

interface Entry {
  readonly secret: StoredSecret
  readonly expiresAt: number
}

const KEY = "secret"
const QUOTA_KEY = "window"

export class SecretObject extends DurableObject {
  put(entry: Entry): void {
    this.ctx.storage.kv.put(KEY, entry)
  }

  take(): StoredSecret | null {
    const entry = this.ctx.storage.kv.get<Entry>(KEY)
    if (entry === undefined) return null
    this.ctx.storage.kv.delete(KEY)
    return entry.secret
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
    if (window.start !== before?.start) void this.ctx.storage.setAlarm(window.start + WINDOW_MILLIS)
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
    }
  }
}

const secretObject = (id: string) => env.SECRETS.getByName(id)

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
