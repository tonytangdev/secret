# Zero-knowledge: encrypt in the browser, key in the URL fragment

Secrets are encrypted in the sender's browser with AES-256-GCM (WebCrypto), and the 256-bit key travels only in the link's `#fragment`, which browsers never send to the server. The server stores ciphertext it cannot read. We rejected server-side encryption because "trust me" is not a security model; this is the same approach as Yopass and PrivateBin.

## Consequences

- Anything that can read `location.href` can read the key, which is why the page runs no third-party JavaScript (ADR-0005).
- With a passphrase, the final key is HKDF(link key ‖ PBKDF2-SHA256(passphrase, salt, 600k)), so a leaked link alone is not enough.
