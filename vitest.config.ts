import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

// Two projects: node for everything else, workerd for tests that need real Durable Objects.
// Keep the cloudflare() Vite plugin out of this file (it clashes with the Vitest server).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.workers.test.ts"],
        },
      },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
        test: { name: "workers", include: ["src/**/*.workers.test.ts"] },
      },
    ],
  },
})
