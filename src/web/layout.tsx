import type { ComponentChildren } from "preact"
import { useEffect } from "preact/hooks"
import { useLocation } from "preact-iso"
import { Logo, useMascotMood } from "./logo.tsx"
import { pageFor } from "./seo.ts"
import { ThemeToggle } from "./theme-toggle.tsx"
import { SPONSORS_URL } from "./support-note.tsx"

/** Keeps the tab title and description right as the app navigates between pages. */
const usePageMeta = (path: string) => {
  useEffect(() => {
    const page = pageFor(path)
    document.title = page.title
    document.querySelector('meta[name="description"]')?.setAttribute("content", page.description)
  }, [path])
}

const NAV_LINK = "font-mono text-label uppercase text-muted no-underline hover:text-accent"

export const Layout = ({ children }: { readonly children: ComponentChildren }) => {
  const { path } = useLocation()
  usePageMeta(path)
  const mood = useMascotMood()
  return (
    <div class="flex min-h-svh flex-col">
      <header class="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur">
        <nav class="mx-auto flex w-full max-w-page items-center justify-between gap-sm px-5 py-3">
          <a
            href="/"
            class="flex items-center gap-xs font-display text-title text-ink-strong no-underline"
          >
            <Logo class="w-11" mood={mood} />
            secret
          </a>
          <div class="flex items-center gap-md">
            <a href="/how-it-works" class={NAV_LINK}>
              How it works
            </a>
            <ThemeToggle />
          </div>
        </nav>
      </header>
      {/* The main page spreads out; the others are reading width. */}
      <main
        class={`mx-auto w-full flex-1 px-5 py-section ${path === "/" ? "max-w-page" : "max-w-measure"}`}
      >
        {children}
      </main>
      <footer class="border-t border-line">
        <div class="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-x-md gap-y-xs px-5 py-6 font-mono text-label text-muted">
          <span class="flex items-center gap-xs">
            <Logo class="w-7" />
            Made by Tony Tang
          </span>
          <div class="flex flex-wrap gap-x-md gap-y-xs">
            <a class="text-accent-strong underline" href="https://tonytang.dev/apps">
              More apps
            </a>
            <a class="text-accent-strong underline" href="https://github.com/tonytangdev/secret">
              Source code
            </a>
            <a class="text-accent-strong underline" href={SPONSORS_URL}>
              Support me
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
