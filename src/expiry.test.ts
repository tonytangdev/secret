// Expiry through the primary seam: the server runs on the test's services, so TestClock moves
// server time. An unrevealed Secret works until just before its Expiry and is gone from then on.
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { TestClock } from "effect/testing"
import { HOUR } from "./shared/expiry.ts"
import { Harness } from "./testing/harness.ts"
import { revealSecret, sendSecret } from "./web/secret-flow.ts"

describe("Expiry", () => {
  it.effect.each([
    ["1h", HOUR],
    ["1d", 24 * HOUR],
    ["7d", 7 * 24 * HOUR],
  ] as const)("%s: Reveal works 1 ms before the Expiry and is gone at it", ([expiry, millis]) =>
    Effect.gen(function* () {
      const early = yield* sendSecret("early", { expiry })
      const late = yield* sendSecret("late", { expiry })
      yield* TestClock.adjust(millis - 1)
      assert.strictEqual(yield* revealSecret(early), "early")
      yield* TestClock.adjust(1)
      assert.strictEqual((yield* Effect.flip(revealSecret(late)))._tag, "SecretGone")
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("defaults to 1d", () =>
    Effect.gen(function* () {
      const early = yield* sendSecret("early")
      const late = yield* sendSecret("late")
      yield* TestClock.adjust(24 * HOUR - 1)
      assert.strictEqual(yield* revealSecret(early), "early")
      yield* TestClock.adjust(1)
      assert.strictEqual((yield* Effect.flip(revealSecret(late)))._tag, "SecretGone")
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect.each(["1h", "1d", "7d", "2d", "1H", "", 3600])(
    "the API accepts only 1h, 1d or 7d (expiry %j)",
    (expiry) =>
      Effect.gen(function* () {
        const res = yield* (yield* Harness).fetch("/api/secrets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ciphertext: "Y2lwaGVy",
            iv: "aXZpdml2aXZpdml2",
            hasPassphrase: false,
            expiry,
          }),
        })
        const accepted = expiry === "1h" || expiry === "1d" || expiry === "7d"
        assert.strictEqual(res.status, accepted ? 200 : 400)
      }).pipe(Effect.provide(Harness.layer())),
  )
})
