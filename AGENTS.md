# Agent guide

`secret.tonytang.dev`: one-time secret links. What and why: [PRODUCT.md](PRODUCT.md). Words: [GLOSSARY.md](GLOSSARY.md), so use its terms (Secret, Link, Link key, Passphrase, Reveal, Burn, Expiry) in code, tests and copy, and avoid the words it lists under _Avoid_. Decisions: [docs/adr/](docs/adr/).

## Layout

One package, three folders:

- `src/shared`: code for both sides (API contract, schemas). Imports neither `worker` nor `web`.
- `src/worker`: the Cloudflare Worker. Never imports `web`. Only `src/worker/durable-object.ts` may use Cloudflare runtime types (`cloudflare:workers`, `DurableObjectState`, `caches`, …).
- `src/web`: the browser app. Never imports `worker`.
- `tools/`: plain-Node scripts and the local oxlint plugin (`tools/oxlint-plugin`).

Build and run: `npm run dev` (Vite + Worker in workerd), `npm run build` (writes `dist/client` and `dist/secret`), `npm run preview` (the build in workerd). Cloudflare sends only `/api/*` to the Worker (`run_worker_first`); everything else is a static asset with SPA fallback. Asset headers come from `_headers`, which `vite.config.ts` generates from `SECURITY_HEADERS` in `src/shared/security-headers.ts`, so change headers there. `/` and `/how-it-works` are prerendered at build time (`prerender` in `src/web/main.tsx`; titles, descriptions and the sitemap come from `src/web/seo.ts`); other paths get `index.html` and render client-side. Merges to `main` deploy via CI (`wrangler deploy`); never deploy by hand.

Worker secrets: `IP_HASH_KEY`, the HMAC key that turns client IPs into rate-limit keys. Before the first deploy, set it once with `wrangler secret put IP_HASH_KEY` (a long random value, e.g. `openssl rand -base64 32`); without it, creating a Secret fails. Locally, copy `.dev.vars.example` to `.dev.vars`. Tests set their own value. Read it only in `src/worker/durable-object.ts` (`ClientKeyFromEnv`).

Each folder is its own TypeScript program (`tsconfig.{shared,worker,web,tools}.json`). Tests (`*.test.ts`) belong to the tools program and run in Node; `*.workers.test.ts` run inside workerd (Cloudflare Vitest pool, real Durable Objects) and have their own program (`tsconfig.workers-test.json`), which may import `cloudflare:*`.

## Rules

- `npm run check` runs everything: typecheck, lint, the disable-reason check, format check, tests and knip. lefthook runs it on pre-commit and CI runs it on PRs and `main`. Zero warnings allowed.
- Always run lint as `effect-tsgo oxlint` (`npm run lint`). Plain `oxlint` rejects the config.
- In `src/shared` and `src/worker`, all of these are lint errors: `async`/`await`, `try`/`catch`, `throw`, `new Promise`, `any`, `as` casts (`as const` is fine), and `JSON.parse`. Use Effect (`Effect.gen`, `Effect.try`, `Effect.fail`, `Schema`) instead. `Effect.run*` is allowed only in entry files (`src/worker/index.ts`, `src/web/main.ts(x)`). `src/web` may use `async` where it calls into Effect.
- Every `oxlint-disable` comment needs `-- reason`. Unused disable comments are errors.
- Write tests first with `@effect/vitest` (`it.effect`). `npm test` runs `vite build` first because `src/built-app.test.ts` tests the built app under `vite preview`.
- The CSP forbids inline scripts and `data:` URIs: no `dangerouslySetInnerHTML`, no inline `<script>` (the one exception: JSON-LD data blocks from `src/web/seo.ts`, which browsers never run), keep `assetsInlineLimit: 0`, and load nothing from other origins.
- Versions are pinned exactly (`.npmrc` has `save-exact=true`). `typescript`, `oxlint`, `oxlint-tsgolint` and `@effect/tsgo` only work at matching versions, so check the supported-versions table in `@effect/tsgo`'s README before bumping any of them, and bump them together.
