## Error handling

### Try/catch around transaction sending

Wrap any `send` call in a try/catch to inspect the error, including the underlying cause and the transactions that were sent.

```typescript
import { AlgorandClient } from "@algorandfoundation/algokit-utils";

const algorand = AlgorandClient.defaultLocalNet();

try {
  await algorand.send.payment({
    sender: "SENDERADDRESS",
    receiver: "RECEIVERADDRESS",
    amount: (1).algo(),
  });
} catch (error) {
  if (error instanceof Error) {
    console.error("Transaction failed:", error.message);
    // Access the original error from the Algorand node
    console.error("Cause:", error.cause);
  }
}
```

**What just happened:** You caught a failed transaction and inspected both the high-level error message and the underlying cause. The `cause` property holds the original error from the Algorand node before any error transformers were applied.

### Register a custom error transformer

Register an error transformer on `AlgorandClient` to intercept and rewrite errors thrown by any transaction group created via `newGroup()` or the `send` namespace.

```typescript
import {
  AlgorandClient,
  ErrorTransformer,
} from "@algorandfoundation/algokit-utils";

const algorand = AlgorandClient.defaultLocalNet();

const insufficientFundsTransformer: ErrorTransformer = async (error) => {
  if (error.message.includes("overspend")) {
    return new Error(`Insufficient funds: ${error.message}`);
  }
  // Return the original error unchanged if this transformer doesn't apply
  return error;
};

algorand.registerErrorTransformer(insufficientFundsTransformer);
```

**What just happened:** You registered a global error transformer that intercepts any error containing "overspend" and wraps it with a friendlier message. Transformers are called in order and each receives the output of the previous one. If a transformer doesn't apply, it must return the original error unchanged.

### Unregister an error transformer

Remove a previously registered error transformer when it's no longer needed.

```typescript
import {
  AlgorandClient,
  ErrorTransformer,
} from "@algorandfoundation/algokit-utils";

const algorand = AlgorandClient.defaultLocalNet();

const myTransformer: ErrorTransformer = async (error) => {
  if (error.message.includes("overspend")) {
    return new Error(`Insufficient funds: ${error.message}`);
  }
  return error;
};

algorand.registerErrorTransformer(myTransformer);

// Later, when you no longer need the transformer
algorand.unregisterErrorTransformer(myTransformer);
```

**What just happened:** You removed a specific error transformer by passing the same function reference to `unregisterErrorTransformer`. The transformer will no longer be applied to errors from future transaction groups.

### Handle insufficient funds errors

Catch and identify insufficient-balance errors when sending payments or asset transfers.

```typescript
import { AlgorandClient } from "@algorandfoundation/algokit-utils";

const algorand = AlgorandClient.defaultLocalNet();

try {
  await algorand.send.payment({
    sender: "SENDERADDRESS",
    receiver: "RECEIVERADDRESS",
    amount: (999_999_999).algo(),
  });
} catch (error) {
  if (error instanceof Error && error.message.includes("overspend")) {
    console.error("The sender does not have enough ALGO for this transaction");
  }
}
```

**What just happened:** You caught an overspend error from the Algorand node. When an account tries to send more than its available balance (minus the minimum balance requirement), the node returns an error containing "overspend" in the message.

### Handle app call rejection errors

Catch errors from smart contract calls and inspect the failure details, including the program counter and TEAL source context when using an `AppClient`.

```typescript
import { AlgorandClient } from "@algorandfoundation/algokit-utils";

const algorand = AlgorandClient.defaultLocalNet();

const appClient = algorand.client.getAppClientById({
  appId: 12345n,
  appSpec: "{ ... }", // Your ARC-56 or ARC-32 app spec JSON
});

try {
  await appClient.send.call({ method: "risky_method", args: [] });
} catch (error) {
  if (error instanceof Error) {
    console.error("App call failed:", error.message);
    // AppClient automatically parses logic errors and includes the
    // app name, app ID, transaction ID, and mapped TEAL source location
    // in the error message when source maps are available
    if (error.cause instanceof Error) {
      console.error("Underlying error:", error.cause.message);
    }
  }
}
```

**What just happened:** You caught a smart contract execution failure. `AppClient` automatically registers an error transformer that parses logic eval errors, maps them back to TEAL source lines using source maps, and wraps them with context including the app name, app ID, and transaction ID. The original parsed error is available on the `cause` property.
