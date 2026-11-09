// Runs inside workerd against real CreateQuota Durable Objects (the production rate limiter).
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { assert, describe, it } from "@effect/vitest"
import { Clock, Effect } from "effect"
import { CreateRateLimit, CREATES_PER_HOUR, WINDOW_MILLIS, clientKey } from "./create-rate-limit.ts"
import { CreateRateLimitDurableObject } from "./durable-object.ts"

describe("CreateQuota", () => {
  it.live("admits 20 creations per client, then refuses; other clients are unaffected", () =>
    Effect.gen(function* () {
      const { admit } = yield* CreateRateLimit
      const key = yield* clientKey(crypto.randomUUID())
      const admitted = yield* Effect.forEach(
        Array.from({ length: CREATES_PER_HOUR + 1 }),
        () => admit(key),
        { concurrency: "unbounded" },
      )
      assert.strictEqual(admitted.filter(Boolean).length, CREATES_PER_HOUR)
      assert.isTrue(yield* admit(yield* clientKey(crypto.randomUUID())))
    }).pipe(Effect.provide(CreateRateLimitDurableObject)),
  )

  it.live("an alarm at the end of the window deletes the count", () =>
    Effect.gen(function* () {
      const { admit } = yield* CreateRateLimit
      const key = yield* clientKey(crypto.randomUUID())
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
