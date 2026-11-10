/** How many glyphs behind the front still flicker before they settle. */
const FLICKER = 8

/** Where a front sweeping left to right over `length` glyphs is: `calm` have settled behind it. */
const sweep = (length: number, progress: number) => {
  const clamped = Math.min(1, Math.max(0, progress))
  // The front overshoots by FLICKER so the last glyphs have settled when progress reaches 1.
  const front = Math.min(length, Math.floor(clamped * (length + FLICKER)))
  return { front, calm: clamped === 1 ? front : Math.max(0, front - FLICKER) }
}

const flicker = (count: number, noise: () => string) =>
  Array.from({ length: count }, noise).join("")

/**
 * One frame of the "Encrypting…" animation: a front sweeps left to right, turning dots into
 * glyphs that flicker (`noise`) and then settle on `settled`. Decoration, not ciphertext.
 */
export const scrambleFrame = (settled: string, progress: number, noise: () => string) => {
  const { front, calm } = sweep(settled.length, progress)
  return {
    encrypted: settled.slice(0, calm) + flicker(front - calm, noise),
    waiting: "•".repeat(settled.length - front),
  }
}

/** The "Decrypting…" animation, `scrambleFrame` backwards: glyphs flicker, then settle into dots. */
export const unscrambleFrame = (glyphs: string, progress: number, noise: () => string) => {
  const { front, calm } = sweep(glyphs.length, progress)
  return {
    decrypted: "•".repeat(calm),
    waiting: flicker(front - calm, noise) + glyphs.slice(front),
  }
}

/**
 * One frame of showing a hidden Secret: dots flicker into its real characters, left to right.
 * Whitespace is kept from the first frame, so the text doesn't reflow while it resolves.
 */
export const decodeFrame = (secret: string, progress: number, noise: () => string) => {
  const chars = Array.from(secret)
  const { front, calm } = sweep(chars.length, progress)
  return chars
    .map((char, i) => {
      if (i < calm || /\s/.test(char)) return char
      return i < front ? noise() : "•"
    })
    .join("")
}
