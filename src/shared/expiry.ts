// How long an unrevealed Secret lives. Only 1d for now; the Expiry selector widens this.
import { Schema } from "effect"

export const Expiry = Schema.Literals(["1d"])
export type Expiry = typeof Expiry.Type

const MILLIS: Record<Expiry, number> = { "1d": 86_400_000 }

export const expiryMillis = (expiry: Expiry): number => MILLIS[expiry]
