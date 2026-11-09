import { Result } from "effect"
import { useState } from "preact/hooks"
import { DEFAULT_EXPIRY, EXPIRY_LABEL, Expiry } from "../../shared/expiry.ts"
import { type Link, linkPath } from "../../shared/link.ts"
import { CopyButton } from "../copy-button.tsx"
import { FAILURE_COPY, failureOf } from "../failure-copy.ts"
import { FIELD_CLASS } from "../field.ts"
import { useRun } from "../run.ts"
import { sendSecret } from "../secret-flow.ts"
import { MAX_SECRET_BYTES, MAX_SECRET_LABEL, secretBytes } from "../../shared/limits.ts"

/** Why the last attempt didn't create a Link: a typed failure, or "sendFailed" (network, server). */
type Failure = "SecretEmpty" | "SecretTooLarge" | "RateLimited" | "sendFailed"

const sendFailure = (error: { readonly _tag: string } | undefined): Failure =>
  failureOf(error, ["SecretEmpty", "SecretTooLarge", "RateLimited"], "sendFailed")

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${String(bytes)} bytes` : `${(Math.ceil(bytes / 102.4) / 10).toFixed(1)} KB`

type State =
  | { readonly step: "editing"; readonly failure: Failure | null }
  | { readonly step: "creating" }
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
    setState({ step: "creating" })
    const options = passphrase === "" ? { expiry } : { expiry, passphrase }
    // A rejected run is a defect (e.g. the network died mid-request): "sendFailed" like any other.
    const result = await run(sendSecret(plaintext, options)).catch(() => undefined)
    if (result === undefined) {
      setState({ step: "editing", failure: "sendFailed" })
    } else if (Result.isSuccess(result)) {
      setPlaintext("")
      setPassphrase("")
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
    <section>
      <h1 class="text-headline text-ink-strong">Send a secret once.</h1>
      <ol class="mt-md space-y-xs font-mono text-label uppercase text-muted">
        <li>1 · Encrypted in your browser</li>
        <li>2 · Key never leaves the link</li>
        <li>3 · Deleted after one read</li>
      </ol>
      <p class="mt-xs text-body text-muted">
        <a class="text-accent-strong underline" href="/how-it-works">
          How it works, and what it can't protect
        </a>
      </p>
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
          class="mt-lg space-y-sm"
          onSubmit={(event) => {
            void create(event)
          }}
        >
          <label for="secret" class="block font-mono text-label uppercase text-muted">
            Your secret
          </label>
          <textarea
            id="secret"
            required
            rows={6}
            autocomplete="off"
            spellcheck={false}
            aria-describedby="secret-size"
            value={plaintext}
            onInput={(e) => {
              setPlaintext(e.currentTarget.value)
            }}
            class={FIELD_CLASS}
          />
          <p
            id="secret-size"
            aria-live="polite"
            class={`font-mono text-label ${tooLarge ? "font-bold text-ink-strong" : "text-muted"}`}
          >
            {formatSize(used)} of {MAX_SECRET_LABEL} used
            {tooLarge ? ". Too large to send." : ""}
          </p>
          <ExpiryPicker value={expiry} onChange={setExpiry} />
          <PassphraseField value={passphrase} onInput={setPassphrase} />
          {state.step === "editing" && state.failure !== null ? (
            <p role="alert" class="text-body text-ink">
              {FAILURE_COPY[state.failure].body}
            </p>
          ) : null}
          <button
            type="submit"
            class="btn"
            disabled={state.step === "creating" || tooLarge || plaintext.trim() === ""}
          >
            {state.step === "creating" ? "Encrypting…" : "Create link"}
          </button>
        </form>
      )}
    </section>
  )
}

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
    <p id="passphrase-hint" class="text-body text-muted">
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
  <fieldset class="flex flex-wrap items-center gap-sm">
    <legend class="mb-xs font-mono text-label uppercase text-muted">
      Expires if unrevealed in
    </legend>
    {Expiry.literals.map((option) => (
      <label key={option} class="flex items-center gap-xs text-body text-ink">
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
  <div class="mt-lg space-y-sm">
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
