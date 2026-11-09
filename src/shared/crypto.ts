// SecretCrypto: AES-256-GCM through WebCrypto, nothing else (ADR-0001). Runs in the browser only.
// Without a Passphrase the Link key is the AES key. A Passphrase-derived key goes beside
// `importLinkKey` without changing the shape of `Encrypted`.
import { Context, Data, Effect, Layer, Result } from "effect"
import { Base64Url } from "effect/encoding"

export const LINK_KEY_BYTES = 32 // 256-bit Link key = AES-256 key
const IV_BYTES = 12 // 96-bit GCM IV, fresh per Secret

/** The Link key is malformed, or GCM authentication failed: the Secret can't be recovered. */
export class DecryptionFailed extends Data.TaggedError("DecryptionFailed") {}

export interface Encrypted {
  readonly linkKey: string // base64url, travels only in the Link fragment
  readonly ciphertext: string // base64url
  readonly iv: string // base64url
}

// Copy: workers-types types TextEncoder.encode as Uint8Array<ArrayBufferLike>, not a BufferSource.
const utf8 = (text: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(new TextEncoder().encode(text))

const randomBytes = (length: number): Effect.Effect<Uint8Array<ArrayBuffer>> =>
  Effect.sync(() => crypto.getRandomValues(new Uint8Array(length)))

/** base64url → bytes, optionally of an exact length. */
export const decodeBase64Url = (
  text: string,
  length?: number,
): Result.Result<Uint8Array<ArrayBuffer>, DecryptionFailed> =>
  Result.match(Base64Url.decode(text), {
    onFailure: () => Result.fail(new DecryptionFailed()),
    onSuccess: (bytes) =>
      length !== undefined && bytes.length !== length
        ? Result.fail(new DecryptionFailed())
        : Result.succeed(new Uint8Array(bytes)),
  })

const importLinkKey = (raw: Uint8Array<ArrayBuffer>) =>
  Effect.promise(() =>
    crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
  )

const encrypt = Effect.fn("SecretCrypto.encrypt")(function* (plaintext: string) {
  const linkKey = yield* randomBytes(LINK_KEY_BYTES)
  const iv = yield* randomBytes(IV_BYTES)
  const key = yield* importLinkKey(linkKey)
  const ciphertext = yield* Effect.promise(() =>
    crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8(plaintext)),
  )
  const encrypted: Encrypted = {
    linkKey: Base64Url.encode(linkKey),
    ciphertext: Base64Url.encode(new Uint8Array(ciphertext)),
    iv: Base64Url.encode(iv),
  }
  return encrypted
})

const decrypt = Effect.fn("SecretCrypto.decrypt")(function* (input: Encrypted) {
  const linkKey = yield* Effect.fromResult(decodeBase64Url(input.linkKey, LINK_KEY_BYTES))
  const iv = yield* Effect.fromResult(decodeBase64Url(input.iv, IV_BYTES))
  const ciphertext = yield* Effect.fromResult(decodeBase64Url(input.ciphertext))
  const key = yield* importLinkKey(linkKey)
  const plain = yield* Effect.tryPromise({
    try: () => crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext),
    catch: () => new DecryptionFailed(),
  })
  return yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(plain),
    catch: () => new DecryptionFailed(),
  })
})

export class SecretCrypto extends Context.Service<
  SecretCrypto,
  {
    readonly encrypt: (plaintext: string) => Effect.Effect<Encrypted>
    readonly decrypt: (input: Encrypted) => Effect.Effect<string, DecryptionFailed>
  }
>()("SecretCrypto") {
  static readonly layer: Layer.Layer<SecretCrypto> = Layer.succeed(SecretCrypto, {
    encrypt,
    decrypt,
  })
}
