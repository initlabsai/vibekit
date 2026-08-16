## Account management

> All snippets in this section assume an `AlgorandClient` instance named `algorand` — see [Client initialization](#client-initialization) for setup.

### Create a random account

Generate a fresh, random Algorand account ready to sign transactions.

```python
account = algorand.account.random()
print(account.addr)
```

**What just happened:** You created a new Algorand keypair in memory and registered it with the `AccountManager`. The returned `AddressWithSigners` contains the address (`addr`) and a `signer` that can authorise transactions from that address. The private key never leaves the process.

### Create an account from a mnemonic

Restore an existing account from its 25-word mnemonic phrase.

```python
account = algorand.account.from_mnemonic(
    mnemonic="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest",
)
```

**What just happened:** The mnemonic was converted to a seed, then to an Ed25519 keypair. The account is now tracked by the `AccountManager` and its signer is available for any transaction sent from that address. Never hard-code mnemonics in source — load them from environment variables or a secrets manager.

### Create a rekeyed account

Use one account's private key to sign on behalf of a different (rekeyed) address.

```python
auth_account = algorand.account.random()

rekeyed = algorand.account.rekeyed(
    sender="REKEYED_ACCOUNT_ADDRESS...",
    account=auth_account,
)
```

**What just happened:** The `AccountManager` now knows that `sender` (the rekeyed address) should be signed using `auth_account`'s key. Rekeying itself is an on-chain operation that must have already been performed — this call only registers the local relationship so the SDK uses the correct signer.

### Create a multisig account

Set up a multisig account that requires M-of-N signatures.

```python
from algokit_transact import MultisigMetadata

account1 = algorand.account.random()
account2 = algorand.account.random()
account3 = algorand.account.random()

multisig = algorand.account.multisig(
    metadata=MultisigMetadata(
        version=1,
        threshold=2,
        addrs=[account1.addr, account2.addr, account3.addr],
    ),
    sub_signers=[account1, account2],
)

print(multisig.addr)
```

**What just happened:** You defined a 2-of-3 multisig account. The `addrs` list names all three participants, while `sub_signers` provides the two signers currently available. Transactions from this address will automatically collect signatures from account1 and account2 — meeting the threshold of 2.

### Create a logic signature account

Wrap compiled TEAL bytecode into a logic signature that can authorise transactions.

```python
program_bytes = b"\x06\x81\x01"  # #pragma version 6; int 1
lsig = algorand.account.logicsig(program=program_bytes)

print(lsig.addr)
```

**What just happened:** You created a `LogicSigAccount` from compiled TEAL program bytes and registered it with the `AccountManager`. Transactions sent from this address will be authorised by evaluating the TEAL program instead of checking a cryptographic signature. The address is deterministically derived from the program bytes.

### Set a default signer

Configure a fallback signer that is used whenever no address-specific signer is found.

```python
default_account = algorand.account.random()
algorand.set_default_signer(default_account)
```

**What just happened:** Any transaction whose sender doesn't have a registered signer will now be signed by `default_account`. This is handy during development when a single account funds and signs everything.

### Register a signer for a specific address

Map an external `TransactionSigner` to a particular sender address.

```python
from algokit_transact import TransactionSigner, make_empty_transaction_signer

my_external_signer: TransactionSigner = make_empty_transaction_signer()  # e.g. hardware wallet, custodial API

algorand.account.set_signer(
    sender="SENDERADDRESS...",
    signer=my_external_signer,
)
```

**What just happened:** You told the `AccountManager` to use your custom signer whenever a transaction needs to be signed for `SENDERADDRESS...`. This lets you integrate hardware wallets, KMS services, or any other external signing mechanism.

### Get account information

Retrieve an account's on-chain balance, minimum balance, assets, and more.

```python
info = algorand.account.get_information(account.addr)

print(f"Balance: {info.amount.algo} ALGO")
print(f"Min balance: {info.min_balance.algo} ALGO")
print(f"Assets opted in: {info.total_assets_opted_in}")
```

**What just happened:** You queried the algod node for the account's current on-chain state. The returned `AccountInformation` object wraps balances in `AlgoAmount` objects so you can access both `.algo` and `.micro_algo` representations. The `min_balance` reflects the minimum balance requirement based on the account's opted-in assets and apps.

### Ensure an account is funded

Top up an account so it has at least a given amount of spendable Algo, skipping the transfer if it already does.

```python
from algokit_utils import AlgoAmount

dispenser = algorand.account.localnet_dispenser()

result = algorand.account.ensure_funded(
    account_to_fund=account.addr,
    dispenser_account=dispenser.addr,
    min_spending_balance=AlgoAmount.from_algo(1),
)

if result:
    print(f"Funded {result.amount_funded.algo} ALGO via tx {result.transaction_id}")
else:
    print("Account already has enough ALGO")
```

**What just happened:** The `AccountManager` checked the account's current spendable balance (total balance minus minimum balance requirement). If it was below 1 ALGO, a payment transaction was sent from the dispenser to make up the difference. If the account already had enough, no transaction was sent and `None` was returned.

### Fund from the LocalNet dispenser

Use the default LocalNet dispenser account to send Algo directly.

```python
from algokit_utils import AlgoAmount

account = algorand.account.random()

algorand.account.ensure_funded_from_environment(
    account_to_fund=account.addr,
    min_spending_balance=AlgoAmount.from_algo(10),
)
```

**What just happened:** The `AccountManager` loaded the dispenser account from either the `DISPENSER_MNEMONIC` environment variable or the default LocalNet KMD wallet. It then checked whether the target account needed funds and, if so, sent a payment to bring its spendable balance up to 10 ALGO.

### Fund from the TestNet dispenser

Use the TestNet Dispenser API to fund an account on TestNet.

```python
from algokit_utils import AlgorandClient, AlgoAmount

algorand = AlgorandClient.testnet()
account = algorand.account.random()

dispenser_client = algorand.client.get_testnet_dispenser()

result = algorand.account.ensure_funded_from_testnet_dispenser_api(
    account_to_fund=account.addr,
    dispenser_client=dispenser_client,
    min_spending_balance=AlgoAmount.from_algo(1),
)

if result:
    print(f"Funded {result.amount_funded.algo} ALGO via tx {result.transaction_id}")
```

**What just happened:** You used the TestNet Dispenser API (authenticated via the `ALGOKIT_DISPENSER_ACCESS_TOKEN` environment variable) to fund an account on TestNet. Like the other `ensureFunded` variants, it only sends funds if the account's spendable balance is below the requested minimum.
