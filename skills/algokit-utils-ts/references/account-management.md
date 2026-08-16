## Account management

> All snippets in this section assume an `AlgorandClient` instance named
> `algorand` — see [Client initialization](#client-initialization) for setup.

### Create a random account

Generate a fresh, random Algorand account ready to sign transactions.

```typescript
const account = algorand.account.random();
console.log(account.addr.toString()); // e.g. "XBYLS2E6YI6XXL5BWC..."
```

**What just happened:** You created a new Algorand keypair in memory and registered
it with the `AccountManager`. The returned object contains the address (`addr`) and
a `signer` that can authorise transactions from that address. The private key never
leaves the process.

### Create an account from a mnemonic

Restore an existing account from its 25-word mnemonic phrase.

```typescript
const account = algorand.account.fromMnemonic(
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest",
);
```

**What just happened:** The mnemonic was converted to a seed, then to an Ed25519
keypair. The account is now tracked by the `AccountManager` and its signer is
available for any transaction sent from that address. Never hard-code mnemonics in
source — load them from environment variables or a secrets manager.

### Create an account from a mnemonic with a rekeyed sender

Use one account's private key to sign on behalf of a different (rekeyed) address.

```typescript
const rekeyedAccount = algorand.account.fromMnemonic(
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest",
  "SENDERADDRESS...",
);
```

**What just happened:** The keypair was derived from the mnemonic, but transactions
will be sent from the provided sender address instead of the mnemonic's native
address. This is how you interact with a rekeyed account — the mnemonic belongs to
the _authorising_ key, while the sender is the _rekeyed_ account.

### Create a multisig account

Set up a multisig account that requires M-of-N signatures.

```typescript
const account1 = algorand.account.random();
const account2 = algorand.account.random();
const account3 = algorand.account.random();

const multisig = algorand.account.multisig(
  {
    version: 1,
    threshold: 2,
    addrs: [account1.addr, account2.addr, account3.addr],
  },
  [account1, account2],
);

console.log(multisig.addr.toString()); // The multisig address
```

**What just happened:** You defined a 2-of-3 multisig account. The `addrs` array
lists all three participants, while the second argument provides the signers that
are currently available to sign. Transactions from this address will automatically
collect signatures from account1 and account2 — meeting the threshold of 2.

### Create a logic signature account

Wrap compiled TEAL bytecode into a logic signature that can authorise transactions.

```typescript
const program = new Uint8Array([
  /* compiled TEAL bytecode */
]);
const lsig = algorand.account.logicsig(program);

console.log(lsig.addr.toString()); // The logic sig address
```

**What just happened:** You created a `LogicSigAccount` from compiled TEAL program
bytes and registered it with the `AccountManager`. Transactions sent from this
address will be authorised by evaluating the TEAL program instead of checking a
cryptographic signature.

### Set a default signer

Configure a fallback signer that is used whenever no address-specific signer is found.

```typescript
const defaultAccount = algorand.account.random();
algorand.account.setDefaultSigner(defaultAccount);
```

**What just happened:** Any transaction whose sender doesn't have a registered signer
will now be signed by `defaultAccount`. This is handy during development when a
single account funds and signs everything.

### Register a signer for a specific address

Map an external `TransactionSigner` to a particular sender address.

```typescript
const myExternalSigner: TransactionSigner = async (txns, indexes) => {
  // Custom signing logic (e.g. hardware wallet, custodial API)
  return indexes.map(() => new Uint8Array());
};

algorand.account.setSigner("SENDERADDRESS...", myExternalSigner);
```

**What just happened:** You told the `AccountManager` to use your custom signer
whenever a transaction needs to be signed for `SENDERADDRESS...`. This lets you
integrate hardware wallets, KMS services, or any other external signing mechanism.

### Get account information

Retrieve an account's on-chain balance, minimum balance, assets, and more.

```typescript
const account = algorand.account.random();
const info = await algorand.account.getInformation(account.addr);

console.log(`Balance: ${info.balance.algo} ALGO`);
console.log(`Min balance: ${info.minBalance.algo} ALGO`);
console.log(
  `Spendable: ${info.balance.microAlgo - info.minBalance.microAlgo} µALGO`,
);
console.log(`Assets opted in: ${info.totalAssetsOptedIn}`);
```

**What just happened:** You queried the algod node for the account's current on-chain
state. The returned `AccountInformation` object wraps balances in `AlgoAmount`
objects so you can access both `.algo` and `.microAlgo` representations. The
`minBalance` reflects the minimum balance requirement based on the account's opted-in
assets and apps.

### Ensure an account is funded

Top up an account so it has at least a given amount of spendable Algo, skipping the
transfer if it already does.

```typescript
const account = algorand.account.random();
const dispenser = await algorand.account.localNetDispenser();

const result = await algorand.account.ensureFunded(
  account,
  dispenser,
  AlgoAmount.Algo(1),
);

if (result) {
  console.log(
    `Funded ${result.amountFunded.algo} ALGO via tx ${result.transactionId}`,
  );
} else {
  console.log("Account already has enough ALGO");
}
```

**What just happened:** The `AccountManager` checked the account's current spendable
balance (total balance minus minimum balance requirement). If it was below 1 ALGO,
a payment transaction was sent from the dispenser to make up the difference. If the
account already had enough, no transaction was sent and `undefined` was returned.

### Fund from the LocalNet dispenser

Use the default LocalNet dispenser account to send Algo directly.

```typescript
const account = algorand.account.random();

await algorand.account.ensureFundedFromEnvironment(
  account,
  AlgoAmount.Algo(10),
);
```

**What just happened:** The `AccountManager` loaded the dispenser account from either
the `DISPENSER_MNEMONIC` environment variable or the default LocalNet KMD wallet.
It then checked whether the target account needed funds and, if so, sent a payment
to bring its spendable balance up to 10 ALGO.

### Fund from the TestNet dispenser

Use the TestNet Dispenser API to fund an account on TestNet.

```typescript
const algorand = AlgorandClient.testNet();
const account = algorand.account.random();

const dispenserClient = algorand.client.getTestNetDispenserFromEnvironment();

const result = await algorand.account.ensureFundedFromTestNetDispenserApi(
  account,
  dispenserClient,
  AlgoAmount.Algo(1),
);

if (result) {
  console.log(
    `Funded ${result.amountFunded.algo} ALGO via tx ${result.transactionId}`,
  );
}
```

**What just happened:** You used the TestNet Dispenser API (authenticated via the
`ALGOKIT_DISPENSER_ACCESS_TOKEN` environment variable) to fund an account on TestNet.
Like the other `ensureFunded` variants, it only sends funds if the account's
spendable balance is below the requested minimum.
