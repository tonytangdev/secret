import { Result } from "effect"
import { useState } from "preact/hooks"
import { DEFAULT_EXPIRY, EXPIRY_LABEL, Expiry } from "../../shared/expiry.ts"
import { type Link, linkPath } from "../../shared/link.ts"
import { CopyButton } from "../copy-button.tsx"
import { Encrypting, holdDone, scrambleDone, useInView } from "../encrypting.tsx"
import { FAILURE_COPY, failureOf } from "../failure-copy.ts"
import { FIELD_CLASS } from "../field.ts"
import { Mascot } from "../logo.tsx"
import { useRun } from "../run.ts"
import { sendSecret } from "../secret-flow.ts"
import { HomeGuide } from "./home-guide.tsx"
import { MAX_SECRET_BYTES, MAX_SECRET_LABEL, secretBytes } from "../../shared/limits.ts"

/** Why the last attempt didn't create a Link: a typed failure, or "sendFailed" (network, server). */
type Failure = "SecretEmpty" | "SecretTooLarge" | "RateLimited" | "sendFailed"

const sendFailure = (error: { readonly _tag: string } | undefined): Failure =>
  failureOf(error, ["SecretEmpty", "SecretTooLarge", "RateLimited"], "sendFailed")

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${String(bytes)} bytes` : `${(Math.ceil(bytes / 102.4) / 10).toFixed(1)} KB`

type State =
  | { readonly step: "editing"; readonly failure: Failure | null }
  | { readonly step: "creating"; readonly stored: boolean }
  | {
      readonly step: "created"
      readonly url: string
      readonly expiry: Expiry
      readonly hasPassphrase: boolean
    }

const linkUrl = (link: Link) => `${location.origin}${linkPath(link)}`

export const Home = () => {
  const run = useRun()
  const [state, setState] = useState<State>({ step: "editing", failure: null })
  const [plaintext, setPlaintext] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [expiry, setExpiry] = useState<Expiry>(DEFAULT_EXPIRY)
  const used = secretBytes(plaintext)
  const tooLarge = used > MAX_SECRET_BYTES

  const create = async (event: Event) => {
    event.preventDefault()
    const started = performance.now()
    setState({ step: "creating", stored: false })
    const options = passphrase === "" ? { expiry } : { expiry, passphrase }
    // A rejected run is a defect (e.g. the network died mid-request): "sendFailed" like any other.
    const result = await run(sendSecret(plaintext, options)).catch(() => undefined)
    if (result === undefined) {
      setState({ step: "editing", failure: "sendFailed" })
    } else if (Result.isSuccess(result)) {
      setPlaintext("")
      setPassphrase("")
      // Let the animation finish and show its last check before the Link replaces it.
      await scrambleDone(started)
      setState({ step: "creating", stored: true })
      await holdDone()
      setState({
        step: "created",
        url: linkUrl(result.success),
        expiry,
        hasPassphrase: result.success.hasPassphrase,
      })
    } else {
      setState({ step: "editing", failure: sendFailure(result.failure) })
    }
  }

  return (
    <>
      <section class="grid items-start gap-lg lg:grid-cols-[1fr_1.1fr] lg:gap-[4rem]">
        <div class="lg:sticky lg:top-28">
          <p class="font-mono text-label uppercase text-accent-strong">
            Free · No sign-up · Open source
          </p>
          <h1 class="mt-sm font-display text-[clamp(2.6rem,6vw,4.2rem)] leading-[1] font-extrabold tracking-[-0.035em] text-ink-strong">
            Send secrets online. <span class="highlight">Once.</span>
          </h1>
          <p class="mt-md text-body text-muted">
            Paste a password, an API key or anything private. You get a link that reveals it one
            time, then the secret is gone for good.
          </p>
          <ol class="mt-lg space-y-sm">
            {STEPS.map(([title, detail], i) => (
              <li key={title} class="flex gap-sm">
                <span class="grid size-8 shrink-0 place-items-center rounded-full bg-teal font-mono text-label text-cream">
                  {i + 1}
                </span>
                <span>
                  <span class="block font-display text-[1.1rem] font-bold text-ink-strong">
                    {title}
                  </span>
                  <span class="block text-[0.98rem] leading-snug text-muted">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <p class="mt-md text-[0.98rem]">
            <a class="text-accent-strong underline" href="/how-it-works">
              How it works, and what it can't protect
            </a>
          </p>
        </div>
        <div class="card relative isolate overflow-hidden p-md sm:p-lg">
          {state.step === "creating" ? <Encrypting stored={state.stored} /> : null}
          {state.step === "created" ? (
            <Created
              url={state.url}
              expiry={state.expiry}
              hasPassphrase={state.hasPassphrase}
              onAnother={() => {
                setState({ step: "editing", failure: null })
              }}
            />
          ) : (
            <form
              class="space-y-md"
              inert={state.step === "creating"}
              onSubmit={(event) => {
                void create(event)
              }}
            >
              <div class="space-y-xs">
                <label for="secret" class="block font-mono text-label uppercase text-muted">
                  Your secret
                </label>
                <textarea
                  id="secret"
                  required
                  rows={7}
                  autocomplete="off"
                  spellcheck={false}
                  placeholder="Paste a password, API key, recovery code…"
                  aria-describedby="secret-size"
                  value={plaintext}
                  onInput={(e) => {
                    setPlaintext(e.currentTarget.value)
                  }}
                  class={`${FIELD_CLASS} resize-y`}
                />
                <p
                  id="secret-size"
                  aria-live="polite"
                  class={`text-right font-mono text-label ${tooLarge ? "font-bold text-ink-strong" : "text-muted"}`}
                >
                  {formatSize(used)} of {MAX_SECRET_LABEL} used
                  {tooLarge ? ". Too large to send." : ""}
                </p>
              </div>
              <ExpiryPicker value={expiry} onChange={setExpiry} />
              <PassphraseField value={passphrase} onInput={setPassphrase} />
              {state.step === "editing" && state.failure !== null ? (
                <p role="alert" class="text-body text-ink">
                  {FAILURE_COPY[state.failure].body}
                </p>
              ) : null}
              <button
                type="submit"
                class="btn w-full"
                disabled={state.step === "creating" || tooLarge || plaintext.trim() === ""}
              >
                {state.step === "creating" ? "Encrypting…" : "Create link"}
              </button>
            </form>
          )}
        </div>
      </section>
      <HomeGuide />
    </>
  )
}

/** The security in three steps, in order (PRODUCT.md). */
const STEPS = [
  ["Encrypted in your browser", "AES-256 runs on your device. My server only gets ciphertext."],
  ["Key never leaves the link", "It sits after the # in the link, which browsers never send."],
  ["Deleted after one read", "Revealing it burns it. Unrevealed, it expires on its own."],
] as const

const PassphraseField = ({
  value,
  onInput,
}: {
  readonly value: string
  readonly onInput: (value: string) => void
}) => (
  <div class="space-y-xs">
    <label for="passphrase" class="block font-mono text-label uppercase text-muted">
      Passphrase (optional)
    </label>
    <input
      id="passphrase"
      type="text"
      autocomplete="off"
      spellcheck={false}
      aria-describedby="passphrase-hint"
      value={value}
      onInput={(e) => {
        onInput(e.currentTarget.value)
      }}
      class={FIELD_CLASS}
    />
    <p id="passphrase-hint" class="text-[0.95rem] leading-snug text-muted">
      Share it through a different channel than the link, e.g. say it on a call.
    </p>
  </div>
)

const ExpiryPicker = ({
  value,
  onChange,
}: {
  readonly value: Expiry
  readonly onChange: (expiry: Expiry) => void
}) => (
  <fieldset>
    <legend class="mb-xs font-mono text-label uppercase text-muted">
      Expires if unrevealed in
    </legend>
    <div class="segment">
      {Expiry.literals.map((option) => (
        <label key={option}>
          <input
            type="radio"
            name="expiry"
            value={option}
            checked={value === option}
            onChange={() => {
              onChange(option)
            }}
          />
          {EXPIRY_LABEL[option]}
        </label>
      ))}
    </div>
  </fieldset>
)

const Created = ({
  url,
  expiry,
  hasPassphrase,
  onAnother,
}: {
  readonly url: string
  readonly expiry: Expiry
  readonly hasPassphrase: boolean
  readonly onAnother: () => void
}) => (
  <div ref={useInView()} class="animate-rise scroll-mt-24 space-y-sm">
    <div class="flex items-center justify-between gap-sm">
      <p class="font-display text-title text-ink-strong">Your link is ready.</p>
      <Mascot mood="shades" />
    </div>
    <label for="link" class="block font-mono text-label uppercase text-muted">
      Your link
    </label>
    <input
      id="link"
      readOnly
      value={url}
      onFocus={(e) => {
        e.currentTarget.select()
      }}
      class={FIELD_CLASS}
    />
    <p class="text-body text-muted">
      It works once, then the secret is gone. Unrevealed, it expires in {EXPIRY_LABEL[expiry]}.
    </p>
    <p class="text-body text-muted">
      {hasPassphrase
        ? "Passphrase set: send it separately, not next to the link."
        : "No passphrase: the link alone unlocks the secret."}
    </p>
    <div class="flex flex-wrap gap-sm">
      <CopyButton text={url} label="Copy link" />
      <button type="button" class="ghost" onClick={onAnother}>
        Create another
      </button>
    </div>
  </div>
)
