import { Result } from "effect"
import { useState } from "preact/hooks"
import { type Link, linkPath } from "../../shared/link.ts"
import { CopyButton } from "../copy-button.tsx"
import { useRun } from "../run.ts"
import { sendSecret } from "../secret-flow.ts"
import { MAX_SECRET_BYTES, secretBytes } from "../../shared/limits.ts"

/** Why the last attempt didn't create a Link: a typed failure's tag, or "failed" (network, server). */
type Failure = "SecretEmpty" | "SecretTooLarge" | "RateLimited" | "failed"

const FAILURE_COPY: Record<Failure, string> = {
  SecretEmpty: "There's nothing to send yet. Type or paste your secret first.",
  SecretTooLarge: "That's over the 10 KB limit, so I didn't send it. Shorten it and try again.",
  RateLimited:
    "You've created a lot of secrets in the last hour, so I'm holding off. Wait a while and try again.",
  failed: "I couldn't create the link, so nothing was saved. Check your connection and try again.",
}

const failureOf = (error: { readonly _tag: string }): Failure => {
  switch (error._tag) {
    case "SecretEmpty":
    case "SecretTooLarge":
    case "RateLimited":
      return error._tag
    default:
      return "failed"
  }
}

const size = (bytes: number) =>
  bytes < 1024 ? `${String(bytes)} bytes` : `${(Math.ceil(bytes / 102.4) / 10).toFixed(1)} KB`

type State =
  | { readonly step: "editing"; readonly failure: Failure | null }
  | { readonly step: "creating" }
  | { readonly step: "created"; readonly url: string }

const linkUrl = (link: Link) => `${location.origin}${linkPath(link)}`

export const Home = () => {
  const run = useRun()
  const [state, setState] = useState<State>({ step: "editing", failure: null })
  const [plaintext, setPlaintext] = useState("")
  const used = secretBytes(plaintext)
  const tooLarge = used > MAX_SECRET_BYTES

  const create = async (event: Event) => {
    event.preventDefault()
    setState({ step: "creating" })
    // A rejected run is a defect (e.g. the network died mid-request): "failed" like any other.
    const result = await run(sendSecret(plaintext)).catch(() => undefined)
    if (result === undefined) {
      setState({ step: "editing", failure: "failed" })
    } else if (Result.isSuccess(result)) {
      setPlaintext("")
      setState({ step: "created", url: linkUrl(result.success) })
    } else {
      setState({ step: "editing", failure: failureOf(result.failure) })
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
            class="block w-full rounded-md border border-line-strong bg-surface p-sm font-mono text-ink"
          />
          <p
            id="secret-size"
            aria-live="polite"
            class={`font-mono text-label ${tooLarge ? "font-bold text-ink-strong" : "text-muted"}`}
          >
            {size(used)} of 10 KB used{tooLarge ? ". Too large to send." : ""}
          </p>
          {state.step === "editing" && state.failure !== null ? (
            <p role="alert" class="text-body text-ink">
              {FAILURE_COPY[state.failure]}
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
