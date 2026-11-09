// The browser's Effect program: what the send form and the Reveal page do, minus the UI.
import { Effect } from "effect"
import type { Link } from "../shared/link.ts"
import { SecretCrypto } from "../shared/crypto.ts"
import type { StoredSecret } from "../shared/api.ts"
import { DEFAULT_EXPIRY, type Expiry } from "../shared/expiry.ts"
import { ApiClient } from "./api-client.ts"

/** Encrypts the Secret in the browser, stores only the ciphertext, and returns its Link. */
export interface SendOptions {
  readonly expiry?: Expiry
}

export const sendSecret = Effect.fn("sendSecret")(function* (
  plaintext: string,
  options: SendOptions = {},
) {
  const secretCrypto = yield* SecretCrypto
  const api = yield* ApiClient
  const { linkKey, ciphertext, iv } = yield* secretCrypto.encrypt(plaintext)
  const { id } = yield* api.secrets.create({
    payload: { ciphertext, iv, hasPassphrase: false, expiry: options.expiry ?? DEFAULT_EXPIRY },
  })
  const link: Link = { id, linkKey }
  return link
})

/** Reveal, step 1: fetches the Secret and Burns it on the server. Keep the result in memory. */
export const takeSecret = Effect.fn("takeSecret")(function* (link: Link) {
  const api = yield* ApiClient
  return yield* api.secrets.reveal({ payload: { id: link.id } })
})

/** Reveal, step 2: decrypts a taken Secret with the Link key. Can be retried; nothing is sent. */
export const unlockSecret = Effect.fn("unlockSecret")(function* (taken: StoredSecret, link: Link) {
  const secretCrypto = yield* SecretCrypto
  return yield* secretCrypto.decrypt({
    linkKey: link.linkKey,
    ciphertext: taken.ciphertext,
    iv: taken.iv,
  })
})

export const revealSecret = Effect.fn("revealSecret")(function* (link: Link) {
  const taken = yield* takeSecret(link)
  return yield* unlockSecret(taken, link)
})
