interface RobotsMeta {
  name: string
  content: string
  remove: () => void
}

interface Doc<M extends RobotsMeta> {
  readonly head: { readonly append: (meta: M) => void }
  readonly createElement: (tag: "meta") => M
}

/**
 * Asks search engines not to index the current page; call the result to take it back. For pages
 * served as the SPA fallback (status 200) that aren't real pages. Google reads a noindex added
 * by JavaScript.
 */
export const noindex = <M extends RobotsMeta>(doc: Doc<M>): (() => void) => {
  const meta = doc.createElement("meta")
  meta.name = "robots"
  meta.content = "noindex"
  doc.head.append(meta)
  return () => {
    meta.remove()
  }
}
