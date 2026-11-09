# oxlint (type-aware) instead of ESLint

typescript-eslint does not support TypeScript 7 (its issue #12518 was closed until TS 7 ships an API). oxlint + oxlint-tsgolint is stable on TS 7 and implements the strict type-checked rules we need, and `@effect/tsgo` adds Effect's diagnostics to both `tsc` and oxlint.

## Consequences

- Folder boundaries use native `no-restricted-imports` per folder, not `eslint-plugin-boundaries`.
- The `eslint-comments/require-description` JS plugin crashes under oxlint, so a small script enforces a `-- reason` on every disable comment.
- TypeScript, oxlint, oxlint-tsgolint and `@effect/tsgo` only work together at specific versions, so they are pinned exactly and upgraded as one group.
