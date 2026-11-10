import { useEffect, useState } from "preact/hooks"
import { CheckIcon } from "./check-icon.tsx"

/** Copies `text` and confirms with a check and "Copied" for a moment. */
export const CopyButton = ({ text, label }: { readonly text: string; readonly label: string }) => {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => {
      setCopied(false)
    }, 2000)
    return () => {
      clearTimeout(timer)
    }
  }, [copied])
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }
  return (
    <button
      type="button"
      class={`btn inline-flex items-center gap-xs ${copied ? "animate-ring" : ""}`}
      onClick={() => {
        void copy()
      }}
    >
      {copied ? <CheckIcon class="size-5" /> : null}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  )
}
