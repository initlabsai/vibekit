# AVM Execution Model

## Program Structure

Every smart contract has **two programs**:

| Program | Purpose | When Executed |
|---------|---------|---------------|
| **Approval Program** | Main contract logic | All app calls except ClearState |
| **Clear State Program** | Cleanup logic | Only on ClearState (`OnComplete.ClearStateOC`) |

The Approval Program must succeed by leaving a single non-zero `uint64` on the stack. The Puya compiler generates both programs from your contract class.

### Clear State Special Rules

- If the Clear State Program **fails**, the transaction still succeeds but app state changes are rolled back
- The sender's Local State for that app is **always removed** regardless of outcome
- Clear State has a **limited opcode budget** (700, not poolable) — keep it simple
- Never put critical authorization logic in Clear State — users can always clear their state

## The Stack

| Property | Value |
|----------|-------|
| Initial state | Empty |
| Value types | `uint64` or `bytes` only |
| Max depth | 1000 values |
| Max `bytes` value size | 4096 bytes |

Type mismatches (e.g., adding `bytes` to `uint64`) cause immediate program failure.

## Scratch Space

256 general-purpose storage slots, per-execution (resets between transactions). Use for temporary values. The `gload` opcode reads another transaction's scratch space within the same atomic group.

## Opcode Budget

| Context | Budget |
|---------|--------|
| Single app call | 700 |
| Pooled (app calls in group) | 700 × number of app calls |
| Max pooled (16 app calls) | 11,200 |
| Inner app calls (since v6) | Each adds 700 to the pool |
| Max with inner txns | 700 × (16 outer + 256 inner) = 190,400 theoretical max |
| Logic Signature | 20,000 (not poolable) |

All application calls in an atomic group share a single opcode budget pool. If your contract needs more than 700 opcodes, add app calls to the group to increase the pool. Inner app calls also contribute 700 each.

### Expensive Opcodes

Most opcodes cost 1. These are significantly more expensive:

| Opcode | Cost | Purpose |
|--------|------|---------|
| `ed25519verify` | 1900 | Ed25519 signature verification |
| `ed25519verify_bare` | 1900 | Ed25519 bare verify |
| `ecdsa_verify` | Secp256k1=1700; Secp256r1=2500 | ECDSA signature verification |
| `ecdsa_pk_recover` | 2000 | ECDSA public key recovery |
| `ecdsa_pk_decompress` | Secp256k1=650; Secp256r1=2400 | ECDSA decompress public key |
| `falcon_verify` | 1700 | Falcon post-quantum signature verification |
| `vrf_verify` | 5700 | VRF proof verification |
| `ec_pairing_check` | Variable (min 15,400 for BN254) | Elliptic curve pairing check |
| `ec_scalar_mul` | Variable (1,810 for BN254g1) | Elliptic curve scalar multiplication |
| `keccak256` | 130 | Keccak-256 hash |
| `sha3_256` | 130 | SHA3-256 hash |
| `sha512_256` | 45 | SHA-512/256 hash |
| `sha256` | 35 | SHA-256 hash |

A single `ed25519verify` uses 1900 of your 700 base budget — you need at least 3 app calls in the group to cover it.

## Program Size

| Parameter | Value |
|-----------|-------|
| Base program page size | 2048 bytes |
| Extra pages allowed | 0 to 3 |
| Max program size | 2048 × (1 + extra_pages) = up to 8192 bytes |
| Approval + Clear combined | Must not exceed `MaxAppTotalProgramLen × (1 + ExtraProgramPages)` |
| Logic Signature max size | 1000 bytes |

Extra pages are declared at app creation time and **cannot be changed**. Each extra page increases MBR by 100,000 µAlgo.

## Transaction Types

| Type Code | Name | Description |
|-----------|------|-------------|
| `pay` | Payment | Transfer ALGO between accounts |
| `axfer` | Asset Transfer | Transfer ASAs (includes opt-in and clawback) |
| `acfg` | Asset Config | Create, reconfigure, or destroy ASAs |
| `afrz` | Asset Freeze | Freeze or unfreeze an account's ASA holding |
| `appl` | Application Call | Call a smart contract (with OnComplete action) |
| `keyreg` | Key Registration | Register or deregister participation keys |
| `stpf` | State Proof | Submit state proofs (system use) |

## OnComplete Actions

Every application call specifies an OnComplete action:

| Action | Description |
|--------|-------------|
| `NoOp` | Default — execute the application |
| `OptIn` | Opt the sender into the application's local state |
| `CloseOut` | Close out the sender's local state |
| `ClearState` | Unconditionally remove sender's local state (runs Clear State Program) |
| `UpdateApplication` | Update the application's programs |
| `DeleteApplication` | Delete the application |

## Re-entrancy

Applications **cannot call themselves**, even indirectly through a chain of inner transactions. The AVM enforces this prohibition — any attempt to re-enter an application that is already on the call stack will fail.

## Logic Signatures

A Logic Signature (LogicSig) is a stateless program that authorizes transactions on behalf of an account. Unlike smart contracts, logic signatures:

- Have no state (no Global/Local/Box storage)
- Have a fixed 20,000 opcode budget (not poolable)
- Are limited to 1,000 bytes in size
- Cannot issue inner transactions
- Evaluate a single transaction and approve or reject it

Logic signatures can be used as **escrow accounts** (the program hash becomes the account address) or as **delegated signatures** (signed by an account to authorize specific transaction patterns).

## Box I/O Budget

Each box reference in a transaction provides **2,048 bytes** of I/O budget. Boxes larger than 2,048 bytes require multiple box references to read or write. For example, a 6,000-byte box needs at least 3 box references (⌈6000/2048⌉ = 3). This is a common source of "box reference" errors.

## Transaction Execution Flow

Transactions arrive in atomic groups (1–16). All app calls in a group share the opcode budget pool. State changes are committed atomically — any failure rolls back ALL changes (except ClearState local state removal).
