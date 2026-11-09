// Abuse limits (spec "Hardening and privacy"). The size cap counts the Secret's UTF-8 bytes
// in the browser, before encryption; the server checks the encoded ciphertext instead.

/** The most a Secret may hold: 10 KB of UTF-8. */
export const MAX_SECRET_BYTES = 10 * 1024

const GCM_TAG_BYTES = 16

/** base64url (no padding) of the largest allowed Secret plus its GCM tag. */
export const MAX_CIPHERTEXT_LENGTH = Math.ceil(((MAX_SECRET_BYTES + GCM_TAG_BYTES) * 4) / 3)

/** Secrets one client (IP) may create per hour. */
export const CREATES_PER_HOUR = 20

/** How many bytes of the size cap a Secret uses. */
export const secretBytes = (plaintext: string): number => new TextEncoder().encode(plaintext).length
