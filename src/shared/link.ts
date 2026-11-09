// The Link: `/s/<id>#<link-key>`, or `/s/<id>#<link-key>.p` when the Secret has a Passphrase.
// The Link key lives in the fragment, which browsers never send. The `.p` flag lets the Reveal page
// say a Passphrase is needed without asking the server first; `.` isn't base64url, so it can't be
// part of the key.
import { Data, Result, Schema } from "effect"
import { SecretId } from "./api.ts"
import { LinkKey } from "./crypto.ts"

export interface Link {
  readonly id: SecretId
  readonly linkKey: LinkKey
  readonly hasPassphrase: boolean
}

const PASSPHRASE_FLAG = ".p"

/** The fragment is missing or isn't a well-formed Link key (e.g. the Link was copied in part). */
export class MalformedLinkKey extends Data.TaggedError("MalformedLinkKey") {}

/** The ID can't be one the server issued, so no Secret exists under it. */
export class MalformedSecretId extends Data.TaggedError("MalformedSecretId") {}

export const linkPath = (link: Link): string =>
  `/s/${link.id}#${link.linkKey}${link.hasPassphrase ? PASSPHRASE_FLAG : ""}`

/** Checks a Link read from the page (route ID + `location.hash`). Pure: nothing is sent. */
export const parseLink = (
  id: string,
  hash: string,
): Result.Result<Link, MalformedLinkKey | MalformedSecretId> => {
  const fragment = hash.replace(/^#/, "")
  const hasPassphrase = fragment.endsWith(PASSPHRASE_FLAG)
  const linkKey = hasPassphrase ? fragment.slice(0, -PASSPHRASE_FLAG.length) : fragment
  if (!Schema.is(LinkKey)(linkKey)) return Result.fail(new MalformedLinkKey())
  if (!Schema.is(SecretId)(id)) return Result.fail(new MalformedSecretId())
  return Result.succeed({ id, linkKey, hasPassphrase })
}
