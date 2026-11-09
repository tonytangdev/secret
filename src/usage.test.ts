// Usage counts (ADR-0005) and log hygiene through the primary seam. The harness records what the
// Worker writes to its Analytics Engine port and every log line the server emits.
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { TestClock } from "effect/testing"
import { Harness } from "./testing/harness.ts"
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
