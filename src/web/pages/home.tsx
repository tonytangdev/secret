import { Result } from "effect"
import { useState } from "preact/hooks"
import { type Link, linkPath } from "../../shared/link.ts"
import { CopyButton } from "../copy-button.tsx"
import { useRun } from "../run.ts"
import { sendSecret } from "../secret-flow.ts"

type State =
  | { readonly step: "editing"; readonly failed: boolean }
  | { readonly step: "creating" }
  | { readonly step: "created"; readonly url: string }

const linkUrl = (link: Link) => `${location.origin}${linkPath(link)}`

export const Home = () => {
  const run = useRun()
  const [state, setState] = useState<State>({ step: "editing", failed: false })
  const [plaintext, setPlaintext] = useState("")

  const create = async (event: Event) => {
    event.preventDefault()
    setState({ step: "creating" })
    const result = await run(sendSecret(plaintext)).catch(() => Result.fail(undefined))
    if (Result.isSuccess(result)) {
      setPlaintext("")
      setState({ step: "created", url: linkUrl(result.success) })
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

const Created = ({ url, onAnother }: { readonly url: string; readonly onAnother: () => void }) => (
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
      It works once, then the secret is gone. Unopened, it expires in 1 day.
    </p>
    <div class="flex flex-wrap gap-sm">
      <CopyButton text={url} label="Copy link" />
      <button type="button" class="ghost" onClick={onAnother}>
        Create another
      </button>
    </div>
  </div>
)
