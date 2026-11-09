// How UI components run the browser's Effect program. main.tsx (the entry file, where Effect.run*
// is allowed) provides the real runner; components get it from context.
import type { Effect, Result } from "effect"
import { createContext } from "preact"
import { useContext } from "preact/hooks"
import type { SecretCrypto } from "../shared/crypto.ts"
import type { ApiClient } from "./api-client.ts"

type AppServices = ApiClient | SecretCrypto

/** Runs an effect; typed failures come back as a Result, defects reject the promise. */
export type Run = <A, E>(effect: Effect.Effect<A, E, AppServices>) => Promise<Result.Result<A, E>>

export const RunContext = createContext<Run | undefined>(undefined)

export const useRun = (): Run => {
  const run = useContext(RunContext)
  if (run === undefined) throw new Error("RunContext is missing")
  return run
}
