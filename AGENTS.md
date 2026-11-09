# Agent guide

`secret.tonytang.dev`: one-time secret links. What and why: [PRODUCT.md](PRODUCT.md). Words: [GLOSSARY.md](GLOSSARY.md), so use its terms (Secret, Link, Link key, Passphrase, Reveal, Burn, Expiry) in code, tests and copy, and avoid the words it lists under _Avoid_. Decisions: [docs/adr/](docs/adr/).

## Layout

One package, three folders:

- `src/shared`: code for both sides (API contract, schemas). Imports neither `worker` nor `web`.
- `src/worker`: the Cloudflare Worker. Never imports `web`. Only `src/worker/durable-object.ts` may use Cloudflare runtime types (`cloudflare:workers`, `DurableObjectState`, `caches`, …).
- `src/web`: the browser app. Never imports `worker`.
- `tools/`: plain-Node scripts and the local oxlint plugin (`tools/oxlint-plugin`).

Each folder is its own TypeScript program (`tsconfig.{shared,worker,web,tools}.json`). Tests (`*.test.ts`) belong to the tools program.

## Rules

- `npm run check` runs everything: typecheck, lint, the disable-reason check, format check, tests and knip. lefthook runs it on pre-commit and CI runs it on PRs and `main`. Zero warnings allowed.
- Always run lint as `effect-tsgo oxlint` (`npm run lint`). Plain `oxlint` rejects the config.
- In `src/shared` and `src/worker`, all of these are lint errors: `async`/`await`, `try`/`catch`, `throw`, `new Promise`, `any`, `as` casts (`as const` is fine), and `JSON.parse`. Use Effect (`Effect.gen`, `Effect.try`, `Effect.fail`, `Schema`) instead. `Effect.run*` is allowed only in entry files (`src/worker/index.ts`, `src/web/main.ts(x)`). `src/web` may use `async` where it calls into Effect.
- Every `oxlint-disable` comment needs `-- reason`. Unused disable comments are errors.
- Write tests first with `@effect/vitest` (`it.effect`).
- Versions are pinned exactly (`.npmrc` has `save-exact=true`). `typescript`, `oxlint`, `oxlint-tsgolint` and `@effect/tsgo` only work at matching versions, so check the supported-versions table in `@effect/tsgo`'s README before bumping any of them, and bump them together.
