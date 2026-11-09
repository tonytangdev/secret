# No third-party JavaScript, no browser analytics

Any script on the page can read the decryption key from `location.href`, including a "harmless" analytics beacon. The page loads only first-party code: a strict CSP (`default-src 'self'`), self-hosted fonts, and no analytics script. Usage is counted on the server with Workers Analytics Engine (created / revealed / expired), and secret IDs are never logged.
