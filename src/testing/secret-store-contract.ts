// The SecretStore contract, written once and run against every implementation: the in-memory store
// (node, TestClock) and the Durable Object store (workerd, real clock). `test` is `it.effect` or
// `it.live`; Expiry is expressed relative to `Clock`, so neither needs to move time.
import { assert, describe, type it } from "@effect/vitest"
import { Clock, Effect, type Layer, Result } from "effect"
import type { StoredSecret } from "../shared/api.ts"
import { SecretStore } from "../worker/secret-store.ts"

const secret: StoredSecret = {
  ciphertext: "Y2lwaGVy",
  iv: "aXZpdml2aXZpdml2",
  hasPassphrase: false,
}
const HOUR = 3_600_000

export const secretStoreContract = (
  name: string,
  store: Layer.Layer<SecretStore>,
  test: typeof it.effect,
) =>
  describe(`SecretStore contract: ${name}`, () => {
    const putIn = (millis: number) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        return yield* (yield* SecretStore).put(secret, now + millis)
      })
    const take = (id: string) => Effect.flatMap(SecretStore, (s) => s.take(id))

    test("take returns the Secret that was put", () =>
      Effect.gen(function* () {
        const id = yield* putIn(HOUR)
        assert.deepStrictEqual(yield* take(id), secret)
      }).pipe(Effect.provide(store)))

    test("take Burns: the second take finds the Secret gone", () =>
      Effect.gen(function* () {
        const id = yield* putIn(HOUR)
        yield* take(id)
        assert.strictEqual((yield* Effect.flip(take(id)))._tag, "SecretGone")
      }).pipe(Effect.provide(store)))

    test("an ID that was never put is gone", () =>
      Effect.gen(function* () {
        assert.strictEqual((yield* Effect.flip(take("A".repeat(22))))._tag, "SecretGone")
      }).pipe(Effect.provide(store)))

    test("concurrent takes: exactly one gets the Secret", () =>
      Effect.gen(function* () {
        const id = yield* putIn(HOUR)
        const results = yield* Effect.forEach([1, 2, 3], () => Effect.result(take(id)), {
          concurrency: "unbounded",
        })
        assert.strictEqual(results.filter(Result.isSuccess).length, 1)
      }).pipe(Effect.provide(store)))

    test.each([0, -1, -HOUR])("a Secret whose Expiry passed (%i ms from now) is gone", (millis) =>
      Effect.gen(function* () {
        const id = yield* putIn(millis)
        assert.strictEqual((yield* Effect.flip(take(id)))._tag, "SecretGone")
      }).pipe(Effect.provide(store)),
    )
  })
