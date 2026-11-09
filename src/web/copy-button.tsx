import { useEffect, useState } from "preact/hooks"

/** Copies `text` and confirms with "Copied" for a moment. */
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
      class="btn"
      onClick={() => {
        void copy()
      }}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  )
}
