// /how-it-works: what is and isn't protected, and how. Every claim here is backed by code and tests;
// change the page when the code changes. Numbers come from the modules that enforce them.
import type { ComponentChildren } from "preact"
import { DEFAULT_EXPIRY, EXPIRY_LABEL, Expiry } from "../../shared/expiry.ts"

const REPO = "https://github.com/tonytangdev/secret"

const Section = ({
  title,
  children,
}: {
  readonly title: string
  readonly children: ComponentChildren
}) => (
  <section class="mt-lg space-y-sm">
    <h2 class="text-title text-ink-strong">{title}</h2>
    {children}
  </section>
)

const List = ({ children }: { readonly children: ComponentChildren }) => (
  <ul class="list-disc space-y-xs pl-md text-body text-ink">{children}</ul>
)

const P = ({ children }: { readonly children: ComponentChildren }) => (
  <p class="text-body text-ink">{children}</p>
)

const Code = ({ children }: { readonly children: ComponentChildren }) => (
  <code class="font-mono text-[0.9em] text-ink-strong">{children}</code>
)

const A = ({ href, children }: { readonly href: string; readonly children: ComponentChildren }) => (
  <a class="text-accent-strong underline" href={href}>
    {children}
  </a>
)

const expiryOptions = Expiry.literals
  .map((e) => (e === DEFAULT_EXPIRY ? `${EXPIRY_LABEL[e]} (the default)` : EXPIRY_LABEL[e]))
  .join(", ")

