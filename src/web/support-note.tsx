export const SPONSORS_URL = "https://github.com/sponsors/tonytangdev"
const COFFEE_URL = "https://buymeacoffee.com/tonytangdev"

/** A steaming cup; styles.css lets it steam and wiggle once the note slides in. */
const Cup = () => (
  <svg viewBox="4 11 25 19" fill="none" aria-hidden="true" class="support-cup h-7 w-9 shrink-0">
    <g class="support-steam" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M11 11 C 9.5 9, 12.5 7.5, 11 5" />
      <path d="M16 11 C 14.5 9, 17.5 7.5, 16 5" />
      <path d="M21 11 C 19.5 9, 22.5 7.5, 21 5" />
    </g>
    <g class="support-mug">
      <path d="M6 14 H24 V21 A6 6 0 0 1 18 27 H12 A6 6 0 0 1 6 21 Z" fill="var(--color-pop)" />
      <path
        d="M6 14 H24 V21 A6 6 0 0 1 18 27 H12 A6 6 0 0 1 6 21 Z M24 16 H25.5 A3 3 0 0 1 25.5 22 H23.6"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
    </g>
  </svg>
)

/** A quiet ask shown once the app has done its job: a Link made, or a Secret revealed. */
export const SupportNote = ({ class: className = "" }: { readonly class?: string }) => (
  <p
    class={`support-note flex items-center gap-sm border-t border-line pt-md text-[0.95rem] leading-snug text-muted ${className}`}
  >
    <Cup />
    <span>
      Free, with no ads or trackers. If it helped you,{" "}
      <a class="text-accent-strong underline" href={COFFEE_URL}>
        buy me a coffee
      </a>
      .
    </span>
  </p>
)
