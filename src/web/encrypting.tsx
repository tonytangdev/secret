// The short animations around a Secret: encrypting it (main page), decrypting it and showing it
// (Reveal page). The steps they tick off are the real ones (secret-flow.ts); only the glyphs are
// decoration, and the pacing is slowed to be readable.
import { useEffect, useRef, useState } from "preact/hooks"
import { CheckIcon } from "./check-icon.tsx"
import { Mascot, type Mood } from "./logo.tsx"
import { decodeFrame, scrambleFrame, unscrambleFrame } from "./scramble.ts"

/** How long the glyphs take to sweep across. Real encryption takes a few milliseconds. */
const SCRAMBLE_MS = 1300
/** How long the finished checklist stays before the result replaces it. */
const HOLD_MS = 650
/** How long a hidden Secret takes to resolve when shown. */
const DECODE_MS = 500
/** How long a shown Secret takes to turn back into dots. Short: hiding shouldn't wait. */
const HIDE_MS = 280
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
/** A fixed count, so the animation says nothing about the Secret's length. */
const GLYPH_COUNT = 128

// Math.random is fine here: these glyphs are for show and never leave the page.
const glyph = () => GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length))

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, Math.max(0, ms))
  })

/** Resolves once the scramble that began at `started` (performance.now) has finished. */
export const scrambleDone = (started: number) =>
  reducedMotion() ? Promise.resolve() : sleep(SCRAMBLE_MS - (performance.now() - started))

/** Resolves once the finished checklist has been on screen long enough to read. */
export const holdDone = () => sleep(reducedMotion() ? 0 : HOLD_MS)

/** Scrolls the element into view once, if it isn't already (the form can be taller than a phone). */
export const useInView = () => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest" })
  }, [])
  return ref
}

/** 0 → 1 over `ms` from mount, one update per animation frame. */
const useProgress = (ms: number) => {
  const [progress, setProgress] = useState(() => (reducedMotion() ? 1 : 0))
  useEffect(() => {
    if (reducedMotion()) return
    const started = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const next = Math.min(1, (now - started) / ms)
      setProgress(next)
      if (next < 1) frame = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [ms])
  return progress
}

/** The bar's width, in steps (classes, since the CSP has no inline styles). */
const progressScale = (progress: number) => {
  if (progress < 0.25) return "scale-x-[0.1]"
  if (progress < 0.5) return "scale-x-[0.3]"
  if (progress < 0.75) return "scale-x-50"
  return "scale-x-[0.8]"
}

const Step = ({ done, children }: { readonly done: boolean; readonly children: string }) => (
  <li class={`flex items-center gap-xs ${done ? "text-ink-strong" : "text-muted"}`}>
    {done ? (
      <CheckIcon class="size-5 rounded-full bg-teal p-[3px] text-cream" />
    ) : (
      <span
        aria-hidden="true"
        class="size-5 shrink-0 rounded-full border-2 border-line-strong border-t-accent motion-safe:animate-spin"
      />
    )}
    <span class="text-[0.98rem] leading-snug">{children}</span>
  </li>
)

/** The glyph box, the bar and the checklist. `finished`: every step is done. */
const Panel = ({
  title,
  mood,
  finished,
  progress,
  children,
  steps,
}: {
  readonly title: string
  readonly mood: Mood
  readonly finished: boolean
  readonly progress: number
  /** The glyph box's content. */
  readonly children: preact.ComponentChildren
  readonly steps: ReadonlyArray<readonly [label: string, done: boolean]>
}) => (
  <div ref={useInView()} class="w-full scroll-mt-24 space-y-md">
    <div class="flex items-center justify-between gap-sm">
      <p role="status" class="font-display text-title text-ink-strong">
        {title}
      </p>
      <Mascot mood={mood} />
    </div>
    <p
      aria-hidden="true"
      class="h-[7.4em] overflow-hidden rounded-md border border-line-strong bg-surface-2 p-sm font-mono text-[0.85rem] leading-[1.45] break-all"
    >
      {children}
    </p>
    <div class="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
      <div
        class={`h-full w-full origin-left rounded-full bg-pop transition-transform duration-300 ease-brand ${finished ? "scale-x-100" : progressScale(progress)}`}
      />
    </div>
    <ol class="space-y-xs">
      {steps.map(([label, done]) => (
        <Step key={label} done={done}>
          {label}
        </Step>
      ))}
    </ol>
  </div>
)

const useGlyphs = () => useState(() => Array.from({ length: GLYPH_COUNT }, glyph).join(""))[0]

/** Covers the form while a Secret is encrypted and stored. `stored`: the server has the ciphertext. */
export const Encrypting = ({ stored }: { readonly stored: boolean }) => {
  const progress = useProgress(SCRAMBLE_MS)
  const { encrypted, waiting } = scrambleFrame(useGlyphs(), progress, glyph)
  const encryptedDone = progress >= 1
  return (
    <div class="absolute inset-0 z-10 grid animate-fade place-items-center bg-surface p-md sm:p-lg">
      <Panel
        title={stored ? "Encrypted." : "Encrypting…"}
        mood={stored ? "shades" : "working"}
        finished={stored}
        progress={progress}
        steps={[
          ["Link key made on your device", progress >= 0.3],
          ["Secret encrypted with AES-256-GCM", encryptedDone],
          ["Ciphertext stored, Link key kept out of it", encryptedDone && stored],
        ]}
      >
        <span class="text-accent-strong">{encrypted}</span>
        <span class="text-line-strong">{waiting}</span>
      </Panel>
    </div>
  )
}

/** Plays once a Secret has been taken and unlocked, before it's handed over (still hidden). */
export const Decrypting = ({ hasPassphrase }: { readonly hasPassphrase: boolean }) => {
  const progress = useProgress(SCRAMBLE_MS)
  const { decrypted, waiting } = unscrambleFrame(useGlyphs(), progress, glyph)
  const done = progress >= 1
  return (
    <section class="card animate-fade p-md sm:p-lg">
      <Panel
        title={done ? "Decrypted." : "Decrypting…"}
        mood={done ? "peek" : "working"}
        finished={done}
        progress={progress}
        steps={[
          ["Ciphertext taken, then burned on the server", true],
          [
            hasPassphrase ? "Passphrase and Link key checked" : "Link key read from the link",
            progress >= 0.3,
          ],
          ["Secret decrypted in this tab", done],
        ]}
      >
        <span class="text-ink-strong">{decrypted}</span>
        <span class="text-accent-strong">{waiting}</span>
      </Panel>
    </section>
  )
}

/**
 * A Secret being shown: its characters resolve out of dots. With `hiding` it plays backwards,
 * faster, and calls `onHidden` when only dots are left. Mount it (or change its key) to play.
 */
export const Decoded = ({
  secret,
  hiding,
  onHidden,
}: {
  readonly secret: string
  readonly hiding: boolean
  readonly onHidden: () => void
}) => {
  const progress = useProgress(hiding ? HIDE_MS : DECODE_MS)
  const hidden = hiding && progress >= 1
  useEffect(() => {
    if (hidden) onHidden()
  }, [hidden, onHidden])
  return <>{decodeFrame(secret, hiding ? 1 - progress : progress, glyph)}</>
}
