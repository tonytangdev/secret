# Secret

Sending a short secret to one person through a link that works once.

## Language

**Secret**:
The text a sender wants to deliver, readable once until it expires.
_Avoid_: Password, message, note, paste

**Link**:
The URL a sender shares; it identifies a Secret and carries its Link key.
_Avoid_: URL, share link, token

**Link key**:
The part of the Link that unlocks the Secret; it never reaches the server.
_Avoid_: Key, token, fragment

**Passphrase**:
An optional extra word the sender shares through another channel, needed together with the Link key.
_Avoid_: Password, PIN

**Reveal**:
The recipient's deliberate act of opening a Secret, which consumes it.
_Avoid_: View, open, read

**Burn**:
A Secret ceasing to exist, either by being revealed or by expiring.
_Avoid_: Delete, destroy, consume

**Expiry**:
The moment after which an unrevealed Secret burns.
_Avoid_: TTL, timeout, lifetime
