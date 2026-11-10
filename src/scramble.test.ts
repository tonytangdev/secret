// The glyphs behind the "Encrypting…" animation on the main page. Decoration only: the real
// encryption is SecretCrypto's (see secret-flow.test.ts).
import { describe, expect, it } from "@effect/vitest"
import { decodeFrame, scrambleFrame, unscrambleFrame } from "./web/scramble.ts"

const settled = "ABCDEFGHIJKLMNOPQRST"
const noise = () => "#"

describe("scrambleFrame", () => {
  it("starts as all dots, the same length as the settled glyphs", () => {
    expect(scrambleFrame(settled, 0, noise)).toEqual({ encrypted: "", waiting: "•".repeat(20) })
  })

  it("ends as exactly the settled glyphs", () => {
    expect(scrambleFrame(settled, 1, noise)).toEqual({ encrypted: settled, waiting: "" })
  })

  it("flickers just behind the front and settles further back", () => {
    const { encrypted, waiting } = scrambleFrame(settled, 0.5, noise)
    expect(encrypted).toMatch(/^[A-Z]+#+$/)
    expect(settled.startsWith(encrypted.replace(/#+$/, ""))).toBe(true)
    expect(waiting).toMatch(/^•+$/)
    expect(encrypted.length + waiting.length).toBe(settled.length)
  })

  it("clamps progress outside 0..1", () => {
    expect(scrambleFrame(settled, -1, noise).encrypted).toBe("")
    expect(scrambleFrame(settled, 7, noise).encrypted).toBe(settled)
  })
})

describe("unscrambleFrame", () => {
  it("starts as the glyphs and ends as all dots", () => {
    expect(unscrambleFrame(settled, 0, noise)).toEqual({ decrypted: "", waiting: settled })
    expect(unscrambleFrame(settled, 1, noise)).toEqual({ decrypted: "•".repeat(20), waiting: "" })
  })

  it("keeps its length while the front sweeps", () => {
    const { decrypted, waiting } = unscrambleFrame(settled, 0.5, noise)
    expect(decrypted).toMatch(/^•+$/)
    expect(waiting).toMatch(/^#+[A-Z]+$/)
    expect(settled.endsWith(waiting.replace(/^#+/, ""))).toBe(true)
    expect(decrypted.length + waiting.length).toBe(settled.length)
  })
})

describe("decodeFrame", () => {
  const secret = "hunter2 hunter2\nhunter2 é🙂"

  it("ends as exactly the Secret", () => {
    expect(decodeFrame(secret, 1, noise)).toBe(secret)
  })

  it("starts as dots that keep the Secret's whitespace", () => {
    expect(decodeFrame(secret, 0, noise)).toBe("••••••• •••••••\n••••••• ••")
  })

  it("resolves left to right: real characters, then noise, then dots", () => {
    expect(decodeFrame(secret, 0.5, noise)).toMatch(/^hunter2 [a-z0-9]*#[#\s]*[•\s]*$/)
  })
})
