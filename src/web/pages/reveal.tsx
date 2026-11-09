import { Result } from "effect"
import { useState } from "preact/hooks"
import type { StoredSecret } from "../../shared/api.ts"
import { type Link, parseLink } from "../../shared/link.ts"
import { CopyButton } from "../copy-button.tsx"
import { useRun } from "../run.ts"
import { takeSecret, unlockSecret } from "../secret-flow.ts"

type State =
  | { readonly step: "ready"; readonly link: Link }
  | { readonly step: "revealing" }
  | { readonly step: "revealed"; readonly secret: string }
  | { readonly step: "gone" }
  | { readonly step: "malformed" }
  | { readonly step: "undecryptable" }
  | { readonly step: "failed"; readonly link: Link }

// Only reads the page's own URL: opening a Link never calls the API (ADR-0007).
const initialState = (id: string): State =>
  Result.match(parseLink(id, location.hash), {
    onSuccess: (link): State => ({ step: "ready", link }),
    onFailure: (error): State =>
      error._tag === "MalformedLinkKey" ? { step: "malformed" } : { step: "gone" },
  })

export const Reveal = ({ id = "" }: { readonly id?: string }) => {
  const run = useRun()
  const [state, setState] = useState<State>(() => initialState(id))

  const reveal = async (link: Link) => {
    setState({ step: "revealing" })
    const taken = await run(takeSecret(link)).catch(() => Result.fail(undefined))
    if (Result.isFailure(taken)) {
      setState(taken.failure?._tag === "SecretGone" ? { step: "gone" } : { step: "failed", link })
      return
    }
    setState(await unlock(taken.success, link))
  }

  const unlock = async (taken: StoredSecret, link: Link): Promise<State> => {
    const plain = await run(unlockSecret(taken, link)).catch(() => Result.fail(undefined))
    return Result.isSuccess(plain)
      ? { step: "revealed", secret: plain.success }
      : { step: "undecryptable" }
  }

  switch (state.step) {
    case "ready":
    case "revealing":
    case "failed":
      return (
        <section>
          <h1 class="text-headline text-ink-strong">Someone sent you a secret.</h1>
          <p class="mt-md text-body text-muted">
            It can be revealed only once. Reveal it when you're ready to save it somewhere safe.
          </p>
          {state.step === "failed" ? (
            <p role="alert" class="mt-md text-body text-ink">
              I couldn't reach the server. Check your connection and try again.
            </p>
          ) : null}
          <button
            type="button"
            class="btn mt-lg"
            disabled={state.step === "revealing"}
            onClick={() => {
              if (state.step !== "revealing") void reveal(state.link)
            }}
          >
            {state.step === "revealing" ? "Revealing…" : "Reveal"}
          </button>
        </section>
      )
    case "revealed":
      return <Revealed secret={state.secret} />
    case "gone":
      return (
        <Notice title="This secret doesn't exist, was already viewed, or expired.">
          If you didn't open it, tell the sender — someone else may have.
        </Notice>
      )
    case "malformed":
      return (
        <Notice title="This link is incomplete.">
          The part after the # is missing or damaged, so the secret can't be unlocked. Nothing was
          revealed. Ask the sender to copy the whole link again.
        </Notice>
      )
    case "undecryptable":
      return (
        <Notice title="This secret can't be decrypted.">
          The link looks right, but its key doesn't unlock the secret, which is now gone from the
          server. Ask the sender to create a new one.
        </Notice>
      )
  }
}

const Revealed = ({ secret }: { readonly secret: string }) => {
  const [shown, setShown] = useState(false)
  return (
    <section>
      <h1 class="text-headline text-ink-strong">Here's your secret.</h1>
      <p role="status" class="mt-md text-body text-muted">
        It's gone from the server. It now exists only in this tab, so save it before you close it.
      </p>
      <div
        id="secret"
        aria-label="Secret"
        class="mt-lg min-h-24 whitespace-pre-wrap break-all rounded-md border border-line-strong bg-surface p-sm font-mono text-ink"
      >
        {shown ? secret : "•••••••• (hidden)"}
      </div>
      <div class="mt-sm flex flex-wrap gap-sm">
        <CopyButton text={secret} label="Copy secret" />
        <button
          type="button"
          class="ghost"
          aria-controls="secret"
          aria-pressed={shown}
          onClick={() => {
            setShown(!shown)
          }}
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    </section>
  )
}

const Notice = ({ title, children }: { readonly title: string; readonly children: string }) => (
  <section role="alert">
    <h1 class="text-headline text-ink-strong">{title}</h1>
    <p class="mt-md text-body text-muted">{children}</p>
    <p class="mt-lg text-body">
      <a class="text-accent-strong underline" href="/">
        Send a secret of your own
      </a>
    </p>
  </section>
)
