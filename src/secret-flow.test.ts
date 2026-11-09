// The primary seam (spec "Testing Decisions"): the browser's Effect program (SecretCrypto + typed
// client) talks to the Worker's API handler in the same process, with the in-memory SecretStore.
import { assert, describe, it } from "@effect/vitest"
import { Effect, Result } from "effect"
import { LinkKey } from "./shared/crypto.ts"
import { linkPath, parseLink } from "./shared/link.ts"
import { revealSecret, sendSecret, takeSecret, unlockSecret } from "./web/secret-flow.ts"
import { Harness } from "./testing/harness.ts"

describe("send → Reveal", () => {
  it.effect("the recipient gets back the Secret the sender sent", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("hunter2 ✓")
      const secret = yield* revealSecret(link)
      assert.strictEqual(secret, "hunter2 ✓")
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("a Link works once: the second Reveal finds the Secret gone", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("once")
      yield* revealSecret(link)
      const second = yield* Effect.flip(revealSecret(link))
      assert.strictEqual(second._tag, "SecretGone")
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("two Reveals at the same moment: exactly one gets the Secret", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("race")
      const results = yield* Effect.forEach([1, 2], () => Effect.result(revealSecret(link)), {
        concurrency: "unbounded",
      })
      const won = results.filter(Result.isSuccess).map((r) => r.success)
      const lost = results.filter(Result.isFailure).map((r) => r.failure._tag)
      assert.deepStrictEqual(won, ["race"])
      assert.deepStrictEqual(lost, ["SecretGone"])
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("a tampered Link key fails with DecryptionFailed", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("x")
      const flipped = (link.linkKey.startsWith("A") ? "B" : "A") + link.linkKey.slice(1)
      const failure = yield* Effect.flip(revealSecret({ ...link, linkKey: LinkKey.make(flipped) }))
      assert.strictEqual(failure._tag, "DecryptionFailed")
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("nothing sent to the server contains the Secret or the Link key", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("correct horse battery staple")
      yield* revealSecret(link)
      const requests = yield* (yield* Harness).requests
      assert.strictEqual(requests.length, 2)
      for (const request of requests) {
        const wire = request.url + request.body
        assert.notInclude(wire, "correct horse")
        assert.notInclude(wire, link.linkKey)
      }
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("the Secret ID travels in the Reveal body, never in a URL", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("x")
      yield* revealSecret(link)
      const requests = yield* (yield* Harness).requests
      for (const request of requests) assert.notInclude(request.url, link.id)
      assert.include(requests[1]?.body, link.id)
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("Secret IDs are 128 random bits, base64url", () =>
    Effect.gen(function* () {
      const ids = yield* Effect.forEach([1, 2, 3], () => sendSecret("x")).pipe(
        Effect.map((links) => links.map((l) => l.id)),
      )
      for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{22}$/)
      assert.strictEqual(new Set(ids).size, 3)
    }).pipe(Effect.provide(Harness.layer())),
  )
})

describe("with a Passphrase", () => {
  it.effect("the recipient gets the Secret back with the Link and the Passphrase", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("behind a door", { passphrase: "open sesame" })
      assert.strictEqual(yield* revealSecret(link, "open sesame"), "behind a door")
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("the Link alone doesn't unlock the Secret", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("behind a door", { passphrase: "open sesame" })
      const failure = yield* Effect.flip(revealSecret(link))
      assert.strictEqual(failure._tag, "DecryptionFailed")
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("a wrong Passphrase can be retried without a second Reveal", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("behind a door", { passphrase: "open sesame" })
      const taken = yield* takeSecret(link)
      const wrong = yield* Effect.flip(unlockSecret(taken, link, "open sesam"))
      assert.strictEqual(wrong._tag, "WrongPassphrase")
      assert.strictEqual(yield* unlockSecret(taken, link, "open sesame"), "behind a door")
      const requests = yield* (yield* Harness).requests
      assert.strictEqual(requests.filter((r) => r.url.endsWith("/reveal")).length, 1)
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("the Link says a Passphrase is needed, and the server keeps the flag", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("behind a door", { passphrase: "open sesame" })
      const [path = "", hash = ""] = linkPath(link).split("#")
      const opened = yield* Effect.fromResult(parseLink(path.replace("/s/", ""), `#${hash}`))
      assert.isTrue(opened.hasPassphrase)
      const taken = yield* takeSecret(opened)
      assert.isTrue(taken.hasPassphrase)
      assert.match(taken.salt ?? "", /^[A-Za-z0-9_-]{22}$/)
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("a Link without a Passphrase says none is needed", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("open")
      const [path = "", hash = ""] = linkPath(link).split("#")
      const opened = yield* Effect.fromResult(parseLink(path.replace("/s/", ""), `#${hash}`))
      assert.isFalse(opened.hasPassphrase)
      const taken = yield* takeSecret(opened)
      assert.isFalse(taken.hasPassphrase)
      assert.isUndefined(taken.salt)
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("the Passphrase is never sent to the server", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("behind a door", { passphrase: "open sesame" })
      yield* revealSecret(link, "open sesame")
      for (const request of yield* (yield* Harness).requests) {
        assert.notInclude(request.url + request.body, "open sesame")
      }
    }).pipe(Effect.provide(Harness.layer())),
  )
})

describe("opening a Link", () => {
  it.effect("reads the Link back from the page's path and fragment", () =>
    Effect.gen(function* () {
      const link = yield* sendSecret("from the page")
      const [path = "", hash = ""] = linkPath(link).split("#")
      const opened = yield* Effect.fromResult(parseLink(path.replace("/s/", ""), `#${hash}`))
      assert.strictEqual(yield* revealSecret(opened), "from the page")
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect.each([
    "",
    "#",
    "#tooShort",
    "#" + "A".repeat(42) + "!",
    "#" + "A".repeat(44),
    "#.p",
    "#" + "A".repeat(43) + ".x",
  ])("rejects the Link key %j before anything is sent", (hash) =>
    Effect.gen(function* () {
      const link = yield* sendSecret("still here")
      const failure = yield* Effect.flip(Effect.fromResult(parseLink(link.id, hash)))
      assert.strictEqual(failure._tag, "MalformedLinkKey")
      assert.strictEqual(yield* revealSecret(link), "still here")
    }).pipe(Effect.provide(Harness.layer())),
  )
})

describe("API on the wire", () => {
  const post = (path: string, body: unknown) =>
    Effect.gen(function* () {
      const harness = yield* Harness
      const res = yield* harness.fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const text = yield* Effect.promise(() => res.text())
      return { res, text }
    })

  it.effect("a Reveal of an unknown ID is 410 with no-store and the security headers", () =>
    Effect.gen(function* () {
      const { res } = yield* post("/api/secrets/reveal", { id: "A".repeat(22) })
      assert.strictEqual(res.status, 410)
      assert.strictEqual(res.headers.get("cache-control"), "no-store")
      assert.strictEqual(res.headers.get("referrer-policy"), "no-referrer")
      assert.include(res.headers.get("content-security-policy"), "frame-ancestors 'none'")
    }).pipe(Effect.provide(Harness.layer())),
  )

  it.effect("the server keeps only ciphertext, IV and the has-passphrase flag", () =>
    Effect.gen(function* () {
      const created = yield* post("/api/secrets", {
        ciphertext: "Y2lwaGVy",
        iv: "aXZpdml2aXZpdml2",
        hasPassphrase: false,
        expiry: "1d",
        plaintext: "should not be kept",
      })
      assert.strictEqual(created.res.status, 200)
      const id = /"id":"([^"]+)"/.exec(created.text)?.[1]
      const revealed = yield* post("/api/secrets/reveal", { id })
      assert.strictEqual(
        revealed.text,
        '{"ciphertext":"Y2lwaGVy","iv":"aXZpdml2aXZpdml2","hasPassphrase":false}',
      )
    }).pipe(Effect.provide(Harness.layer())),
  )
})
