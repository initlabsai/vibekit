---
name: algokit-utils-py
description: >
  Guide for writing Python code with AlgoKit Utils (`algokit-utils`).
  Use this skill whenever the user is building on Algorand with Python — client setup,
  account management, payments, ASA operations, atomic transaction groups, smart contract
  deployment and interaction (AppFactory, AppClient, ARC-56/ARC-32 specs), raw app calls,
  TEAL compilation, key registration, network management, error handling, and the low-level
  crypto primitives in `algokit_crypto` (Ed25519 keygen/signing/verification, Peikert xHD
  BIP44 wallets, wrapped-secret patterns) and `algokit_common` (`sha512_256`). Trigger on
  imports from `algokit_utils` or `algokit_crypto`, references to `AlgorandClient`,
  `AppFactory`, `AppClient`, `AlgoAmount`, `ed25519_generator`, `peikert_hd_wallet_generator`,
  `sha512_256`, `WrappedEd25519Seed`, or `RawEd25519Signer`, or any Python code that builds on
  Algorand.
---

# AlgoKit Utils Python — Quick Reference

This skill targets **version 5.x** of `algokit-utils`.

This skill provides idiomatic patterns for `algokit-utils` (Python).
When helping users, prefer the patterns below over raw `algosdk` calls — AlgoKit Utils wraps the
SDK with higher-level, type-safe abstractions.

## How to use this skill

Reference docs are split into individual files under `references/`. Only read the file(s) relevant
to the user's question — this keeps context lean. The table below maps topics to filenames.

## Key concepts

- **AlgorandClient** is the single entry point. Create one via `AlgorandClient.default_localnet()`,
  `.testnet()`, `.mainnet()`, `.from_config()`, `.from_clients()`, or `.from_environment()`.
- **AlgoAmount** provides type-safe Algo/microAlgo values. Use `algo(5)`, `micro_algo(1000)`,
  `AlgoAmount.from_algo(5)`, or `AlgoAmount(algo=5)`.
- **AccountManager** (`algorand.account.*`) handles key generation, mnemonics, multisig, logic
  sigs, rekeyed accounts, funding, and signer registration.
- **TransactionComposer** (`algorand.new_group()`) builds atomic groups with fluent chaining.
  Supports `.add_payment()`, `.add_asset_transfer()`, `.add_app_call_method_call()`, etc.
- **AppFactory** creates and deploys smart contracts from ARC-56/ARC-32 app specs. Supports
  idempotent deploy with `on_update`/`on_schema_break` strategies and template variable substitution.
- **AppClient** interacts with deployed contracts — ABI method calls, state reads (global, local,
  box), bare calls, and the `params` builder for deferred composition.
- **Raw app calls** via `algorand.send.app_call()`, `.app_create()`, `.app_update()`,
  `.app_delete()`, `.app_call_method_call()`, `.app_create_method_call()` when you don't have an app spec.
- **TEAL compilation** via `algorand.app.compile_teal()` and `.compile_teal_template()` with
  caching and template variable substitution.
- **Crypto primitives** live in the standalone `algokit_crypto` package that ships alongside
  `algokit-utils`. This module carries Ed25519 keypair generation/signing/verification
  (`ed25519_generator`, `ed25519_verifier`), the Peikert xHD BIP44 wallet
  (`peikert_hd_wallet_generator`), and the wrapped-secret pattern for HSM/KMS-backed keys
  (`WrappedEd25519Seed`, `WrappedHdExtendedPrivateKey`,
  `ed25519_signing_key_from_wrapped_secret`). The Algorand SHA-512/256 primitive lives in
  `algokit_common` as `sha512_256`. Reach for these when you are building a custom
  `RawEd25519Signer`, deriving deterministic accounts from a seed, or computing
  Algorand-compatible hashes outside the transaction path.

## Key Python-specific differences from TypeScript

- Parameter objects use dataclasses (e.g., `PaymentParams`, `AssetCreateParams`) — pass them
  positionally to `algorand.send.*` methods.
- `AlgoAmount.algo` returns `Decimal` (not `number`); `.micro_algo` returns `int` (not `bigint`).
- `asset_opt_out()` takes `ensure_zero_balance` as a keyword argument outside the params object.
- `from_clients()` accepts pre-created SDK clients (`AlgodClient`, `IndexerClient`, `KmdClient`).
- Error types: `LogicError` (AVM failures), `TransactionComposerError` (group failures).
- Error transformers are sync functions `(Exception) -> Exception`, not async.

