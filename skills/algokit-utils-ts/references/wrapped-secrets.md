## Wrapped secrets

> All snippets below import from `@algorandfoundation/algokit-utils/crypto`.
> The wrapped-secret pattern keeps Ed25519 seeds and HD extended private keys
> out of long-lived memory: a secret is unwrapped for a single operation,
> consumed, then immediately re-wrapped and zeroed. Use it when you are
> integrating with an HSM, KMS, or any store that re-encrypts key material
> between uses.

### Implement a WrappedEd25519Seed

Provide an unwrap/re-wrap pair for a 32-byte Ed25519 seed so the seed spends as
little time unwrapped in memory as possible.

```typescript
import type { WrappedEd25519Seed } from "@algorandfoundation/algokit-utils/crypto";

function makeWrappedSeed(store: {
  read: () => Promise<Uint8Array>;
  lock: () => Promise<void>;
}): WrappedEd25519Seed {
  return {
    unwrapEd25519Seed: async () => {
      // Return a 32-byte seed — for example decrypted from a secure store.
      return store.read();
    },
    wrapEd25519Seed: async () => {
      // Re-lock / re-encrypt / discard the in-memory seed here.
      await store.lock();
    },
  };
}
```

**What just happened:** `WrappedEd25519Seed` is a two-method interface:
`unwrapEd25519Seed` returns exactly 32 plaintext bytes, and `wrapEd25519Seed` is
called afterwards to clean up (re-encrypt, flush buffers, touch hardware, etc.).
The consumer — typically `ed25519SigningKeyFromWrappedSecret` — is responsible for
invoking both and for zeroing the unwrapped buffer. Your implementation only has
to move bytes in and out of your storage layer.

### Implement a WrappedHdExtendedPrivateKey

Provide an unwrap/re-wrap pair for a 96-byte HD extended private key.

```typescript
import type { WrappedHdExtendedPrivateKey } from "@algorandfoundation/algokit-utils/crypto";

function makeWrappedExtendedKey(store: {
  read: () => Promise<Uint8Array>;
  lock: () => Promise<void>;
}): WrappedHdExtendedPrivateKey {
  return {
    unwrapHdExtendedPrivateKey: async () => {
      // Return exactly 96 bytes: scalar (zL) || prefix (zR) || chain_code.
      return store.read();
    },
    wrapHdExtendedPrivateKey: async () => {
      await store.lock();
    },
  };
}
```

**What just happened:** `WrappedHdExtendedPrivateKey` carries a 96-byte value
laid out as `scalar (32) || prefix (32) || chain_code (32)`. Only the first 64
bytes are used for signing — if your store only keeps those 64 bytes, your unwrap
function must pad the chain code back to 96 bytes before returning (typically
with zeros, since the chain code is not needed for signing). Consumers enforce
the 96-byte length and will throw if the buffer is the wrong size.

### Create a signing key from a wrapped seed

Turn a `WrappedEd25519Seed` into an `Ed25519SigningKey` whose signer handles
unwrap, sign, re-wrap, and zeroing automatically.

```typescript
import {
  ed25519SigningKeyFromWrappedSecret,
  type WrappedEd25519Seed,
} from "@algorandfoundation/algokit-utils/crypto";

declare const wrappedSeed: WrappedEd25519Seed;

const signingKey = await ed25519SigningKeyFromWrappedSecret(wrappedSeed);

const message = new TextEncoder().encode("Hello, Algorand!");
const signature = await signingKey.rawEd25519Signer(message);
```

**What just happened:** `ed25519SigningKeyFromWrappedSecret` inspected the wrapped
object, saw `unwrapEd25519Seed`/`wrapEd25519Seed`, and unwrapped the seed once
immediately to derive the public key. It then returned an `Ed25519SigningKey`
whose `rawEd25519Signer` unwraps the seed again on every call, signs the bytes
via `@noble/ed25519`, re-wraps the seed in a `finally` block, and finally
`fill(0)`s the unwrapped buffer — so plaintext seed material exists in memory
only for the duration of a single sign call.

### Create a signing key from a wrapped HD extended key

