## HD wallets

> All snippets below import from `algokit_crypto`. The Peikert xHD generator
> lives in the same low-level crypto module as the raw Ed25519 helpers and is
> the lowest-level HD primitive in the library. For everyday account creation,
> prefer `algorand.account.random()` or `algorand.account.from_mnemonic(...)` —
> the HD helpers below are for deterministic multi-account derivation from a
> shared seed.

### Create a random Peikert xHD wallet

Generate a fresh BIP32-style HD root key along with an account-derivation
helper.

```python
from algokit_crypto import peikert_hd_wallet_generator

wallet = peikert_hd_wallet_generator()
root_key = wallet["hd_root_key"]
account_generator = wallet["account_generator"]

print(len(root_key))  # 96 — extended private key from from_seed()
```

**What just happened:** `peikert_hd_wallet_generator()` with no arguments draws
a random 64-byte seed internally (`os.urandom(64)`), expands it to a 96-byte
extended root key using `xhd_wallet_api_py.from_seed`, and returns an
`HdWalletResult` `TypedDict` with the root key and an
`account_generator(account, index)` function. The root key is what you would
persist (wrapped — see [Wrapped secrets](#wrapped-secrets)) if you want to
reconstruct the wallet later. Because no seed was provided, the wallet is
non-deterministic and cannot be recovered from the seed alone.

### Create a deterministic HD wallet from a seed

Pass a 64-byte seed (for example the output of a BIP39 mnemonic) to produce
the same wallet every time.

```python
from algokit_crypto import peikert_hd_wallet_generator

seed: bytearray = bytearray(64)  # 64 zero bytes — replace with real seed

wallet = peikert_hd_wallet_generator(seed)
```

**What just happened:** When you supply a seed it is used directly as the
input to `from_seed`, so the resulting root key and every account derived from
it are fully deterministic in the seed. `HD_WALLET_SEED_SIZE` is **64** in the
Python package — a seed of any other length raises
`ValueError: Seed must be 64 bytes`. The typical source is the raw 64-byte
BIP39 seed or a value drawn from a key management system. Never commit a real
seed to source control.

### Derive an account at a BIP44 path

Use the returned `account_generator` to derive the keypair for a specific
`account'/0/index` pair.

```python
from algokit_crypto import peikert_hd_wallet_generator

wallet = peikert_hd_wallet_generator()
account = wallet["account_generator"](0, 0)

print(account["bip44_path"])
# (0x8000002C, 0x8000011B, 0x80000000, 0, 0)
# == (harden(44), harden(283), harden(0), 0, 0)

print(len(account["extended_private_key"]))  # 96
```

**What just happened:** `account_generator(account, index)` derives the keypair
at BIP44 path `m/44'/283'/account'/0/index` using the Peikert xHD derivation
rules. `283` is the Algorand coin type registered in SLIP-0044. The returned
`HdAccountResult` `TypedDict` includes the derived public key, a raw signer
bound to the derived secret, the 96-byte extended private key (scalar `||`
prefix `||` chain code) as a `bytearray`, and the path as a 5-tuple with the
hardened indices already OR-ed with `HARDENED_BIT` (`0x80000000`).

### Derive multiple accounts from the same wallet

Call `account_generator` repeatedly to derive additional accounts without
regenerating the wallet.

```python
from algokit_crypto import peikert_hd_wallet_generator

seed: bytearray = ...  # 64 bytes
wallet = peikert_hd_wallet_generator(seed)
account_generator = wallet["account_generator"]

account_zero = account_generator(0, 0)
account_one = account_generator(1, 0)
account_one_second_address = account_generator(1, 1)
```

**What just happened:** Each call to `account_generator` performs an
independent derivation from the shared root key. Changing the `account` index
changes the hardened BIP44 account segment (`283'/account'`), while changing
the second index advances the non-hardened address index. Use different
`account` values for logically separate identities (for example a hot wallet
vs. a trading bot), and advance the address index to generate additional
addresses within the same identity.

### Turn an HD-derived account into an AlgorandClient signer

Feed the derived keypair through `generate_address_with_signers` and register
the resulting signer on `AccountManager` to use it for Algorand transactions.

```python
from algokit_crypto import peikert_hd_wallet_generator
from algokit_transact import generate_address_with_signers
from algokit_utils import AlgorandClient

algorand = AlgorandClient.default_localnet()

wallet = peikert_hd_wallet_generator()
account = wallet["account_generator"](0, 0)

address_with_signers = generate_address_with_signers(
    account["ed25519_pubkey"],
    account["raw_ed25519_signer"],
)
algorand.account.set_signer(address_with_signers.addr, address_with_signers.signer)

print(address_with_signers.addr)  # e.g. "XBYLS2E6YI6XXL5BWC..."
```

**What just happened:** Unlike the TypeScript helper, the Python
`generate_address_with_signers` takes the public key and the raw signer as
separate positional arguments (plus an optional `sending_address` keyword for
rekeyed wiring) rather than a single object. It returns an
`AddressWithSigners` dataclass with the full set of Algorand signers —
transaction signer, delegated logic sig signer, program-data signer,
bytes-signer, and mx-bytes signer — bound to the derived account. Registering
the returned `.signer` with `algorand.account.set_signer(sender, signer)`
wires the HD-derived account into the standard `algorand.send.*` flow.
