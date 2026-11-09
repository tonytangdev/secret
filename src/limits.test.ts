// Abuse limits (#7) through the in-process harness: the size cap in the browser and on the
// server, and the per-IP creation limit.
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { TestClock } from "effect/testing"
import { MAX_CIPHERTEXT_LENGTH, MAX_SECRET_BYTES } from "./shared/limits.ts"
import { Harness } from "./testing/harness.ts"
import { CreateRateLimitMemory } from "./worker/create-rate-limit.ts"
import { ApiClient } from "./web/api-client.ts"
import { revealSecret, sendSecret } from "./web/secret-flow.ts"

describe("size cap in the browser", () => {
  it.effect("an oversized Secret fails with SecretTooLarge before anything is sent", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(sendSecret("x".repeat(MAX_SECRET_BYTES + 1)))
      assert.strictEqual(failure._tag, "SecretTooLarge")
      assert.deepStrictEqual(yield* (yield* Harness).requests, [])
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect.each(["", "  \n\t"])(
    "an empty Secret (%j) fails with SecretEmpty before anything is sent",
    (plaintext) =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(sendSecret(plaintext))
        assert.strictEqual(failure._tag, "SecretEmpty")
        assert.deepStrictEqual(yield* (yield* Harness).requests, [])
      }).pipe(Effect.provide(Harness.layer())),
  )
})

describe("size cap end to end", () => {
  it.effect("a Secret of exactly 10 KB (multi-byte) is sent and revealed", () =>
    Effect.gen(function* () {
      const plaintext = "é".repeat(MAX_SECRET_BYTES / 2)
      const link = yield* sendSecret(plaintext)
      assert.strictEqual(yield* revealSecret(link), plaintext)
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("the cap counts bytes, not characters", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(sendSecret("é".repeat(MAX_SECRET_BYTES / 2 + 1)))
      assert.strictEqual(failure._tag, "SecretTooLarge")
    }).pipe(Effect.provide(Harness.layer())),
  )
})

describe("size cap on the server", () => {
  const create = (ciphertext: string) =>
    Effect.gen(function* () {
      const api = yield* ApiClient
      return yield* api.secrets.create({
        payload: { ciphertext, iv: "aXZpdml2aXZpdml2", hasPassphrase: false, expiry: "1d" },
      })
    })

  it.effect(
    "ciphertext over the cap fails with SecretTooLarge (413), skipping the browser check",
    () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(create("A".repeat(MAX_CIPHERTEXT_LENGTH + 1)))
        assert.strictEqual(failure._tag, "SecretTooLarge")
        const res = yield* (yield* Harness).fetch("/api/secrets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ciphertext: "A".repeat(MAX_CIPHERTEXT_LENGTH + 1),
            iv: "aXZpdml2aXZpdml2",
            hasPassphrase: false,
            expiry: "1d",
          }),
        })
        assert.strictEqual(res.status, 413)
      }).pipe(Effect.provide(Harness.layer())),
  )
})

describe("rate limit on creation", () => {
  const harness = Harness.layer({ rateLimit: CreateRateLimitMemory(3) })

  it.effect("the creation after the limit fails with RateLimited", () =>
    Effect.gen(function* () {
      yield* Effect.forEach([1, 2, 3], () => sendSecret("x"))
      const failure = yield* Effect.flip(sendSecret("one too many"))
      assert.strictEqual(failure._tag, "RateLimited")
    }).pipe(Effect.provide(harness)),
  )

  it.effect("an hour later the sender can create again", () =>
    Effect.gen(function* () {
      yield* Effect.forEach([1, 2, 3], () => sendSecret("x"))
      yield* TestClock.adjust("59 minutes")
      assert.strictEqual((yield* Effect.flip(sendSecret("x")))._tag, "RateLimited")
      yield* TestClock.adjust("1 minute")
      yield* sendSecret("back again")
    }).pipe(Effect.provide(harness)),
  )

  it.effect("each IP has its own limit, and the limit answers 429 on the wire", () =>
    Effect.gen(function* () {
      const { fetch } = yield* Harness
      const createFrom = (ip: string) =>
        fetch("/api/secrets", {
          method: "POST",
          headers: { "content-type": "application/json", "cf-connecting-ip": ip },
          body: JSON.stringify({
            ciphertext: "Y2lwaGVy",
            iv: "aXZpdml2aXZpdml2",
            hasPassphrase: false,
            expiry: "1d",
          }),
        }).pipe(Effect.map((res) => res.status))
      const first = yield* Effect.forEach([1, 2, 3, 4], () => createFrom("192.0.2.1"))
      assert.deepStrictEqual(first, [200, 200, 200, 429])
      assert.strictEqual(yield* createFrom("2001:db8::1"), 200)
    }).pipe(Effect.provide(harness)),
  )
})
