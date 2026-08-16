## Hashing

> All snippets below import `sha512_256` from `algokit_common`. This is the
> SHA-512/256 primitive that the Algorand protocol uses everywhere —
> transaction IDs, Merkle roots, multisig addresses, and logic sig addresses.
> Most callers never need it directly; reach for it when you are building
> protocol-level helpers outside the transaction path.

### Compute an Algorand-compatible hash

Use `sha512_256()` to compute the digest that Algorand uses throughout the
protocol.

```python
from algokit_common import sha512_256

digest = sha512_256(b"Hello, Algorand!")
print(len(digest))  # 32
```

**What just happened:** `sha512_256(data)` computes the NIST SHA-512/256
variant (SHA-512 with a distinct initialization vector, truncated to 256 bits
— not a truncated SHA-512) via `pycryptodomex`'s `SHA512.new(truncate="256")`
and returns 32 bytes. This is the exact hash function the Algorand protocol
uses for transaction IDs, Merkle tree construction, logic sig addresses,
multisig addresses, and every other `hash256`-shaped construction in the
protocol. It is synchronous and pure — the same input always produces the
same output.

### Derive a multisig address

Combine participant public keys with the Algorand multisig domain separator
and hash the result.

```python
from algokit_common import address_from_public_key, sha512_256


def multisig_address(version: int, threshold: int, pubkeys: list[bytes]) -> str:
    buffer = bytearray(b"MultisigAddr")
    buffer.append(version)
    buffer.append(threshold)
    for pk in pubkeys:
        buffer.extend(pk)
    return address_from_public_key(sha512_256(bytes(buffer)))
```

**What just happened:** Algorand multisig addresses are the SHA-512/256 hash
of `b"MultisigAddr" || version || threshold || pubkey_1 || pubkey_2 || ...`.
The snippet reproduces that construction using `sha512_256()` — the exact
layout used by `algokit_transact.signing.multisig.address_from_multisig_signature`.
In normal code, prefer `algorand.account.multisig(...)` (see
[Account management](#account-management)) — it handles the byte layout and
returns a fully-wired `MultisigAccount` with signers attached. Reach for
`sha512_256()` directly only when you are implementing a protocol helper
outside the account-manager layer.

### Derive a logic sig address

Prefix compiled TEAL bytes with `Program` and hash them to get the logic sig
address.

```python
from algokit_common import address_from_public_key, sha512_256


def logic_sig_address(program: bytes) -> str:
    return address_from_public_key(sha512_256(b"Program" + program))
```

**What just happened:** A logic sig address is
`sha512_256(b"Program" + teal_bytes)`. `sha512_256()` produces the 32-byte
digest that becomes the account's raw public key bytes;
`address_from_public_key` base32-encodes those bytes with the Algorand
checksum to yield the familiar string address. This is exactly the
construction used by `LogicSig.address` in `algokit_transact` — as with
multisig, `algorand.account.logicsig(program=...)` wraps it for you, and the
raw `sha512_256()` call is only needed when you are working outside the
account-manager layer.
