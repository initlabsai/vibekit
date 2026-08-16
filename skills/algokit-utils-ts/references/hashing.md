## Hashing

> All snippets below import from `@algorandfoundation/algokit-utils/crypto`.
> This module exposes the SHA-512/256 primitive that the Algorand protocol
> uses everywhere — transaction IDs, Merkle roots, multisig addresses, and
> logic sig addresses. Most callers never need it directly; reach for it when
> you are building protocol-level helpers outside the transaction path.

### Compute an Algorand-compatible hash

Use `hash()` to compute the SHA-512/256 digest that Algorand uses throughout the
protocol.

```typescript
import { hash } from "@algorandfoundation/algokit-utils/crypto";

const bytes = new TextEncoder().encode("Hello, Algorand!");
const digest = hash(bytes);

console.log(digest.length); // 32
```

**What just happened:** `hash(bytes)` computes `sha512_256(bytes)` (the NIST
SHA-512/256 variant, not a truncated SHA-512) and returns the first 32 bytes. This
is the exact hash function the Algorand protocol uses for transaction IDs, Merkle
tree construction, logic sig addresses, multisig addresses, and every other
`hash256`-shaped construction in the protocol. It is synchronous and pure — the
same input always produces the same output.

### Derive a multisig address

Combine participant public keys with the Algorand multisig domain separator and
hash the result.

```typescript
import { hash } from "@algorandfoundation/algokit-utils/crypto";

function multisigAddressBytes(
  version: number,
  threshold: number,
  pubkeys: Uint8Array[],
): Uint8Array {
  const prefix = new TextEncoder().encode("MultisigAddr");
  const merged = new Uint8Array(
    prefix.length + 2 + pubkeys.reduce((n, pk) => n + pk.length, 0),
  );
  merged.set(prefix, 0);
  merged[prefix.length] = version;
  merged[prefix.length + 1] = threshold;

  let offset = prefix.length + 2;
  for (const pk of pubkeys) {
    merged.set(pk, offset);
    offset += pk.length;
  }
  return hash(merged);
}
```

**What just happened:** Algorand multisig addresses are the SHA-512/256 hash of
`"MultisigAddr" || version || threshold || pubkey_1 || pubkey_2 || ...`. The
snippet reproduces that construction using `hash()`. In normal code, prefer
`algorand.account.multisig(...)` (see [Account management](#account-management)) —
it handles the byte layout and returns a fully-wired `MultisigAccount` with
signers attached. Reach for `hash()` directly only when you are implementing a
protocol helper outside the account-manager layer.

### Derive a logic sig address

Prefix compiled TEAL bytes with `Program` and hash them to get the logic sig
address.

```typescript
import { hash } from "@algorandfoundation/algokit-utils/crypto";

function logicSigAddressBytes(program: Uint8Array): Uint8Array {
  const prefix = new TextEncoder().encode("Program");
  const merged = new Uint8Array(prefix.length + program.length);
  merged.set(prefix, 0);
  merged.set(program, prefix.length);
  return hash(merged);
}
```

**What just happened:** A logic sig address is `hash("Program" || teal_bytes)`.
`hash()` produces the 32-byte digest that becomes the account's raw public key
bytes; base32-encoding those bytes with the Algorand checksum yields the familiar
string address. As with multisig, `algorand.account.logicsig(program)` wraps this
construction for you — the raw `hash()` call is only needed when you are working
outside the account-manager layer.
