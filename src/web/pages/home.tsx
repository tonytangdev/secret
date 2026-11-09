import { Result } from "effect"
import { useState } from "preact/hooks"
import { DEFAULT_EXPIRY, EXPIRY_LABEL, Expiry } from "../../shared/expiry.ts"
import { type Link, linkPath } from "../../shared/link.ts"
import { CopyButton } from "../copy-button.tsx"
import { useRun } from "../run.ts"
import { sendSecret } from "../secret-flow.ts"

type State =
  | { readonly step: "editing"; readonly failed: boolean }
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
  const [state, setState] = useState<State>({ step: "editing", failed: false })
  const [plaintext, setPlaintext] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [expiry, setExpiry] = useState<Expiry>(DEFAULT_EXPIRY)

  const create = async (event: Event) => {
    event.preventDefault()
    setState({ step: "creating" })
    const options = passphrase === "" ? { expiry } : { expiry, passphrase }
    const result = await run(sendSecret(plaintext, options)).catch(() => Result.fail(undefined))
    if (Result.isSuccess(result)) {
      setPlaintext("")
      setPassphrase("")
      setState({
        step: "created",
        url: linkUrl(result.success),
        expiry,
        hasPassphrase: result.success.hasPassphrase,
      })
    } else {
      setState({ step: "editing", failed: true })
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
      {state.step === "created" ? (
        <Created
          url={state.url}
          expiry={state.expiry}
          hasPassphrase={state.hasPassphrase}
          onAnother={() => {
            setState({ step: "editing", failed: false })
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
            value={plaintext}
            onInput={(e) => {
              setPlaintext(e.currentTarget.value)
            }}
            class="block w-full rounded-md border border-line-strong bg-surface p-sm font-mono text-ink"
          />
          <ExpiryPicker value={expiry} onChange={setExpiry} />
          <PassphraseField value={passphrase} onInput={setPassphrase} />
          {state.step === "editing" && state.failed ? (
            <p role="alert" class="text-body text-ink">
              I couldn't create the link, so nothing was saved. Check your connection and try again.
            </p>
          ) : null}
          <button type="submit" class="btn" disabled={state.step === "creating"}>
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
      class="block w-full rounded-md border border-line-strong bg-surface p-sm font-mono text-ink"
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
    <legend class="mb-xs font-mono text-label uppercase text-muted">Expires if unopened in</legend>
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
      class="block w-full rounded-md border border-line-strong bg-surface p-sm font-mono text-ink"
    />
    <p class="text-body text-muted">
      It works once, then the secret is gone. Unopened, it expires in {EXPIRY_LABEL[expiry]}.
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
