## Wrapped secrets

> All snippets below import from `algokit_crypto`. The wrapped-secret pattern
> keeps Ed25519 seeds and HD extended private keys out of long-lived memory: a
> secret is unwrapped for a single operation, consumed, then immediately
> re-wrapped and zeroed. Use it when you are integrating with an HSM, KMS, or
> any store that re-encrypts key material between uses.

### Implement a WrappedEd25519Seed

Provide an unwrap/re-wrap pair for a 32-byte Ed25519 seed so the seed spends
as little time unwrapped in memory as possible.

```python
from algokit_crypto import WrappedEd25519Seed


class MyWrappedSeed:
    def __init__(self, store) -> None:
        self._store = store

    def unwrap_ed25519_seed(self) -> bytearray:
        # Return a 32-byte ``bytearray`` — for example decrypted from a secure store.
        # It must be a ``bytearray`` (not ``bytes``) so the consumer can zero it.
        return self._store.read()

    def wrap_ed25519_seed(self) -> None:
        # Re-lock / re-encrypt / discard the in-memory seed here.
        self._store.lock()


seed: WrappedEd25519Seed = MyWrappedSeed(store=...)
```

**What just happened:** `WrappedEd25519Seed` is a `@runtime_checkable` Protocol
with two methods: `unwrap_ed25519_seed` returns exactly 32 plaintext bytes as
a `bytearray`, and `wrap_ed25519_seed` is called afterwards to clean up
(re-encrypt, flush buffers, touch hardware, etc.). The consumer — typically
`ed25519_signing_key_from_wrapped_secret` — is responsible for invoking both
and for zeroing the unwrapped buffer in-place via `bytearray[:] = b"\x00" * len`.
Your implementation only has to move bytes in and out of your storage layer.
Any object that structurally satisfies the protocol works — no base class
required.

### Implement a WrappedHdExtendedPrivateKey

Provide an unwrap/re-wrap pair for a 96-byte HD extended private key.

```python
from algokit_crypto import WrappedHdExtendedPrivateKey


class MyWrappedExtendedKey:
    def __init__(self, store) -> None:
        self._store = store

    def unwrap_hd_extended_private_key(self) -> bytearray:
        # Return exactly 96 bytes: scalar (zL) || prefix (zR) || chain_code.
        return self._store.read()

    def wrap_hd_extended_private_key(self) -> None:
        self._store.lock()


key: WrappedHdExtendedPrivateKey = MyWrappedExtendedKey(store=...)
```

**What just happened:** `WrappedHdExtendedPrivateKey` carries a 96-byte value
laid out as `scalar (32) || prefix (32) || chain_code (32)`. Only the first 64
bytes are used for signing — if your store only keeps those 64 bytes, your
unwrap function must pad the chain code back to 96 bytes before returning
(typically with zeros, since the chain code is not needed for signing).
Consumers enforce the 96-byte length and will raise `ValueError` if the
buffer is the wrong size.

### Create a signing key from a wrapped seed

Turn a `WrappedEd25519Seed` into an `Ed25519SigningKey` whose signer handles
unwrap, sign, re-wrap, and zeroing automatically.

```python
from algokit_crypto import (
    WrappedEd25519Seed,
    ed25519_signing_key_from_wrapped_secret,
)

wrapped_seed: WrappedEd25519Seed = ...

signing_key = ed25519_signing_key_from_wrapped_secret(wrapped_seed)
signature = signing_key["raw_ed25519_signer"](b"Hello, Algorand!")
```

**What just happened:** `ed25519_signing_key_from_wrapped_secret` inspected the
wrapped object via `isinstance(wrapped, WrappedEd25519Seed)`, saw
`unwrap_ed25519_seed`/`wrap_ed25519_seed`, and unwrapped the seed once
immediately to derive the public key. It then returned an `Ed25519SigningKey`
`TypedDict` whose `raw_ed25519_signer` unwraps the seed again on every call,
signs the bytes via PyNaCl's `SigningKey`, re-wraps the seed in a `finally`
block, and finally fills the unwrapped `bytearray` with zeros — so plaintext
seed material exists in memory only for the duration of a single sign call.

### Create a signing key from a wrapped HD extended key

