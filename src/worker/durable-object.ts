// The only module allowed to use Cloudflare runtime types (see AGENTS.md).
// One SecretObject per Secret, named by its ID (ADR-0002). SQLite-backed, so `ctx.storage.kv` is
// synchronous: `take` reads and deletes with no `await` in between, so no other request can
// interleave and at most one Reveal ever gets the Secret.
import { DurableObject, env } from "cloudflare:workers"
import { Effect, Layer } from "effect"
import { SecretGone, type StoredSecret } from "../shared/api.ts"
import { SecretStore, newSecretId } from "./secret-store.ts"

interface Entry {
  readonly secret: StoredSecret
  readonly expiresAt: number
}

const KEY = "secret"

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

declare global {
  // oxlint-disable-next-line typescript/no-namespace -- workers-types declares bindings by merging into Cloudflare.Env
  namespace Cloudflare {
    interface Env {
      readonly SECRETS: DurableObjectNamespace<SecretObject>
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
