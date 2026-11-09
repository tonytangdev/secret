import { Result } from "effect"
import { useEffect, useState } from "preact/hooks"
import type { StoredSecret } from "../../shared/api.ts"
import { type Link, parseLink } from "../../shared/link.ts"
import { CopyButton } from "../copy-button.tsx"
import { useRun } from "../run.ts"
import { takeSecret, unlockSecret } from "../secret-flow.ts"

type State =
  | { readonly step: "ready"; readonly link: Link }
  | { readonly step: "revealing" }
  | {
      readonly step: "locked"
      readonly taken: StoredSecret
      readonly link: Link
      readonly attempt: "none" | "unlocking" | "wrong"
    }
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
  // A Link pasted into this tab again may change only the fragment, which doesn't reload the page.
  useEffect(() => {
    const reread = () => {
      // Never drop a Secret that's already been taken: it exists only in this tab.
      setState((current) =>
        current.step === "revealing" || current.step === "locked" || current.step === "revealed"
          ? current
          : initialState(id),
      )
    }
    addEventListener("hashchange", reread)
    return () => {
      removeEventListener("hashchange", reread)
    }
  }, [id])

  const reveal = async (link: Link) => {
    setState({ step: "revealing" })
    const taken = await run(takeSecret(link)).catch(() => Result.fail(undefined))
    if (Result.isFailure(taken)) {
      setState(taken.failure?._tag === "SecretGone" ? { step: "gone" } : { step: "failed", link })
      return
    }
    // The server's flag decides: the fragment's copy only drives the pre-Reveal hint.
    if (taken.success.hasPassphrase) {
      setState({ step: "locked", taken: taken.success, link, attempt: "none" })
      return
    }
    setState(await unlock(taken.success, link))
  }

  const unlock = async (taken: StoredSecret, link: Link, passphrase?: string): Promise<State> => {
    const plain = await run(unlockSecret(taken, link, passphrase)).catch(() =>
      Result.fail(undefined),
    )
    if (Result.isSuccess(plain)) return { step: "revealed", secret: plain.success }
    // The ciphertext stays in memory, so a wrong Passphrase can be retried as often as needed.
    return plain.failure?._tag === "WrongPassphrase"
      ? { step: "locked", taken, link, attempt: "wrong" }
      : { step: "undecryptable" }
  }

  const tryPassphrase = async (taken: StoredSecret, link: Link, passphrase: string) => {
    setState({ step: "locked", taken, link, attempt: "unlocking" })
    setState(await unlock(taken, link, passphrase))
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
          {state.step !== "revealing" && state.link.hasPassphrase ? (
            <p class="mt-sm text-body text-ink">
              You'll also need the passphrase. Get it from the sender before you reveal.
            </p>
          ) : null}
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
    case "locked":
      return (
        <Locked
          attempt={state.attempt}
          onSubmit={(passphrase) => {
            void tryPassphrase(state.taken, state.link, passphrase)
          }}
        />
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

const Locked = ({
  attempt,
  onSubmit,
}: {
  readonly attempt: "none" | "unlocking" | "wrong"
  readonly onSubmit: (passphrase: string) => void
}) => {
  const [passphrase, setPassphrase] = useState("")
  return (
    <section>
      <h1 class="text-headline text-ink-strong">Enter the passphrase.</h1>
      <p role="status" class="mt-md text-body text-ink">
        The secret is gone from the server and now exists only in this tab. Don't close this tab
        until it unlocks.
      </p>
      <form
        class="mt-lg space-y-sm"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(passphrase)
        }}
      >
        <label for="passphrase" class="block font-mono text-label uppercase text-muted">
          Passphrase
        </label>
        <input
          id="passphrase"
          type="text"
          required
          autocomplete="off"
          spellcheck={false}
          value={passphrase}
          onInput={(e) => {
            setPassphrase(e.currentTarget.value)
          }}
          class="block w-full rounded-md border border-line-strong bg-surface p-sm font-mono text-ink"
        />
        {attempt === "wrong" ? (
          <p role="alert" class="text-body text-ink">
            Wrong passphrase. Check it with the sender and try again; you can retry as often as you
            need.
          </p>
        ) : null}
        <button type="submit" class="btn" disabled={attempt === "unlocking"}>
          {attempt === "unlocking" ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </section>
  )
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
