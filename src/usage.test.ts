// Usage counts (ADR-0005) and log hygiene through the primary seam. The harness records what the
// Worker writes to its Analytics Engine port and every log line the server emits.
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { TestClock } from "effect/testing"
import { MAX_CIPHERTEXT_LENGTH } from "./shared/limits.ts"
import { Harness } from "./testing/harness.ts"
import { CreateRateLimitMemory } from "./worker/create-rate-limit.ts"
import { revealSecret, sendSecret } from "./web/secret-flow.ts"

describe("Usage counts", () => {
  it.effect("creating a Secret records `created`: the event name only, no ID, IP or payload", () =>
    Effect.gen(function* () {
      yield* sendSecret("counted")
      assert.deepStrictEqual(yield* (yield* Harness).dataPoints, [
        { blobs: ["created"], indexes: ["created"] },
      ])
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("a Reveal records `revealed`; a Reveal of a gone Secret records nothing", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("counted")
      yield* revealSecret(link)
      yield* Effect.flip(revealSecret(link))
      assert.deepStrictEqual(yield* (yield* Harness).dataPoints, [
        { blobs: ["created"], indexes: ["created"] },
        { blobs: ["revealed"], indexes: ["revealed"] },
      ])
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("a refused create (too large or rate limited) records nothing and logs no IP", () =>
    Effect.gen(function* () {
      const { fetch } = yield* Harness
      const createFrom = (ciphertext: string) =>
        fetch("/api/secrets", {
          method: "POST",
          headers: { "content-type": "application/json", "cf-connecting-ip": "192.0.2.7" },
          body: JSON.stringify({
            ciphertext,
            iv: "aXZpdml2aXZpdml2",
            hasPassphrase: false,
            expiry: "1d",
          }),
        }).pipe(Effect.map((res) => res.status))
      assert.strictEqual(yield* createFrom("A".repeat(MAX_CIPHERTEXT_LENGTH + 1)), 413)
      assert.strictEqual(yield* createFrom("Y2lwaGVy"), 200)
      assert.strictEqual(yield* createFrom("Y2lwaGVy"), 429)
      const harness = yield* Harness
      assert.deepStrictEqual(yield* harness.dataPoints, [
        { blobs: ["created"], indexes: ["created"] },
      ])
      const logs = (yield* harness.logs).join("\n")
      assert.notInclude(logs, "192.0.2.7")
      assert.notInclude(logs, "/api/secrets")
    }).pipe(Effect.provide(Harness.layer({ rateLimit: CreateRateLimitMemory(1) }))),
  )
})

describe("Logs", () => {
  it.effect("logs captured during create and Reveal contain no Secret ID", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("quiet", { expiry: "1h" })
      yield* revealSecret(link)
      yield* Effect.flip(revealSecret(link))
      const late = yield* sendSecret("late", { expiry: "1h" })
      yield* TestClock.adjust(3_600_000)
      yield* Effect.flip(revealSecret(late))
      const logs = (yield* (yield* Harness).logs).join("\n")
      assert.notInclude(logs, link.id)
      assert.notInclude(logs, late.id)
      assert.notInclude(logs, "/api/secrets/")
    }).pipe(Effect.provide(Harness.layer())),
  )
})
