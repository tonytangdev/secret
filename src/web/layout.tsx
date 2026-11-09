import type { ComponentChildren } from "preact"

export const Layout = ({ children }: { readonly children: ComponentChildren }) => (
  <div class="flex min-h-svh flex-col">
    <header class="border-b border-line">
      <nav class="mx-auto flex w-full max-w-measure items-center justify-between gap-sm px-5 py-4">
        <a href="/" class="font-display text-title text-ink-strong no-underline">
          secret
        </a>
        <a
          href="/how-it-works"
          class="font-mono text-label uppercase text-muted no-underline hover:text-accent"
        >
          How it works
        </a>
      </nav>
    </header>
    <main class="mx-auto w-full max-w-measure flex-1 px-5 py-section">{children}</main>
    <footer class="border-t border-line">
      <p class="mx-auto w-full max-w-measure px-5 py-6 font-mono text-label text-muted">
        Made by Tony Tang ·{" "}
        <a class="text-accent-strong underline" href="https://tonytang.dev/apps">
          more apps
        </a>
      </p>
    </footer>
  </div>
)
