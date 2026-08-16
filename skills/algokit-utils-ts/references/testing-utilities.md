## Testing utilities

### Set up AlgorandFixture in a test suite

Create a test fixture that provides a pre-configured `AlgorandClient`, funded test account, and helper utilities against LocalNet (or environment-configured network).

```typescript
import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";

describe("My contract tests", () => {
  const fixture = algorandFixture();

  beforeEach(fixture.newScope);

  test("can send a payment", async () => {
    const { algorand, testAccount } = fixture.context;

    const result = await algorand.send.payment({
      sender: testAccount,
      receiver: testAccount,
      amount: (1).algo(),
    });

    expect(result.confirmation.confirmedRound).toBeGreaterThan(0n);
  });
});
```

**What just happened:** `algorandFixture()` wired up algod, indexer, and kmd clients (defaulting to LocalNet). Calling `fixture.newScope` before each test creates a fresh `AlgorandClient`, a new funded test account (10 ALGO by default), and a clean `TransactionLogger`. Destructuring `fixture.context` gives you everything you need inside the test.

### Use newScope() for isolated test contexts

Control when a new scope is created — use `beforeEach` for per-test isolation or `beforeAll` for shared state across a suite.

```typescript
import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";

describe("Shared context across tests", () => {
  const fixture = algorandFixture({ testAccountFunding: (20).algo() });

  // One scope for the entire suite — all tests share the same testAccount
  beforeAll(fixture.newScope);

  test("first test", async () => {
    const { algorand, testAccount } = fixture.context;
    // testAccount has ~20 ALGO
    await algorand.send.payment({
      sender: testAccount,
      receiver: testAccount,
      amount: (1).algo(),
    });
  });

  test("second test uses same context", async () => {
    const { testAccount } = fixture.context;
    // Same testAccount as the first test — balance reflects previous sends
    const info = await fixture.algorand.account.getInformation(testAccount);
    expect(info.balance.microAlgo).toBeLessThan(20_000_000n);
  });
});
```

**What just happened:** By passing `fixture.newScope` to `beforeAll` instead of `beforeEach`, all tests in the suite share the same `AlgorandClient` and test account. The `testAccountFunding` option overrides the default 10 ALGO initial balance.

### Generate funded test accounts

Create additional ephemeral accounts on the fly, each automatically funded and registered as a signer on the `AlgorandClient`.

```typescript
import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";

describe("Multi-account tests", () => {
  const fixture = algorandFixture();

  beforeEach(fixture.newScope);

  test("transfer between two test accounts", async () => {
    const { algorand, testAccount, generateAccount } = fixture.context;

    const receiver = await generateAccount({ initialFunds: (5).algo() });

    await algorand.send.payment({
      sender: testAccount,
      receiver: receiver,
      amount: (1).algo(),
    });

    const info = await algorand.account.getInformation(receiver);
    expect(info.balance.microAlgo).toBeGreaterThan(5_000_000n);
  });
});
```

**What just happened:** `generateAccount` creates a brand-new random account, funds it from the LocalNet dispenser with the specified amount, and registers its signer on `fixture.algorand`. You can call it as many times as you need — each account is independent.

### Use transactionLogger to track transactions in tests

The fixture's `transactionLogger` automatically records every transaction ID sent through the proxied algod client.

```typescript
import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";

describe("Transaction tracking", () => {
  const fixture = algorandFixture();

  beforeEach(fixture.newScope);

  test("logs all sent transaction IDs", async () => {
    const { algorand, testAccount, transactionLogger } = fixture.context;

    await algorand.send.payment({
      sender: testAccount,
      receiver: testAccount,
      amount: (1).algo(),
    });

    await algorand.send.payment({
      sender: testAccount,
      receiver: testAccount,
      amount: (2).algo(),
    });

    // transactionLogger captured both transaction IDs
    expect(transactionLogger.sentTransactionIds).toHaveLength(2);
  });
});
```

**What just happened:** Every `newScope` call creates a fresh `TransactionLogger` that wraps the algod client via a proxy. All transactions sent through `algorand.send.*` are intercepted and their IDs stored in `transactionLogger.sentTransactionIds`. The logger is cleared on each new scope.

### Capture and assert logs with AlgoKitLogCaptureFixture

Intercept AlgoKit's internal logger to capture and assert log output during tests.

```typescript
import {
  algoKitLogCaptureFixture,
  algorandFixture,
} from "@algorandfoundation/algokit-utils/testing";

describe("Log capture", () => {
  const fixture = algorandFixture();
  const logs = algoKitLogCaptureFixture();

  beforeEach(async () => {
    logs.beforeEach();
    await fixture.newScope();
  });
  afterEach(logs.afterEach);

  test("captures AlgoKit log messages", async () => {
    const { algorand, testAccount } = fixture.context;

    await algorand.send.payment({
      sender: testAccount,
      receiver: testAccount,
      amount: (1).algo(),
    });

    // Assert that at least one log was captured
    expect(logs.testLogger.capturedLogs.length).toBeGreaterThan(0);

    // Use getLogSnapshot for deterministic snapshot testing
    const snapshot = logs.testLogger.getLogSnapshot({
      accounts: [testAccount],
    });
    // Account addresses are replaced with ACCOUNT_1, ACCOUNT_2, etc.
    expect(snapshot).not.toContain(testAccount.addr.toString());
  });
});
```

**What just happened:** `algoKitLogCaptureFixture()` swaps AlgoKit's global logger with a `TestLogger` that records every log line while still forwarding to the original logger. `capturedLogs` gives you the raw array; `getLogSnapshot()` substitutes dynamic values (addresses, transaction IDs, app IDs) with deterministic placeholders for snapshot testing. `afterEach` restores the original logger.

### Wait for indexer to catch up in tests

When your test needs to query the indexer after sending transactions, wait for it to index the latest data.

```typescript
import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";

describe("Indexer queries", () => {
  const fixture = algorandFixture();

  beforeEach(fixture.newScope);

  test("query indexer after sending", async () => {
    const { algorand, testAccount, waitForIndexer, waitForIndexerTransaction } =
      fixture.context;

    const result = await algorand.send.payment({
      sender: testAccount,
      receiver: testAccount,
      amount: (1).algo(),
    });

    // Wait for ALL logged transactions to be indexed
    await waitForIndexer();

    // Or wait for a specific transaction by ID
    const txn = await waitForIndexerTransaction(result.txIds[0]);
    expect(txn.transaction.sender).toBe(testAccount.addr.toString());
  });
});
```

**What just happened:** `waitForIndexer()` polls the indexer every 200 ms (up to 100 retries) until all transactions recorded by the `transactionLogger` are indexed. `waitForIndexerTransaction(txId)` does the same for a single transaction ID and returns the full indexer transaction response. Both are essential when testing indexer-dependent logic against LocalNet.
