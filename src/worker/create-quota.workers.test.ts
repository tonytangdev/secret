// Runs inside workerd against real CreateQuota Durable Objects (the production rate limiter).
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { assert, describe, it } from "@effect/vitest"
import { Clock, Effect } from "effect"
import { ClientKey, CreateRateLimit, CREATES_PER_HOUR, WINDOW_MILLIS } from "./create-rate-limit.ts"
import { ClientKeyFromEnv, CreateRateLimitDurableObject } from "./durable-object.ts"

describe("CreateQuota", () => {
  it.live("admits 20 creations per client, then refuses; other clients are unaffected", () =>
    Effect.gen(function* () {
      const { admit } = yield* CreateRateLimit
      const key = crypto.randomUUID()
      const admitted = yield* Effect.forEach(
        Array.from({ length: CREATES_PER_HOUR + 1 }),
        () => admit(key),
        { concurrency: "unbounded" },
      )
      assert.strictEqual(admitted.filter(Boolean).length, CREATES_PER_HOUR)
      assert.isTrue(yield* admit(crypto.randomUUID()))
    }).pipe(Effect.provide(CreateRateLimitDurableObject)),
  )

  it.live("an alarm at the end of the window deletes the count", () =>
    Effect.gen(function* () {
      const { admit } = yield* CreateRateLimit
      const key = crypto.randomUUID()
      const start = yield* Clock.currentTimeMillis
      yield* Effect.forEach(Array.from({ length: CREATES_PER_HOUR }), () => admit(key))
      assert.isFalse(yield* admit(key))
      const stub = env.CREATE_QUOTA.getByName(key)
      const alarm = yield* Effect.promise(() =>
        runInDurableObject(stub, (_object, state) => state.storage.getAlarm()),
      )
      assert.isAtLeast(alarm ?? 0, start + WINDOW_MILLIS)
      assert.isAtMost(alarm ?? 0, start + WINDOW_MILLIS + 5_000)
      assert.isTrue(yield* Effect.promise(() => runDurableObjectAlarm(stub)))
      assert.isTrue(yield* admit(key))
    }).pipe(Effect.provide(CreateRateLimitDurableObject)),
  )
})

describe("ClientKeyFromEnv", () => {
  it.live("keys a client by HMAC-SHA256 of its IP under the IP_HASH_KEY secret", () =>
    Effect.gen(function* () {
      // HMAC-SHA256("workers-test-ip-hash-key", "192.0.2.1"), computed with node:crypto.
      assert.strictEqual(
        yield* (yield* ClientKey).of("192.0.2.1"),
        "NVxRVzi17YlXggGoKgg07s1Db2lyRJAJJbLP2wWnkcY",
      )
    }).pipe(Effect.provide(ClientKeyFromEnv)),
  )
})
