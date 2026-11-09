// In-memory SecretStore for tests. Ref.modify makes take's read-and-Burn one atomic step. Expiry
// is read from Effect's Clock, so TestClock drives it.
import { Clock, Effect, Layer, Option, Ref } from "effect"
import { SecretGone, type StoredSecret } from "../shared/api.ts"
import { SecretStore, newSecretId } from "./secret-store.ts"

interface Entry {
  readonly secret: StoredSecret
  readonly expiresAt: number
}

export const SecretStoreMemory: Layer.Layer<SecretStore> = Layer.effect(
  SecretStore,
  Effect.gen(function* () {
    const entries = yield* Ref.make<ReadonlyMap<string, Entry>>(new Map())
    return SecretStore.of({
      put: (secret, expiresAt) =>
        Effect.gen(function* () {
          const id = yield* newSecretId
          yield* Ref.update(entries, (m) => new Map(m).set(id, { secret, expiresAt }))
          return id
        }),
      take: (id) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const found = yield* Ref.modify(entries, (m) => {
            const next = new Map(m)
            next.delete(id)
            return [Option.fromNullishOr(m.get(id)), next] as const
          })
          if (Option.isNone(found) || found.value.expiresAt <= now) return yield* new SecretGone()
          return found.value.secret
        }),
    })
  }),
)
