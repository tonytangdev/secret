// SecretCrypto: AES-256-GCM through WebCrypto, nothing else (ADR-0001). Runs in the browser only
// (Workers cap PBKDF2 far below 600,000 iterations). Without a Passphrase the Link key is the AES
// key; with one, the key is HKDF-SHA256(Link key ‖ PBKDF2-SHA256(Passphrase, salt, 600,000)).
import { Context, Data, Effect, Layer, Result } from "effect"
import { Base64Url } from "effect/encoding"

export const LINK_KEY_BYTES = 32 // 256-bit Link key = AES-256 key
export const IV_BYTES = 12 // 96-bit GCM IV, fresh per Secret
export const SALT_BYTES = 16 // 128-bit PBKDF2 salt, fresh per Secret
const PBKDF2_ITERATIONS = 600_000
// Changing the KDF parameters breaks every existing Link with a Passphrase.
const HKDF_INFO = "secret.tonytang.dev/v1 aes-256-gcm"

/** The Link key is malformed, or GCM authentication failed: the Secret can't be recovered. */
export class DecryptionFailed extends Data.TaggedError("DecryptionFailed") {}

/** GCM authentication failed while a Passphrase was used: try another Passphrase. */
export class WrongPassphrase extends Data.TaggedError("WrongPassphrase") {}

export interface Encrypted {
  readonly linkKey: string // base64url, travels only in the Link fragment
  readonly ciphertext: string // base64url
  readonly iv: string // base64url
  readonly salt?: string // base64url, present iff a Passphrase was used
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

/** HKDF-SHA256(Link key ‖ PBKDF2-SHA256(Passphrase, salt, 600,000 iterations)), salted again. */
const derivePassphraseKey = (
  linkKey: Uint8Array<ArrayBuffer>,
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
) =>
  Effect.gen(function* () {
    const pbkdf2Base = yield* Effect.promise(() =>
      crypto.subtle.importKey("raw", utf8(passphrase), "PBKDF2", false, ["deriveBits"]),
    )
    const stretched = yield* Effect.promise(() =>
      crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
        pbkdf2Base,
        256,
      ),
    )
    const ikm = new Uint8Array(LINK_KEY_BYTES + stretched.byteLength)
    ikm.set(linkKey, 0)
    ikm.set(new Uint8Array(stretched), LINK_KEY_BYTES)
    const hkdfBase = yield* Effect.promise(() =>
      crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]),
    )
    return yield* Effect.promise(() =>
      crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt, info: utf8(HKDF_INFO) },
        hkdfBase,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      ),
    )
  })

const encrypt = Effect.fn("SecretCrypto.encrypt")(function* (
  plaintext: string,
  passphrase?: string,
) {
  const linkKey = yield* randomBytes(LINK_KEY_BYTES)
  const iv = yield* randomBytes(IV_BYTES)
  const salt = passphrase === undefined ? undefined : yield* randomBytes(SALT_BYTES)
  const key =
    passphrase === undefined || salt === undefined
      ? yield* importLinkKey(linkKey)
      : yield* derivePassphraseKey(linkKey, passphrase, salt)
  const ciphertext = yield* Effect.promise(() =>
    crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8(plaintext)),
  )
  const encrypted: Encrypted = {
    linkKey: Base64Url.encode(linkKey),
    ciphertext: Base64Url.encode(new Uint8Array(ciphertext)),
    iv: Base64Url.encode(iv),
    ...(salt === undefined ? {} : { salt: Base64Url.encode(salt) }),
  }
  return encrypted
})

/**
 * With a Passphrase and a salt, a GCM failure is `WrongPassphrase`; anything else that fails
 * (malformed input, no Passphrase for a salted Secret) is `DecryptionFailed`.
 */
const decrypt = Effect.fn("SecretCrypto.decrypt")(function* (
  input: Encrypted,
  passphrase?: string,
) {
  const linkKey = yield* Effect.fromResult(decodeBase64Url(input.linkKey, LINK_KEY_BYTES))
  const iv = yield* Effect.fromResult(decodeBase64Url(input.iv, IV_BYTES))
  const ciphertext = yield* Effect.fromResult(decodeBase64Url(input.ciphertext))
  const salt =
    input.salt === undefined
      ? undefined
      : yield* Effect.fromResult(decodeBase64Url(input.salt, SALT_BYTES))
  const key =
    passphrase === undefined || salt === undefined
      ? yield* importLinkKey(linkKey)
      : yield* derivePassphraseKey(linkKey, passphrase, salt)
  const plain = yield* Effect.tryPromise({
    try: () => crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext),
    catch: () =>
      passphrase === undefined || salt === undefined
        ? new DecryptionFailed()
        : new WrongPassphrase(),
  })
  return yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(plain),
    catch: () => new DecryptionFailed(),
  })
})

export class SecretCrypto extends Context.Service<
  SecretCrypto,
  {
    readonly encrypt: (plaintext: string, passphrase?: string) => Effect.Effect<Encrypted>
    readonly decrypt: (
      input: Encrypted,
      passphrase?: string,
    ) => Effect.Effect<string, DecryptionFailed | WrongPassphrase>
  }
>()("SecretCrypto") {
  static readonly layer: Layer.Layer<SecretCrypto> = Layer.succeed(SecretCrypto, {
    encrypt,
    decrypt,
  })
}
