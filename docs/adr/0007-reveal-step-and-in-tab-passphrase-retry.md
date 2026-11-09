# Reveal step before burn; passphrase retries stay in the tab

Link-preview bots (Slack, iMessage, Teams) fetch links as soon as they're pasted, so opening `/s/:id` never touches the secret. The secret is fetched and burned only when the recipient clicks **Reveal**. A passphrase can't be checked before the burn, so the ciphertext stays in tab memory and the recipient can retry a wrong passphrase there. This gives an attacker nothing: anyone holding the link could download the ciphertext and brute-force it offline anyway, and PBKDF2 is the defense.
