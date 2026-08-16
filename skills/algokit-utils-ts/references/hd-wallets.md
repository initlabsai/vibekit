## HD wallets

> All snippets below import from `@algorandfoundation/algokit-utils/crypto`.
> The Peikert xHD generator lives in the same low-level crypto module as the
> raw Ed25519 helpers and is the lowest-level HD primitive in the library.
> For everyday account creation, prefer `algorand.account.random()` or
> `algorand.account.fromMnemonic(...)` — the HD helpers below are for
> deterministic multi-account derivation from a shared seed.

### Create a random Peikert xHD wallet

Generate a fresh BIP32-style HD root key along with an account-derivation helper.

```typescript
import { peikertXHdWalletGenerator } from "@algorandfoundation/algokit-utils/crypto";

const { hdRootKey, accountGenerator } = await peikertXHdWalletGenerator();

console.log(hdRootKey.length); // Root key bytes from fromSeed()
```

**What just happened:** `peikertXHdWalletGenerator()` with no arguments generates a
random 32-byte seed internally, expands it to a BIP32-extended root key using
`@algorandfoundation/xhd-wallet-api`'s `fromSeed`, and returns both the root key and
an `accountGenerator(account, index)` function. The root key is what you would
persist (wrapped — see [Wrapped secrets](#wrapped-secrets)) if you want to
reconstruct the wallet later. Because no seed was provided, the wallet is
non-deterministic and cannot be recovered from the seed alone.

### Create a deterministic HD wallet from a seed

Pass a 32-byte seed (for example derived from a BIP39 mnemonic) to produce the
same wallet every time.

```typescript
import { peikertXHdWalletGenerator } from "@algorandfoundation/algokit-utils/crypto";

declare const seed: Uint8Array; // 32 bytes, e.g. from a BIP39 mnemonic

const { hdRootKey, accountGenerator } = await peikertXHdWalletGenerator(seed);
```

**What just happened:** When you supply a seed, it is used directly as the input to
`fromSeed`, so the resulting root key and every account derived from it are fully
deterministic in the seed. Typical sources of the seed are the 64-byte BIP39 seed
(truncated or hashed to 32 bytes by your caller) or a raw 32-byte value from a key
management system. Never commit a real seed to source control.

### Derive an account at a BIP44 path

Use the returned `accountGenerator` to derive the keypair for a specific
`account'/0/index` pair.

```typescript
import { peikertXHdWalletGenerator } from "@algorandfoundation/algokit-utils/crypto";

const { accountGenerator } = await peikertXHdWalletGenerator();

const {
  ed25519Pubkey,
  extendedPrivateKey,
  bip44Path,
  rawEd25519Signer,
} = await accountGenerator(0, 0);

console.log(bip44Path); // [harden(44), harden(283), harden(0), 0, 0]
console.log(extendedPrivateKey.length); // 96
```

**What just happened:** `accountGenerator(account, index)` derives the keypair at
BIP44 path `m/44'/283'/account'/0/index` using the Peikert xHD derivation rules.
`283` is the Algorand coin type registered in SLIP-0044. The returned object
includes the derived public key, a raw signer bound to the derived secret, the
96-byte extended private key (scalar `||` prefix `||` chain code), and the
path as a tuple of five numbers with the hardened indices already offset.

### Derive multiple accounts from the same wallet

Call `accountGenerator` repeatedly to derive additional accounts without
regenerating the wallet.

```typescript
import { peikertXHdWalletGenerator } from "@algorandfoundation/algokit-utils/crypto";

declare const seed: Uint8Array;
const { accountGenerator } = await peikertXHdWalletGenerator(seed);

const accountZero = await accountGenerator(0, 0);
const accountOne = await accountGenerator(1, 0);
const accountOneSecondAddress = await accountGenerator(1, 1);
```

**What just happened:** Each call to `accountGenerator` performs an independent
derivation from the shared root key. Changing the `account` index changes the
hardened BIP44 account segment (`283'/account'`), while changing the second index
advances the non-hardened address index. Use different `account` values for
logically separate identities (for example a hot wallet vs. a trading bot), and
advance the address index to generate additional addresses within the same
identity.

### Turn an HD-derived account into an AlgorandClient signer

Feed the derived keypair straight into `AccountManager.setSigner` (or the
`generateAddressWithSigners` helper in `algokit-utils/transact`) to use it for
Algorand transactions.

```typescript
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { peikertXHdWalletGenerator } from "@algorandfoundation/algokit-utils/crypto";
import { generateAddressWithSigners } from "@algorandfoundation/algokit-utils/transact";

const algorand = AlgorandClient.defaultLocalNet();

const { accountGenerator } = await peikertXHdWalletGenerator();
const generated = await accountGenerator(0, 0);

const addressWithSigners = generateAddressWithSigners(generated);
algorand.account.setSigner(addressWithSigners.addr, addressWithSigners.signer);

console.log(addressWithSigners.addr.toString()); // e.g. "XBYLS2E6YI6XXL5BWC..."
```

**What just happened:** The object returned from `accountGenerator` already matches
the `Ed25519SigningKey` shape (`{ ed25519Pubkey, rawEd25519Signer }`), so
`generateAddressWithSigners` accepts it directly and produces the full set of
Algorand signers — transaction signer, logic sig signer, program data signer, and
mx bytes signer — bound to the derived account. Registering the resulting signer
with `algorand.account.setSigner` wires the HD-derived account into the standard
`algorand.send.*` flow.
