// The browser's Effect program: what the send form and the Reveal page do, minus the UI.
import { Data, Effect } from "effect"
import type { Link } from "../shared/link.ts"
import { type LinkKey, SecretCrypto } from "../shared/crypto.ts"
import { SecretTooLarge, type StoredSecret } from "../shared/api.ts"
import { DEFAULT_EXPIRY, type Expiry } from "../shared/expiry.ts"
import { MAX_SECRET_BYTES, secretBytes } from "../shared/limits.ts"
import { ApiClient } from "./api-client.ts"

/** The Secret is empty or only whitespace; a Link to it would be useless. */
class SecretEmpty extends Data.TaggedError("SecretEmpty") {}

export interface SendOptions {
  /** How long the Secret waits unrevealed before it Burns; defaults to `DEFAULT_EXPIRY`. */
  readonly expiry?: Expiry
  /** Shared through another channel; needed together with the Link key. */
  readonly passphrase?: string
}

/** A Secret taken from the server (so already Burned there), with the Link key that unlocks it. */
export interface TakenSecret extends StoredSecret {
  readonly linkKey: LinkKey
}

/** Encrypts the Secret in the browser, stores only the ciphertext, and returns its Link. */
export const sendSecret = Effect.fn("sendSecret")(function* (
  plaintext: string,
  options: SendOptions = {},
) {
  if (plaintext.trim() === "") return yield* new SecretEmpty()
  if (secretBytes(plaintext) > MAX_SECRET_BYTES) return yield* new SecretTooLarge()
  const secretCrypto = yield* SecretCrypto
  const api = yield* ApiClient
  const { linkKey, ...stored } = yield* secretCrypto.encrypt(plaintext, options.passphrase)
  const hasPassphrase = options.passphrase !== undefined
  const { id } = yield* api.secrets.create({
    payload: { ...stored, hasPassphrase, expiry: options.expiry ?? DEFAULT_EXPIRY },
  })
  const link: Link = { id, linkKey, hasPassphrase }
  return link
})

/** Reveal, step 1: fetches the Secret and Burns it on the server. Keep the result in memory. */
export const takeSecret = Effect.fn("takeSecret")(function* (link: Link) {
  const api = yield* ApiClient
  const stored = yield* api.secrets.reveal({ payload: { id: link.id } })
  const taken: TakenSecret = { ...stored, linkKey: link.linkKey }
  return taken
})

/**
 * Reveal, step 2: decrypts a taken Secret with its Link key (and Passphrase, if it has one).
 * Can be retried, e.g. after `WrongPassphrase`; nothing is sent.
 */
export const unlockSecret = Effect.fn("unlockSecret")(function* (
  taken: TakenSecret,
  passphrase?: string,
) {
  const secretCrypto = yield* SecretCrypto
  const { hasPassphrase: _, ...encrypted } = taken
  return yield* secretCrypto.decrypt(encrypted, passphrase)
})

export const revealSecret = Effect.fn("revealSecret")(function* (link: Link, passphrase?: string) {
  return yield* unlockSecret(yield* takeSecret(link), passphrase)
})
