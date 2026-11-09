// Runs inside workerd (Cloudflare Vitest pool) against real SecretObject Durable Objects.
// Time there is the real clock, so these use `it.live`.
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { assert, describe, it } from "@effect/vitest"
import { afterEach, vi } from "vitest"
import { Clock, Effect } from "effect"
import { secretStoreContract } from "../testing/secret-store-contract.ts"
import { SecretStoreDurableObject } from "./durable-object.ts"
import { SecretStore } from "./secret-store.ts"

const secret = { ciphertext: "eA", iv: "aXZpdml2aXZpdml2", hasPassphrase: false }
const HOUR = 3_600_000

secretStoreContract("Durable Object", SecretStoreDurableObject, it.live)

describe("SecretObject alarm", () => {
  it.live("is set at the Expiry, and when it fires the unrevealed Secret is Burned", () =>
    Effect.gen(function* () {
      const store = yield* SecretStore
      const expiresAt = (yield* Clock.currentTimeMillis) + HOUR
      const id = yield* store.put(secret, expiresAt)
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

describe("SecretObject usage counts", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })
  const written = () => vi.spyOn(env.USAGE, "writeDataPoint")

  it.live("the alarm Burning an unrevealed Secret records `expired`, with no ID", () =>
    Effect.gen(function* () {
      const spy = written()
      const id = yield* (yield* SecretStore).put(secret, (yield* Clock.currentTimeMillis) + HOUR)
      yield* Effect.promise(() => runDurableObjectAlarm(env.SECRETS.getByName(id)))
      assert.deepStrictEqual(spy.mock.calls, [[{ blobs: ["expired"], indexes: ["expired"] }]])
    }).pipe(Effect.provide(SecretStoreDurableObject)),
  )

  it.live("the alarm after a Reveal records nothing", () =>
    Effect.gen(function* () {
      const spy = written()
      const store = yield* SecretStore
      const id = yield* store.put(secret, (yield* Clock.currentTimeMillis) + HOUR)
      yield* store.take(id)
      yield* Effect.promise(() => runDurableObjectAlarm(env.SECRETS.getByName(id)))
      assert.deepStrictEqual(spy.mock.calls, [])
    }).pipe(Effect.provide(SecretStoreDurableObject)),
  )

  it.live("a Reveal that beats the late alarm to a past-Expiry Secret records `expired`", () =>
    Effect.gen(function* () {
      const spy = written()
      const store = yield* SecretStore
      const id = yield* store.put(secret, (yield* Clock.currentTimeMillis) - 1)
      yield* Effect.flip(store.take(id))
      yield* Effect.promise(() => runDurableObjectAlarm(env.SECRETS.getByName(id)))
      assert.deepStrictEqual(spy.mock.calls, [[{ blobs: ["expired"], indexes: ["expired"] }]])
    }).pipe(Effect.provide(SecretStoreDurableObject)),
  )
})