## Reference file index

Read only the file(s) relevant to the user's current question.

| File | What it covers |
|------|---------------|
| `references/getting-started.md` | Installation (`pip install algokit-utils`), imports, LocalNet prerequisites |
| `references/client-initialization.md` | LocalNet, TestNet, MainNet, custom config, from_clients, env vars |
| `references/account-management.md` | Random accounts, mnemonics, rekeyed, multisig, logic sigs, funding, signers |
| `references/algoamount-and-value-handling.md` | `algo()`, `micro_algo()`, conversions, transaction fees |
| `references/payment-transactions.md` | Simple payments, unsigned txns, notes, leases, fee control, close account |
| `references/asset-operations.md` | Create, opt-in/out, transfer, freeze, config, destroy, bulk ops, get info |
| `references/key-registration.md` | Online/offline key registration for consensus participation |
| `references/transaction-composition.md` | Atomic groups, multi-signer, atomic swaps, build/send/simulate, clone |
| `references/smart-contract-deployment.md` | AppFactory, bare/ABI create, idempotent deploy, template vars |
| `references/smart-contract-interaction.md` | AppClient, ABI calls, bare calls, global/local/box state, params builder |
| `references/raw-app-calls.md` | Low-level app create/call/update/delete, ABI method calls without app spec |
| `references/compile-teal.md` | compile_teal, compile_teal_template, template variable substitution |
| `references/network-and-client-management.md` | Algod/indexer/kmd access, LocalNet detection, validity window, params cache |
| `references/configuration-and-global-settings.md` | `populate_app_call_resources`, debug mode, trace collection, logging |
| `references/error-handling.md` | LogicError, parse_logic_error, TransactionComposerError, error transformers |
| `references/ed25519.md` | Ed25519 keypair generation, raw signers, signature verification, pinned PyNaCl backend |
| `references/hashing.md` | Algorand SHA-512/256 `sha512_256`, multisig and logic sig address construction |
| `references/hd-wallets.md` | `peikert_hd_wallet_generator`, BIP44 paths, multi-account derivation, wiring into `AccountManager` |
| `references/wrapped-secrets.md` | `WrappedEd25519Seed`, `WrappedHdExtendedPrivateKey`, `ed25519_signing_key_from_wrapped_secret`, HSM/KMS patterns |

## Common patterns to remember

- `algorand.send.*` builds, signs, and submits in one call.
- `algorand.create_transaction.*` builds without signing or sending.
- `app_client.params.*` builds call params for deferred use in groups.
- `app_client.send.bare.*` for bare calls; `app_client.send.call()` for ABI calls.
- Readonly ABI methods (marked in ARC-56) automatically use `simulate` — no fees spent.
- `algorand.account.ensure_funded()` is idempotent — skips if balance is already sufficient.
- `factory.deploy()` is idempotent — creates, updates, replaces, or no-ops based on state.
- Use `config.configure(populate_app_call_resources=True)` to auto-populate app call resources.
- `Method.from_signature("hello(string)string")` for raw ABI method calls without app spec.
- `generate_address_with_signers(ed25519_pubkey, raw_ed25519_signer)` from `algokit_transact`
  takes the pubkey and raw signer as separate positional args (plus an optional
  `sending_address` kwarg for rekeyed wiring) — unlike the TypeScript helper, it does not
  accept a single `Ed25519SigningKey` object. Pass its `.signer` to
  `algorand.account.set_signer(addr, signer)` — hardware wallets, KMS, and HD-derived keys all
  plug in through this one entry point.
- `ed25519_generator`, `ed25519_verifier`, and `ed25519_signing_key_from_wrapped_secret` are
  aliases that currently point at the PyNaCl-backed `pynacl_*` variants. Import the `pynacl_*`
  names directly when you need to pin the backend across future releases.
- `ed25519_signing_key_from_wrapped_secret` always zeroes the unwrapped `bytearray` after use
  and raises an `ExceptionGroup` (from the `exceptiongroup` backport) when both the operation
  and the re-wrap fail — never catch and discard it silently.
- The Peikert HD wallet seed size is **64 bytes** in Python (vs. 32 bytes in TypeScript).
- Python crypto is fully synchronous — `raw_ed25519_signer(bytes)` returns `bytes`, not a
  coroutine.
