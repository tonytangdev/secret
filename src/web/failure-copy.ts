// What each typed failure tells the person, in one place for every page. Anything without a tag
// here (network, server, a defect) is "failed", worded per page.
import { MAX_SECRET_LABEL } from "../shared/limits.ts"

/** A failure the UI words on its own; the key is the error's `_tag`. */
interface Copy {
  /** Set when the failure takes over the page; otherwise the copy sits under a form. */
  readonly title?: string
  readonly body: string
}

export const FAILURE_COPY = {
  SecretEmpty: { body: "There's nothing to send yet. Type or paste your secret first." },
  SecretTooLarge: {
    body: `That's over the ${MAX_SECRET_LABEL} limit, so I didn't send it. Shorten it and try again.`,
  },
  RateLimited: {
    body: "You've created a lot of secrets in the last hour, so I'm holding off. Wait a while and try again.",
  },
  sendFailed: {
    body: "I couldn't create the link, so nothing was saved. Check your connection and try again.",
  },
  revealFailed: { body: "I couldn't reach the server. Check your connection and try again." },
  WrongPassphrase: {
    body: "Wrong passphrase. Check it with the sender and try again; you can retry as often as you need.",
  },
  SecretGone: {
    title: "This secret doesn't exist, was already viewed, or expired.",
    body: "If you didn't open it, tell the sender — someone else may have.",
  },
  MalformedLinkKey: {
    title: "This link is incomplete.",
    body: "The part after the # is missing or damaged, so the secret can't be unlocked. Nothing was revealed. Ask the sender to copy the whole link again.",
  },
  DecryptionFailed: {
    title: "This secret can't be decrypted.",
    body: "The link looks right, but its key doesn't unlock the secret, which is now gone from the server. Ask the sender to create a new one.",
  },
} as const satisfies Record<string, Copy>

type Failure = keyof typeof FAILURE_COPY

/** `error`'s tag if it's one of `known`, else `fallback` (also for a rejected run's `undefined`). */
export const failureOf = <K extends Failure, F extends Failure>(
  error: { readonly _tag: string } | undefined,
  known: ReadonlyArray<K>,
  fallback: F,
): K | F => known.find((tag) => tag === error?._tag) ?? fallback
