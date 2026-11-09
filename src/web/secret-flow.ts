// The browser's Effect program: what the send form and the Reveal page do, minus the UI.
import { Effect } from "effect"
import type { Link } from "../shared/link.ts"
import { SecretCrypto } from "../shared/crypto.ts"
import type { StoredSecret } from "../shared/api.ts"
import { ApiClient } from "./api-client.ts"

export interface SendOptions {
  /** Shared through another channel; needed together with the Link key. */
  readonly passphrase?: string
}

/** Encrypts the Secret in the browser, stores only the ciphertext, and returns its Link. */
export const sendSecret = Effect.fn("sendSecret")(function* (
  plaintext: string,
  options: SendOptions = {},
) {
  const secretCrypto = yield* SecretCrypto
  const api = yield* ApiClient
  const { linkKey, ...stored } = yield* secretCrypto.encrypt(plaintext, options.passphrase)
  const hasPassphrase = options.passphrase !== undefined
  const { id } = yield* api.secrets.create({
    payload: { ...stored, hasPassphrase, expiry: "1d" },
  })
  const link: Link = { id, linkKey, hasPassphrase }
  return link
})

/** Reveal, step 1: fetches the Secret and Burns it on the server. Keep the result in memory. */
export const takeSecret = Effect.fn("takeSecret")(function* (link: Link) {
  const api = yield* ApiClient
  return yield* api.secrets.reveal({ payload: { id: link.id } })
})

/**
 * Reveal, step 2: decrypts a taken Secret with the Link key (and Passphrase, if it has one).
 * Can be retried, e.g. after `WrongPassphrase`; nothing is sent.
 */
export const unlockSecret = Effect.fn("unlockSecret")(function* (
  taken: StoredSecret,
  link: Link,
  passphrase?: string,
) {
  const secretCrypto = yield* SecretCrypto
  const { hasPassphrase: _, ...encrypted } = taken
  return yield* secretCrypto.decrypt({ ...encrypted, linkKey: link.linkKey }, passphrase)
})

export const revealSecret = Effect.fn("revealSecret")(function* (link: Link, passphrase?: string) {
  const taken = yield* takeSecret(link)
  return yield* unlockSecret(taken, link, passphrase)
})
