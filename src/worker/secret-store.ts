// SecretStore: where Secrets wait to be revealed. `take` returns and Burns in one atomic step, so
// at most one Reveal ever gets a Secret. Implementations: in memory (tests) and a Durable Object.
import { Context, Effect } from "effect"
import { Base64Url } from "effect/encoding"
import type { SecretGone, StoredSecret } from "../shared/api.ts"

export class SecretStore extends Context.Service<
  SecretStore,
  {
    /** Keeps the Secret until `expiresAt` (epoch ms) and returns its new ID. */
    readonly put: (secret: StoredSecret, expiresAt: number) => Effect.Effect<string>
    /** Returns the Secret and Burns it; `SecretGone` if there's nothing (left) to take. */
    readonly take: (id: string) => Effect.Effect<StoredSecret, SecretGone>
  }
>()("SecretStore") {}

/** 128 random bits from the platform CSPRNG, base64url (22 chars). */
export const newSecretId: Effect.Effect<string> = Effect.sync(() =>
  Base64Url.encode(crypto.getRandomValues(new Uint8Array(16))),
)
