# TypeScript 7 with Vite + Preact, not Astro

tonytang.dev uses Astro, so Astro would be the obvious choice here. We chose TypeScript 7 (native `tsc`), and Astro's tooling cannot use TS 7 yet; oxlint's type-aware rules also don't cover `.astro` files. With Vite + Preact, every file is `.ts`/`.tsx`, so the compiler, linter and Effect diagnostics cover all of the code. The brand comes from tokens copied out of tonytang.dev's `DESIGN.md`, not from the framework.
