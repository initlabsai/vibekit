# Deploying and Calling Contracts (Python)

## Contents

- [CLI Commands](#cli-commands)
- [AlgorandClient API](#algorandclient-api)
- [Account Management](#account-management)
- [Deploy Using Typed Client Factory](#deploy-using-typed-client-factory)
- [Call Methods](#call-methods)
- [Read State](#read-state)
- [Opt-In / Close-Out](#opt-in--close-out)
- [Environment Setup](#environment-setup)
- [Sending Transactions](#sending-transactions)
- [Common Transaction Parameters](#common-transaction-parameters)
- [Send Parameters](#send-parameters)
- [App Calls](#app-calls)
- [Amount Helpers](#amount-helpers)
- [Auto-Populating App Call Resources](#auto-populating-app-call-resources)
- [Auto-Covering Inner Transaction Fees](#auto-covering-inner-transaction-fees)
- [deploy_config.py Pattern](#deploy_configpy-pattern)
- [Important Rules](#important-rules)
- [References](#references)

Deploy and interact with Algorand smart contracts using AlgoKit Utils Python and generated typed clients.

## CLI Commands

### Build Contract

```bash
algokit project run build
```

Compiles contracts and generates:
- ARC-56 app spec (`*.arc56.json`)
- Python typed client

### Deploy Contract

```bash
# To localnet
algokit project deploy localnet

# To testnet (requires funded account)
algokit project deploy testnet

# To mainnet
algokit project deploy mainnet
```

### Localnet Management

```bash
algokit localnet start    # Start localnet
algokit localnet status   # Check status
algokit localnet reset    # Reset (clears all data)
algokit localnet stop     # Stop
```

## AlgorandClient API

### Creating an AlgorandClient

```python
from algokit_utils import AlgorandClient

# From environment variables (recommended for production)
algorand = AlgorandClient.from_environment()

# Default LocalNet configuration
algorand = AlgorandClient.default_localnet()

# TestNet using AlgoNode free tier
algorand = AlgorandClient.testnet()

# MainNet using AlgoNode free tier
algorand = AlgorandClient.mainnet()

# From existing clients
algorand = AlgorandClient.from_clients(algod=algod, indexer=indexer, kmd=kmd)

# From custom configuration
from algokit_utils import AlgoClientNetworkConfig

algorand = AlgorandClient.from_config(
    algod_config=AlgoClientNetworkConfig(
        server="http://localhost",
        port="4001",
        token="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
)
```

### Accessing SDK Clients

```python
algod_client = algorand.client.algod
indexer_client = algorand.client.indexer
kmd_client = algorand.client.kmd
```

## Account Management

### Getting Accounts

```python
# From environment variable (DEPLOYER_MNEMONIC)
deployer = algorand.account.from_environment("DEPLOYER")

# Random account (for testing)
random_account = algorand.account.random()

# From mnemonic
account = algorand.account.from_mnemonic("abandon abandon...")

# From KMD (LocalNet)
kmd_account = algorand.account.from_kmd("wallet-name", "password")
```

### Registering Signers

```python
# Register a signer for automatic signing
algorand.set_signer_from_account(account)

# Set default signer for all transactions
algorand.set_default_signer(account.signer)
```

## Deploy Using Typed Client Factory

```python
from artifacts.my_contract_client import MyContractFactory

factory = algorand.client.get_typed_app_factory(
    MyContractFactory,
    default_sender=deployer.address,
)

result = factory.deploy(
    on_update="append",
    on_schema_break="append",
)
app_client = result.app_client
print(f"App ID: {app_client.app_id}")
```

## Call Methods

```python
# No arguments
result = app_client.send.increment()

# With arguments
result = app_client.send.set_value(value=42)

# Access return value
print(f"Return: {result.abi_return}")
```

## Read State

```python
# Global state
state = app_client.state.global_state.get_all()

# Local state
local = app_client.state.local_state(address).get_all()
```

## Opt-In / Close-Out

```python
# ABI opt-in
app_client.send.opt_in.opt_in()

# Bare opt-in
app_client.send.opt_in.bare()

# ABI close-out
app_client.send.close_out.close_out()

# Bare close-out
app_client.send.close_out.bare()
```

## Environment Setup

For non-localnet deployments:

```bash
# .env file
ALGORAND_NETWORK=testnet
DEPLOYER_MNEMONIC="your twenty four word mnemonic phrase here"
```

## Sending Transactions

### Single Transactions

```python
from algokit_utils import AlgoAmount, PaymentParams, AssetTransferParams
from algokit_utils import AssetOptInParams, AssetCreateParams

# Payment
result = algorand.send.payment(
    PaymentParams(
        sender="SENDERADDRESS",
        receiver="RECEIVERADDRESS",
        amount=AlgoAmount(algo=1),
    )
)

# Asset transfer
algorand.send.asset_transfer(
    AssetTransferParams(
        sender="SENDERADDRESS",
        receiver="RECEIVERADDRESS",
        asset_id=12345,
        amount=100,
    )
)

# Asset opt-in
algorand.send.asset_opt_in(
    AssetOptInParams(
        sender="SENDERADDRESS",
        asset_id=12345,
    )
)

# Asset create
create_result = algorand.send.asset_create(
    AssetCreateParams(
        sender="SENDERADDRESS",
        total=1_000_000,
        decimals=6,
        asset_name="My Token",
        unit_name="MTK",
    )
)
asset_id = create_result.asset_id
```

### Transaction Groups

```python
result = (
    algorand
    .new_group()
    .add_payment(
        PaymentParams(
            sender="SENDERADDRESS",
            receiver="RECEIVERADDRESS",
            amount=AlgoAmount(algo=1),
        )
    )
    .add_asset_opt_in(
        AssetOptInParams(
            sender="SENDERADDRESS",
            asset_id=12345,
        )
    )
    .send()
)
```

### Creating Transactions (Without Sending)

```python
payment = algorand.create_transaction.payment(
    PaymentParams(
        sender="SENDERADDRESS",
        receiver="RECEIVERADDRESS",
        amount=AlgoAmount(algo=1),
    )
)
# payment is an unsigned algosdk.Transaction
```

## Common Transaction Parameters

All transactions support these common parameters:

```python
algorand.send.payment(
    PaymentParams(
        sender="SENDERADDRESS",
        receiver="RECEIVERADDRESS",
        amount=AlgoAmount(algo=1),

        # Optional parameters
        note=b"My note",
        lease="unique-lease-id",
        rekey_to="NEWADDRESS",

        # Fee management
        static_fee=AlgoAmount(micro_algo=1000),
        extra_fee=AlgoAmount(micro_algo=1000),  # For covering inner txn fees
        max_fee=AlgoAmount(micro_algo=10000),

        # Validity
        validity_window=1000,
        first_valid_round=12345,
    )
)
```

## Send Parameters

Control execution behavior when sending:

```python
from algokit_utils import SendParams

algorand.send.payment(
    PaymentParams(
        sender="SENDERADDRESS",
        receiver="RECEIVERADDRESS",
        amount=AlgoAmount(algo=1),
    ),
    send_params=SendParams(
        max_rounds_to_wait_for_confirmation=5,
        suppress_log=True,
        populate_app_call_resources=True,
        cover_app_call_inner_transaction_fees=True,
    )
)
```

## App Calls

### Using Typed App Clients (Recommended)

```python
# Get typed factory from generated client
factory = algorand.client.get_typed_app_factory(MyContractFactory)

# Deploy
result = factory.deploy(sender=deployer.address)
app_client = result.app_client

# Call methods
response = app_client.send.my_method(
    sender=deployer.address,
    args={"param1": "value"},
)
```

### Generic App Calls

```python
from algokit_utils import AppCallMethodCallParams
from algosdk.abi import Method

algorand.send.app_call_method_call(
    AppCallMethodCallParams(
        sender="SENDERADDRESS",
        app_id=12345,
        method=Method.from_signature("hello(string)string"),
        args=["World"],
    )
)
```

## Amount Helpers

```python
from algokit_utils import AlgoAmount

AlgoAmount(algo=1)           # 1 Algo = 1,000,000 microAlgo
AlgoAmount(algo=0.5)         # 0.5 Algo = 500,000 microAlgo
AlgoAmount(micro_algo=1000)  # 1000 microAlgo

# Access values
amount = AlgoAmount(algo=1)
amount.algo        # 1.0
amount.micro_algo  # 1000000
```

---

## Auto-Populating App Call Resources (`populate_app_call_resources`)

Automatically discovers and populates account, asset, app, and box references via simulate. Eliminates manual reference management in most cases.

### Per-Call

```python
app_client.send.my_method(
    key=1,
    populate_app_call_resources=True,
)
```

### Global Configuration

```python
algorand = AlgorandClient.default_localnet()
algorand.set_default_send_params(
    populate_app_call_resources=True,
)

# Now all calls auto-populate resources
app_client.send.my_method(key=1)
```

**Note:** This uses simulate under the hood to discover required references. For performance-critical paths or when you know the exact references, pass them explicitly.

---

## Auto-Covering Inner Transaction Fees (`cover_app_call_inner_transaction_fees`)

Automatically calculates the correct fee to cover inner transactions via simulate. Replaces manual `extra_fee` calculations.

### Per-Call

```python
app_client.send.transfer_with_inner_txn(
    receiver=bob_address,
    amount=1000,
    cover_app_call_inner_transaction_fees=True,
    max_fee=AlgoAmount(micro_algo=10_000),  # Safety cap
)
```

### Manual Alternative (`extra_fee`)

If you know the exact number of inner transactions:

```python
app_client.send.transfer_with_inner_txn(
    receiver=bob_address,
    amount=1000,
    extra_fee=AlgoAmount(micro_algo=1000),  # Cover 1 inner txn
)
```

---

## deploy_config.py Pattern

The standard deployment configuration file for Python projects:

```python
# smart_contracts/deploy_config.py
from algokit_utils import AlgorandClient, AlgoAmount
from artifacts.my_contract_client import MyContractFactory


def deploy() -> None:
    algorand = AlgorandClient.from_environment()
    deployer = algorand.account.from_environment("DEPLOYER")

    factory = algorand.client.get_typed_app_factory(
        MyContractFactory,
        default_sender=deployer.address,
    )

    result = factory.deploy(
        on_update="append",
        on_schema_break="append",
    )
    app_client = result.app_client

    # Fund app account if newly created (e.g., for box storage)
    if result.operation_performed in ("create", "replace"):
        algorand.send.payment(
            sender=deployer.address,
            receiver=app_client.app_address,
            amount=AlgoAmount(algo=1),
        )

    print(f"App ID: {app_client.app_id}")
```

---

## Important Rules

- **Always build before deploying**: Run `algokit project run build` to generate fresh artifacts
- **Use generated typed clients**: They provide type safety and handle ABI encoding
- **Check App ID**: Get from deployment output, don't hardcode across environments
- **Use environment variables**: Store sensitive data like mnemonics in `.env`

## References

- [AlgoKit Utils Python Overview](https://dev.algorand.co/algokit/utils/python/overview/)
- [AlgorandClient API](https://dev.algorand.co/reference/algokit-utils-py/api/algorand/)
- [Transaction Composer](https://dev.algorand.co/algokit/utils/python/transaction-composer/)
- [Account Management](https://dev.algorand.co/algokit/utils/python/account/)
