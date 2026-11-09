// The main page below the form: how to send a secret online, why a one-time link, and an FAQ.
// Every answer must stay true to the code, like /how-it-works; numbers come from shared modules.
import type { ComponentChildren } from "preact"
import { DEFAULT_EXPIRY, EXPIRY_LABEL, Expiry } from "../../shared/expiry.ts"
import { MAX_SECRET_LABEL } from "../../shared/limits.ts"

const HOW_TO = [
  [
    "Paste your secret",
    `A password, an API key, a .env file, recovery codes: any text up to ${MAX_SECRET_LABEL}.`,
  ],
  [
    "Pick an Expiry, add a passphrase if you like",
    "The link stops working after that time even if nobody opens it. A passphrase adds a second lock you share another way.",
  ],
  [
    "Send the link",
    "Paste it in Slack, email or a text. Your recipient clicks Reveal, sees the secret once, and it's gone.",
  ],
] as const

const expiryList = Expiry.literals.map((e) => EXPIRY_LABEL[e]).join(", ")

const FAQ: ReadonlyArray<readonly [string, ComponentChildren]> = [
  [
    "How do I send a password securely online?",
    <>
      Paste it in the box above and press Create link. Your browser encrypts it before it leaves the
      page, and you get a link that reveals it once. Send the link, and if it's important, add a
      passphrase and tell your recipient over a call.
    </>,
  ],
  [
    "Can you read the secrets I send?",
    <>
      No. The encryption key lives after the <code class="font-mono">#</code> in the link, and
      browsers never send that part to a server. I only store ciphertext I can't decrypt.{" "}
      <a class="text-accent-strong underline" href="/how-it-works">
        Here's exactly how it works.
      </a>
    </>,
  ],
  [
    "What happens after the secret is revealed?",
    <>
      It's burned on the server in the same step that hands it over, so even two clicks at the same
      moment can't both get it. Anyone who tries the link afterwards is told it's gone.
    </>,
  ],
  [
    "Will Slack or Teams link previews use up my link?",
    <>
      No. Opening the link doesn't touch the secret: your recipient has to click Reveal. Bots that
      fetch the page to build a preview never get it.
    </>,
  ],
  [
    "How long does a link last?",
    <>
      Until it's revealed, or until its Expiry: {expiryList} ({EXPIRY_LABEL[DEFAULT_EXPIRY]} by
      default). After that, the secret is burned unread.
    </>,
  ],
  [
    "What if someone else opens my link first?",
    <>
      They'd get the secret, and your recipient would see that it's gone, with a note to warn you.
      For anything that matters, add a passphrase: then the link alone isn't enough.
    </>,
  ],
  [
    "Is it free? Do I need an account?",
    <>
      Free, no account, no trackers. The code is open source under AGPL-3.0 on{" "}
      <a class="text-accent-strong underline" href="https://github.com/tonytangdev/secret">
        GitHub
      </a>
      .
    </>,
  ],
]

const SectionTitle = ({ children }: { readonly children: ComponentChildren }) => (
  <h2 class="text-headline text-ink-strong">{children}</h2>
)

export const HomeGuide = () => (
  <>
    <section class="mt-section border-t border-line pt-section">
      <SectionTitle>How to send a secret online</SectionTitle>
      <ol class="mt-lg grid gap-md md:grid-cols-3">
        {HOW_TO.map(([title, body], i) => (
          <li key={title} class="card p-md">
            <span class="font-mono text-label text-accent-strong">STEP {i + 1}</span>
            <h3 class="mt-xs text-[1.2rem] leading-tight font-bold text-ink-strong">{title}</h3>
            <p class="mt-xs text-[0.98rem] leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </section>

    <section class="mt-section grid gap-lg md:grid-cols-[1fr_1.4fr]">
      <SectionTitle>Why not just paste it in the chat?</SectionTitle>
      <div class="space-y-sm text-body text-ink">
        <p>
          A password pasted into Slack or email stays there: in the history, in backups, in search,
          on every device that synced it. If any of those leak, so does your secret.
        </p>
        <p>
          A one-time link leaves nothing behind. The chat keeps a link that no longer works, and the
          server never had anything it could read.
        </p>
      </div>
    </section>

    <section class="faq mt-section">
      <SectionTitle>Questions</SectionTitle>
      <div class="card mt-lg divide-y divide-line">
        {FAQ.map(([question, answer]) => (
          <details key={question} class="px-md py-sm">
            <summary class="py-xs font-display text-[1.1rem] font-bold text-ink-strong">
              {question}
            </summary>
            <p class="pb-xs text-body text-muted">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  </>
)
