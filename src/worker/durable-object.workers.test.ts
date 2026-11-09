// Runs inside workerd (Cloudflare Vitest pool) against real SecretObject Durable Objects.
// Time there is the real clock, so these use `it.live`.
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { assert, describe, it } from "@effect/vitest"
import { Clock, Effect } from "effect"
import { secretStoreContract } from "../testing/secret-store-contract.ts"
import { SecretStoreDurableObject } from "./durable-object.ts"
import { SecretStore } from "./secret-store.ts"

secretStoreContract("Durable Object", SecretStoreDurableObject, it.live)

describe("SecretObject alarm", () => {
  it.live("is set at the Expiry, and when it fires the unrevealed Secret is Burned", () =>
    Effect.gen(function* () {
      const store = yield* SecretStore
      const expiresAt = (yield* Clock.currentTimeMillis) + 3_600_000
      const id = yield* store.put(
        { ciphertext: "eA", iv: "aXZpdml2aXZpdml2", hasPassphrase: false },
        expiresAt,
      )
      const stub = env.SECRETS.getByName(id)
      const alarm = yield* Effect.promise(() =>
        runInDurableObject(stub, (_object, state) => state.storage.getAlarm()),
      )
      assert.strictEqual(alarm, expiresAt)
      assert.isTrue(yield* Effect.promise(() => runDurableObjectAlarm(stub)))
      assert.strictEqual((yield* Effect.flip(store.take(id)))._tag, "SecretGone")
    }).pipe(Effect.provide(SecretStoreDurableObject)),
  )
})
