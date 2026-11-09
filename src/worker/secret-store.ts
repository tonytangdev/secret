// SecretStore: where Secrets wait to be revealed. `take` returns and Burns in one atomic step, so
// at most one Reveal ever gets a Secret. Implementations: in memory (tests) and a Durable Object.
import { Context, Effect } from "effect"
import { Base64Url } from "effect/encoding"
import { SECRET_ID_BYTES, SecretId, type SecretGone, type StoredSecret } from "../shared/api.ts"

/** A stored Secret and when it Burns (epoch ms). */
export interface Entry {
  readonly secret: StoredSecret
  readonly expiresAt: number
}

export class SecretStore extends Context.Service<
  SecretStore,
  {
    /** Keeps the Secret until `expiresAt` (epoch ms) and returns its new ID. */
    readonly put: (secret: StoredSecret, expiresAt: number) => Effect.Effect<SecretId>
    /** Returns the Secret and Burns it; `SecretGone` if there's nothing (left) to take. */
    readonly take: (id: SecretId) => Effect.Effect<StoredSecret, SecretGone>
  }
>()("SecretStore") {}

/** 128 random bits from the platform CSPRNG, base64url (22 chars). */
export const newSecretId: Effect.Effect<SecretId> = Effect.sync(() =>
  SecretId.make(Base64Url.encode(crypto.getRandomValues(new Uint8Array(SECRET_ID_BYTES)))),
)