The same helper accepts a `WrappedHdExtendedPrivateKey` and dispatches to the
HD signing path instead.

```python
from algokit_crypto import (
    WrappedHdExtendedPrivateKey,
    ed25519_signing_key_from_wrapped_secret,
)

wrapped_extended_key: WrappedHdExtendedPrivateKey = ...

signing_key = ed25519_signing_key_from_wrapped_secret(wrapped_extended_key)
signature = signing_key["raw_ed25519_signer"](b"Hello, Algorand!")
```

**What just happened:** When the wrapped object exposes
`unwrap_hd_extended_private_key`/`wrap_hd_extended_private_key`, the helper
uses the package's internal `_raw_sign` (which consumes a 64-byte HD-expanded
secret via `xhd_wallet_api_py.public_key` and `nacl.bindings`) rather than
PyNaCl's high-level `SigningKey.sign`. The 96-byte buffer is validated for
length on every unwrap and is zeroed after each use with the same try/finally
discipline as the seed path.

### Use the pinned PyNaCl variant explicitly

Import `pynacl_ed25519_signing_key_from_wrapped_secret` when you need to
guarantee the current backend.

```python
from algokit_crypto import (
    WrappedEd25519Seed,
    pynacl_ed25519_signing_key_from_wrapped_secret,
)

wrapped_seed: WrappedEd25519Seed = ...

signing_key = pynacl_ed25519_signing_key_from_wrapped_secret(wrapped_seed)
```

**What just happened:** `ed25519_signing_key_from_wrapped_secret` is an alias
for `pynacl_ed25519_signing_key_from_wrapped_secret`. If you want to pin the
PyNaCl (libsodium) implementation specifically — and be insulated from future
default-repointing — import the `pynacl_*` name directly.

### Handle unwrap and re-wrap failures

When the underlying operation and the re-wrap both fail, you receive an
`ExceptionGroup` carrying both.

```python
from exceptiongroup import ExceptionGroup

from algokit_crypto import (
    WrappedEd25519Seed,
    ed25519_signing_key_from_wrapped_secret,
)


class FailingSeed:
    def unwrap_ed25519_seed(self) -> bytearray:
        raise RuntimeError("unwrap failed")

    def wrap_ed25519_seed(self) -> None:
        raise RuntimeError("wrap failed")


try:
    ed25519_signing_key_from_wrapped_secret(FailingSeed())
except ExceptionGroup as eg:
    print(eg.message)
    # "Deriving Ed25519 public key failed and failed to re-wrap Ed25519 secret..."
    print(eg.exceptions)  # (unwrap_error, wrap_error)
```

**What just happened:** When public-key derivation or signing raises *and* the
subsequent re-wrap also raises, the helper raises an `ExceptionGroup` (from
the `exceptiongroup` backport package, importable as `ExceptionGroup` on 3.10
or as the built-in on 3.11+) whose `exceptions` tuple contains both the
operation error and the wrap error in order. This guarantees that neither
failure is silently swallowed — both are visible to your caller. If only one
of the two fails, that single error is re-raised directly. Regardless of the
failure path, the unwrapped `bytearray` is always zeroed before the exception
propagates.

### Validate buffer sizes

`ed25519_signing_key_from_wrapped_secret` enforces the documented buffer
lengths.

```python
from algokit_crypto import (
    WrappedEd25519Seed,
    ed25519_signing_key_from_wrapped_secret,
)


class BadSeed:
    def unwrap_ed25519_seed(self) -> bytearray:
        return bytearray(31)  # wrong length

    def wrap_ed25519_seed(self) -> None:
        pass


ed25519_signing_key_from_wrapped_secret(BadSeed())
# Raises ValueError: "Expected unwrapped ed25519 seed to be 32 bytes, got 31."
```

**What just happened:** Every unwrap call is length-checked against
`ED25519_SEED_SIZE` (32) or `ED25519_EXTENDED_PRIVATE_KEY_LENGTH` (96), and
any mismatch is reported via `ValueError` with a precise message identifying
the expected type and the actual length. This check runs on the initial
public-key derivation *and* on every sign call, so a store that intermittently
returns truncated buffers will fail loudly rather than producing invalid
signatures.
