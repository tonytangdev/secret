import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

describe("toolchain", () => {
  it.effect("runs an Effect test", () =>
    Effect.gen(function* () {
      const value = yield* Effect.succeed(1 + 1)
      expect(value).toBe(2)
    }),
  )
})
