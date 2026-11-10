// The mark: tonytang.dev's glasses, with tinted lenses and a keyhole where each pupil was.
// public/favicon.svg is the same drawing on a teal tile. The moods are animated in styles.css.
import { useEffect, useState } from "preact/hooks"

/**
 * What the glasses are up to: "idle" blinks now and then, "working" turns the keyholes like a
 * key in a lock, "shades" blacks the lenses out (a Secret is hidden), "peek" opens them wide.
 */
export type Mood = "idle" | "working" | "shades" | "peek"

const KEYHOLE = (cx: number) =>
  `M${String(cx - 2.4)} 28.5 L${String(cx - 4)} 38 H${String(cx + 4)} L${String(cx + 2.4)} 28.5Z`

const SHINE = (cx: number) => `M${String(cx - 11)} 24 A 13 13 0 0 1 ${String(cx - 4)} 18.5`

const Eye = ({ cx }: { readonly cx: number }) => (
  <g class="logo-eye">
    <circle cx={cx} cy="27" r="4.5" />
    <path d={KEYHOLE(cx)} />
  </g>
)

export const Logo = ({
  class: className = "",
  mood = "idle",
}: {
  readonly class?: string
  readonly mood?: Mood
}) => (
  <svg
    viewBox="0 0 120 56"
    fill="none"
    aria-hidden="true"
    data-mood={mood}
    class={`logo ${className}`}
  >
    <g class="logo-frame">
      <g fill="var(--color-teal)">
        <circle cx="34" cy="30" r="16" />
        <circle cx="86" cy="30" r="16" />
      </g>
      <g class="logo-shade" fill="var(--color-ink-fixed)">
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
        <Eye cx={34} />
        <Eye cx={86} />
      </g>
      <g class="logo-shine" stroke="var(--color-cream)" stroke-width="2.5" stroke-linecap="round">
        <path d={SHINE(34)} />
        <path d={SHINE(86)} />
      </g>
    </g>
  </svg>
)

// The header's glasses copy whatever the page's Mascot is doing.
let mascotMood: Mood = "idle"
const listeners = new Set<() => void>()
const setMascotMood = (mood: Mood) => {
  mascotMood = mood
  for (const listener of listeners) listener()
}

/** The mood of the page's Mascot, or "idle" when the page has none. */
export const useMascotMood = () => {
  const [mood, setMood] = useState(mascotMood)
  useEffect(() => {
    const listener = () => {
      setMood(mascotMood)
    }
    listeners.add(listener)
    listener()
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return mood
}

/** The big glasses that react to what's happening to the Secret. Show one at a time. */
export const Mascot = ({
  mood,
  class: className = "w-20",
}: {
  readonly mood: Mood
  readonly class?: string
}) => {
  useEffect(() => {
    setMascotMood(mood)
    return () => {
      setMascotMood("idle")
    }
  }, [mood])
  return <Logo mood={mood} class={`shrink-0 text-ink-strong ${className}`} />
}
