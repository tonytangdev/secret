// The mark: tonytang.dev's glasses, with tinted lenses and a keyhole where each pupil was.
// public/favicon.svg is the same drawing on a teal tile.

const KEYHOLE = (cx: number) =>
  `M${String(cx - 2.4)} 28.5 L${String(cx - 4)} 38 H${String(cx + 4)} L${String(cx + 2.4)} 28.5Z`

export const Logo = ({ class: className = "" }: { readonly class?: string }) => (
  <svg viewBox="0 0 120 56" fill="none" aria-hidden="true" class={className}>
    <g fill="var(--color-teal)">
      <circle cx="34" cy="30" r="16" />
      <circle cx="86" cy="30" r="16" />
    </g>
    <g stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="34" cy="30" r="18" />
      <circle cx="86" cy="30" r="18" />
      <path d="M51 25 C 56 31, 64 31, 69 25" />
      <path d="M17 26 L 6 21" />
      <path d="M103 26 L 114 21" />
    </g>
    <g fill="var(--color-pop)">
      <circle cx="34" cy="27" r="4.5" />
      <path d={KEYHOLE(34)} />
      <circle cx="86" cy="27" r="4.5" />
      <path d={KEYHOLE(86)} />
    </g>
  </svg>
)
