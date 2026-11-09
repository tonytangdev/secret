import { it } from "@effect/vitest"
import { secretStoreContract } from "../testing/secret-store-contract.ts"
import { SecretStoreMemory } from "./secret-store-memory.ts"

secretStoreContract("in memory", SecretStoreMemory, it.effect)
