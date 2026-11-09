# Product

`secret.tonytang.dev`: send a password (or any short secret) to someone through a link that works once and then is gone. The server never sees the secret.

The first of a series of small tools Tony builds for himself and publishes in case others find them useful. Listed under `/apps` on tonytang.dev.

## Users

Primary: Tony. Secondary: anyone who lands on it. No accounts, no sign-up.

## What v1 does

- **Send:** paste text (max ~10 KB), pick expiry (1h, **1d** default, 7d), optionally add a passphrase. Get a link `secret.tonytang.dev/s/<id>#<key>` and copy it.
- **Receive:** the link opens a page with a **Reveal** button. Only clicking it fetches and burns the secret (link-preview bots can't use it up). If there's a passphrase, the recipient can retry it as many times as needed in the same tab.
- **After reveal:** the secret is hidden by default, with show and copy buttons ("Copied"). The page says the secret now exists only in this tab.
- **Gone:** one message for "doesn't exist, already viewed, or expired", plus "If you didn't open it, tell the sender — someone else may have."
- **`/how-it-works`:** what is and isn't protected, how the encryption works, a link to the source.

The main page explains the security in three steps: _Encrypted in your browser → Key never leaves the link → Deleted after one read._

## Not in v1

Files, multi-read links, read receipts, sender-side delete, accounts, French, payments. The only payment is an optional "Support me" link to GitHub Sponsors, in the footer and the "Is it free?" answer. Paid extras may come later.

## Security promises (each must be true in code and backed by a test)

1. The secret is encrypted in the browser (AES-256-GCM, WebCrypto). The key exists only in the URL fragment.
2. The server stores only ciphertext, IV, optional salt, a has-passphrase flag, and the expiry time.
3. A secret can be read once, even if two requests arrive together.
4. Expired secrets are deleted.
5. No third-party code runs on the page. No browser analytics. Secret IDs are never logged.

## Stack

- One Cloudflare Worker on `secret.tonytang.dev`: static assets (SPA fallback), `/api/*`, one Durable Object per secret (atomic read-and-delete, alarm for expiry).
- Vite + Preact (`.tsx`) + `preact-iso` + Tailwind v4. Routes: `/`, `/s/:id`, `/how-it-works`.
- Effect v4: one `HttpApi` + `Schema` contract in `src/shared`, implemented by the Worker; the browser uses a typed client derived from it. `SecretCrypto` and `SecretStore` services; `SecretStore` has Durable Object and in-memory implementations.
- Layout: one package with `src/shared`, `src/worker`, `src/web`.
- Headers: strict CSP (`default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, no inline scripts), `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on the API. Self-hosted fonts.
- Rate limiting: Cloudflare rate limiting per IP (about 20 secrets created per hour); payloads over the size cap are rejected.
- Usage counts (created / revealed / expired) in Workers Analytics Engine.

## Code quality

- TypeScript 7.0.2 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`.
- Typecheck: `effect-tsgo tsc`. Lint: `effect-tsgo oxlint --type-aware`, with Effect diagnostics as errors.
- Lint rules: equivalents of typescript-eslint's strict type-checked rules, `switch-exhaustiveness-check`, `eqeqeq`, no nested ternaries, `no-console`, `max-lines` 300, `max-depth` 3.
- In `src/shared` and `src/worker`: no `async`/`await`, `try`/`catch`, `throw`, `new Promise`, `any`, `as` casts (except `as const`), or `JSON.parse`. `Effect.run*` only in entry files. `src/web/ui` may use `async` where it calls into Effect.
- Folder boundaries with `no-restricted-imports`: `shared` imports neither `worker` nor `web`; `web` and `worker` never import each other; only `worker/durable-object.ts` uses Cloudflare runtime types.
- Every `oxlint-disable` needs a `-- reason` (checked by a script) and unused disable comments are reported.
- Formatting with oxfmt; dead code with knip.
- Versions pinned exactly. TypeScript, oxlint, oxlint-tsgolint and `@effect/tsgo` upgrade together as one Renovate group.
- Tests written first with `@effect/vitest`: crypto round trip (with and without passphrase, wrong passphrase fails), read-once under concurrent requests, expiry, size limit. UI tested by hand.
- Checks (typecheck, lint with zero warnings, tests, knip) run on lefthook pre-commit and in GitHub Actions. CI deploys to production with `wrangler deploy` on `main`. No staging.

## Brand

Follows tonytang.dev's `DESIGN.md` (teal / cream / yellow tokens, Bricolage Grotesque, Public Sans, JetBrains Mono), with design tokens copied rather than shared until the third tool. Light/dark follows the system until the header toggle picks one (saved in `localStorage`, applied by `public/boot.js` before first paint). The logo is tonytang.dev's glasses with keyholes for pupils (`src/web/logo.tsx`, `public/favicon.svg`). Copy is short, first-person and plain-spoken, like the site. The footer links back to tonytang.dev `/apps`.

## Repo

Public `tonytangdev/secret`, AGPL-3.0. A CLA is required before accepting outside contributions. Once shipped, `/how-it-works` becomes the base for an article or video.

Decisions with trade-offs are recorded in `docs/adr/`.