The same helper accepts a `WrappedHdExtendedPrivateKey` and dispatches to the HD
signing path instead.

```typescript
import {
  ed25519SigningKeyFromWrappedSecret,
  type WrappedHdExtendedPrivateKey,
} from "@algorandfoundation/algokit-utils/crypto";

declare const wrappedExtendedKey: WrappedHdExtendedPrivateKey;

const signingKey = await ed25519SigningKeyFromWrappedSecret(wrappedExtendedKey);
const signature = await signingKey.rawEd25519Signer(
  new TextEncoder().encode("Hello, Algorand!"),
);
```

**What just happened:** When the wrapped object exposes
`unwrapHdExtendedPrivateKey`/`wrapHdExtendedPrivateKey`, the helper uses the
package's internal `rawSign` (which consumes a 64-byte HD-expanded secret) rather
than `@noble/ed25519.signAsync`. The 96-byte buffer is validated for length on
every unwrap, bit 255 of the scalar is required to be clear, and the buffer is
zeroed after each use with the same try/finally discipline as the seed path.

### Use the pinned Noble variant explicitly

Import `nobleEd25519SigningKeyFromWrappedSecret` when you need to guarantee the
current backend.

```typescript
import {
  nobleEd25519SigningKeyFromWrappedSecret,
  type WrappedEd25519Seed,
} from "@algorandfoundation/algokit-utils/crypto";

declare const wrappedSeed: WrappedEd25519Seed;

const signingKey = await nobleEd25519SigningKeyFromWrappedSecret(wrappedSeed);
```

**What just happened:** `ed25519SigningKeyFromWrappedSecret` is an alias for
`nobleEd25519SigningKeyFromWrappedSecret`. If you want to pin the
`@noble/ed25519`-backed implementation specifically — and be insulated from future
default-repointing — import the `noble*` name directly.

### Handle unwrap and re-wrap failures

When the underlying operation and the re-wrap both fail, you receive an
`AggregateError` carrying both.

```typescript
import {
  ed25519SigningKeyFromWrappedSecret,
  type WrappedEd25519Seed,
} from "@algorandfoundation/algokit-utils/crypto";

const failingSeed: WrappedEd25519Seed = {
  unwrapEd25519Seed: async () => {
    throw new Error("unwrap failed");
  },
  wrapEd25519Seed: async () => {
    throw new Error("wrap failed");
  },
};

try {
  await ed25519SigningKeyFromWrappedSecret(failingSeed);
} catch (error) {
  if (error instanceof AggregateError) {
    console.error(error.message); // "Deriving Ed25519 public key failed and failed to re-wrap Ed25519 secret..."
    console.error(error.errors); // [unwrapError, wrapError]
  }
}
```

**What just happened:** When public-key derivation or signing throws *and* the
subsequent re-wrap also throws, the helper raises an `AggregateError` whose
`errors` array contains both the operation error and the wrap error in order.
This guarantees that neither failure is silently swallowed — both are visible to
your caller. If only one of the two fails, that single error is re-thrown
directly. Regardless of the failure path, the unwrapped secret buffer is always
zeroed before the exception propagates.

### Validate buffer sizes

`ed25519SigningKeyFromWrappedSecret` enforces the documented buffer lengths.

```typescript
import {
  ed25519SigningKeyFromWrappedSecret,
  type WrappedEd25519Seed,
} from "@algorandfoundation/algokit-utils/crypto";

const badSeed: WrappedEd25519Seed = {
  unwrapEd25519Seed: async () => new Uint8Array(31), // wrong length
  wrapEd25519Seed: async () => {},
};

await ed25519SigningKeyFromWrappedSecret(badSeed);
// Throws: "Expected unwrapped ed25519 seed to be 32 bytes, got 31."
```

**What just happened:** Every unwrap call is length-checked against
`ED25519_SEED_LENGTH` (32) or `ED25519_EXTENDED_PRIVATE_KEY_LENGTH` (96), and any
mismatch is reported with a precise error message identifying the expected type
and the actual length. This check runs on the initial public-key derivation *and*
on every sign call, so a store that intermittently returns truncated buffers
will fail loudly rather than producing invalid signatures.