export const HowItWorks = () => (
  <article>
    <h1 class="text-headline text-ink-strong">How it works</h1>
    <p class="mt-md text-body text-muted">
      I built this to send someone an API key or a login without it sitting in a chat history
      forever. Here's what it protects, what it can't, and where to check my claims.
    </p>

    <Section title="What's protected">
      <List>
        <li>
          Your browser encrypts the Secret before anything leaves the page. My server only ever gets
          ciphertext.
        </li>
        <li>
          The Link key sits after the <Code>#</Code> in the Link. Browsers never send that part to a
          server, so mine never sees it.
        </li>
        <li>
          I store the ciphertext, the IV, the salt if there's a Passphrase, a has-passphrase flag
          and the Expiry. Nothing else. Someone who broke into my storage would get ciphertext they
          can't read.
        </li>
        <li>
          A Link works once. Reveal takes the Secret and Burns it in one step, so even two Reveals
          at the same moment can't both get it.
        </li>
      </List>
    </Section>

    <Section title="What isn't">
      <List>
        <li>
          <strong>A compromised device or browser.</strong> Malware or a bad browser extension on
          either end can read the Secret before it's encrypted or after it's decrypted.
        </li>
        <li>
          <strong>A leaked Link without a Passphrase.</strong> The Link alone unlocks the Secret, so
          whoever opens it first gets it. Your recipient would then see the "gone" message, which
          tells them to warn you. For anything important, add a Passphrase and send it another way.
        </li>
        <li>
          <strong>A recipient who copies the Secret elsewhere.</strong> Once it's on their screen, I
          can't stop them pasting it into a chat.
        </li>
        <li>
          <strong>The code I serve.</strong> The encryption runs in JavaScript my server sends you.
          If my server or my Cloudflare account were taken over, it could serve code that leaks the
          Link key. The source is public, but you're trusting that what runs is what's published.
        </li>
      </List>
    </Section>

    <Section title="The encryption">
      <List>
        <li>
          AES-256-GCM through the browser's built-in WebCrypto. No crypto library, and the server
          never decrypts anything.
        </li>
        <li>
          Every Secret gets a fresh 256-bit Link key and a fresh 96-bit IV from the browser's random
          number generator. Without a Passphrase, the Link key is the AES key.
        </li>
        <li>
          With a Passphrase, PBKDF2-SHA256 stretches it with 600,000 iterations and a fresh 128-bit
          salt, then HKDF-SHA256 mixes the result with the Link key. You need both the Link and the
          Passphrase, and a wrong Passphrase fails GCM's integrity check.
        </li>
        <li>
          A Link looks like <Code>/s/&lt;id&gt;#&lt;link-key&gt;</Code>, with <Code>.p</Code> on the
          end when there's a Passphrase, so the Reveal page can tell you before you click.
        </li>
        <li>
          Secret IDs are 128 random bits made on the server, so nobody can guess or list them.
        </li>
      </List>
    </Section>

    <Section title="Reveal, then Burn">
      <P>
        Opening a Link doesn't touch the Secret. Slack, iMessage and Teams fetch a link as soon as
        it's pasted, to build a preview. If opening it Burned the Secret, a bot would use it up
        before your recipient got there. So the page waits for a click on Reveal, then fetches and
        Burns the Secret in one step.
      </P>
      <P>
        A Passphrase can't be checked before the Burn, because my server can't check it at all. So
        the ciphertext stays in the tab, and you can retry a wrong Passphrase as often as you like.
        Close the tab and it's gone. That gives an attacker nothing: whoever holds the Link could
        take the ciphertext and guess offline anyway. The 600,000 PBKDF2 iterations are what make
        each guess slow, so pick a Passphrase that isn't a single common word.
      </P>
    </Section>

    <Section title="Expiry">
      <P>
        You pick {expiryOptions}. An unrevealed Secret Burns at its Expiry: an alarm on its storage
        removes it, and a Reveal after the Expiry finds it gone even if the alarm hasn't run yet.
      </P>
      <P>
        Whatever happened, whether the Secret never existed, was already revealed or expired, the
        recipient sees the same message. The page doesn't say which.
      </P>
    </Section>

    <Section title="No third-party code">
      <P>
        Anything running on the page can read the Link key from the address bar, including a
        "harmless" analytics script. So the page loads only its own code: no analytics, no trackers,
        no CDN, and the fonts are hosted here.
      </P>
      <P>
        A strict Content Security Policy (<Code>default-src 'self'</Code>, no inline scripts,{" "}
        <Code>connect-src 'self'</Code>, <Code>frame-ancestors 'none'</Code>) makes the browser
        refuse anything else and stops other sites from framing the page.{" "}
        <Code>Referrer-Policy: no-referrer</Code> keeps the Link from being passed on when you click
        away, and API responses are never cached.
      </P>
    </Section>

    <Section title="What I keep">
      <List>
        <li>
          <strong>No logs.</strong> Worker logs and traces are switched off. Reveal sends the Secret
          ID in the request body, not the URL, so it doesn't end up in request URLs either.
        </li>
        <li>
          <strong>Counts.</strong> One event per created, revealed and expired Secret, in Cloudflare
          Workers Analytics Engine. It holds the event name and nothing else: no Secret ID, no IP,
          no content. That's how I know whether anyone uses this.
        </li>
        <li>
          <strong>A rate limit.</strong> 20 Secrets per hour per IP address. To count them, I keep a
          HMAC-SHA256 of your IP, keyed with a secret only my Worker holds, and a count, and delete
          both when the hour is up. Without that secret, nobody with my storage can turn the hash
          back into an IP by hashing every possible one.
        </li>
        <li>
          <strong>A size cap.</strong> Up to 10 KB of text, checked in your browser before
          encryption and again on the server.
        </li>
      </List>
      <P>
        Cloudflare runs all of this, so like any host it sees your IP address to deliver the page.
      </P>
    </Section>

    <Section title="Check it yourself">
      <P>
        The code is public at <A href={REPO}>github.com/tonytangdev/secret</A>, and each promise on
        this page has a test there. It's licensed under{" "}
        <A href={`${REPO}/blob/main/LICENSE`}>AGPL-3.0</A>: anyone who runs a modified copy as a
        service has to publish their source too.
      </P>
    </Section>
  </article>
)
