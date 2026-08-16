# AVM Resource Limits

All values are consensus parameters enforced by the protocol. Current AVM version: 12 (consensus v41).

## Program Limits

| Parameter | Value | Consensus Variable |
|-----------|-------|--------------------|
| Program page size | 2048 bytes | `MaxAppProgramLen` |
| Max extra pages | 3 | `MaxExtraAppProgramPages` |
| Max total program size | 8192 bytes | 2048 × (1 + 3) |
| Logic Signature max size | 1000 bytes | `LogicSigMaxSize` |
| Logic Signature max cost | 20,000 | `LogicSigMaxCost` |

## Execution Limits

| Parameter | Value | Consensus Variable |
|-----------|-------|--------------------|
| Opcode budget per app call | 700 | `MaxAppProgramCost` |
| Max pooled budget (16 app calls) | 11,200 | 700 × 16 |
| Max pooled with inner txns | 190,400 | 700 × (16 + 256) |
| Stack depth | 1000 values | `MaxStackDepth` |
| Max `bytes` value size | 4096 bytes | `MaxStringSize` |
| Scratch space slots | 256 | — |

## Transaction Limits

| Parameter | Value | Consensus Variable |
|-----------|-------|--------------------|
| Max group size | 16 transactions | `MaxTxGroupSize` |
| Max inner transactions per app call | 16 | `MaxInnerTransactions` |
| Max inner transactions per group (pooled) | 256 | 16 × `MaxTxGroupSize` |
| Max inner transaction depth | 8 levels | Hardcoded in protocol spec |
| Min transaction fee | 1000 microAlgo | `MinTxnFee` |

## State Storage Limits

### Global State

| Parameter | Value |
|-----------|-------|
| Max key-value pairs | 64 |
| Max key size | 64 bytes |
| Max key + value size | 128 bytes (`MaxAppSumKeyValueLens`) |

A 64-byte key leaves only 64 bytes for the value. Plan key names accordingly.

### Local State (per account per app)

| Parameter | Value |
|-----------|-------|
| Max key-value pairs | 16 |
| Max key size | 64 bytes |
| Max key + value size | 128 bytes (`MaxAppSumKeyValueLens`) |

Same combined limit as global state — key + value must fit in 128 bytes.

### Box Storage

| Parameter | Value |
|-----------|-------|
| Max box size | 32,768 bytes (32 KB) |
| Box name min | 1 byte |
| Box name max | 64 bytes |
| Max boxes per app | Limited only by MBR funding |
| I/O budget per box reference | 2,048 bytes |

**Box I/O budget:** Each box reference in a transaction provides 2,048 bytes of read/write budget. Boxes larger than 2,048 bytes require multiple box references (⌈box_size / 2048⌉). For example, a 6,000-byte box needs at least 3 box references.

## Application Call Limits

| Parameter | Value |
|-----------|-------|
| Max app arguments | 16 |
| Max total argument bytes | 2048 |
| Max foreign accounts | 8 |
| Max foreign assets | 8 |
| Max foreign apps | 8 |
| Max box references | 8 |
| **Max total references (shared across all types)** | **8** |
| Max access list entries (v12+) | 16 |

The `MaxAppTotalTxnReferences = 8` limit means the **combined total** of foreign accounts, assets, apps, and box references is 8 — not 8 of each type. In AVM v12+, the `txn.Access` list is a mutually exclusive alternative supporting up to 16 entries.

## Logging Limits

| Parameter | Value |
|-----------|-------|
| Max log calls per app call | 32 |
| Max total log bytes per app call | 1024 |

## Minimum Balance Requirements (MBR)

### Account MBR

| Item | MBR (microAlgo) |
|------|-----------------|
| Base account | 100,000 |
| Per opted-in asset | +100,000 |
| Per created asset | +100,000 |
| Per opted-in application | +100,000 |
| Per created application | +100,000 |

### Application State MBR

| State Type | Per uint64 Slot | Per bytes Slot |
|-----------|----------------|---------------|
| Global state | 28,500 µAlgo | 50,000 µAlgo |
| Local state (per opt-in) | 28,500 µAlgo | 50,000 µAlgo |

Formula: `SchemaMinBalancePerEntry(25,000) + SchemaUintMinBalance(3,500)` for uint64, `SchemaMinBalancePerEntry(25,000) + SchemaBytesMinBalance(25,000)` for bytes.

### Box Storage MBR

```
Box MBR = 2,500 + 400 × (box_name_length + box_value_length)
```

| Example | Calculation | MBR |
|---------|-------------|-----|
| 1-byte name, 100-byte value | 2,500 + 400 × 101 | 42,900 µAlgo |
| 4-byte name, 1024-byte value | 2,500 + 400 × 1,028 | 413,700 µAlgo |
| 32-byte name, 32,768-byte value | 2,500 + 400 × 32,800 | 13,122,500 µAlgo (~13.1 Algo) |

### Extra Program Pages MBR

Each extra program page adds 100,000 µAlgo to the app creator's MBR.

## Transaction Fees

| Fee Type | Amount |
|----------|--------|
| Minimum fee | 1,000 µAlgo per transaction |
| Fee pooling in groups | Excess fee on one txn covers deficit on another |
| Inner transaction fees | Can be 0 if outer txn covers via fee pooling |
