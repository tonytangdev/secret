# Cloudflare Durable Objects for storage

A secret must be readable exactly once, so read-and-delete has to be atomic. Cloudflare KV is eventually consistent and could serve the same secret to two concurrent readers, so we use one Durable Object per secret, with its alarm deleting expired secrets. The whole app (static assets, `/api/*`, Durable Object) is one Worker on `secret.tonytang.dev`, and tonytang.dev DNS is already in Cloudflare.

## Considered Options

- Vercel + Upstash Redis `GETDEL`: atomic too, but adds a second vendor.
- VPS + SQLite: more ops for no gain.
