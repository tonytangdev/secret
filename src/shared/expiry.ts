// How long an unrevealed Secret lives before it Burns on its own.
import { Schema } from "effect"

export const Expiry = Schema.Literals(["1h", "1d", "7d"])
export type Expiry = typeof Expiry.Type

export const DEFAULT_EXPIRY: Expiry = "1d"

const HOUR = 3_600_000
const MILLIS: Record<Expiry, number> = { "1h": HOUR, "1d": 24 * HOUR, "7d": 7 * 24 * HOUR }

export const expiryMillis = (expiry: Expiry): number => MILLIS[expiry]

/** How the Expiry reads in copy: "1 hour", "1 day", "7 days". */
export const EXPIRY_LABEL: Record<Expiry, string> = {
  "1h": "1 hour",
  "1d": "1 day",
  "7d": "7 days",
}
