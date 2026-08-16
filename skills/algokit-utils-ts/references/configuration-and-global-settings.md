## Configuration and global settings

### Set populateAppCallResources globally

Enable automatic resource population for all application calls so you don't have to manually specify boxes, accounts, apps, and assets.

```typescript
import { Config } from "@algorandfoundation/algokit-utils";

Config.configure({ populateAppCallResources: true });
```

**What just happened:** You turned on automatic resource population library-wide. Every application call sent through `AlgorandClient` will now use simulation to discover and attach the required reference arrays before submitting.

### Set maxRoundsToWaitForConfirmation

Control how many rounds the library waits for a transaction to be confirmed before timing out.

```typescript
const result = await algorand.send.payment({
  sender: alice.addr,
  receiver: bob.addr,
  amount: (1).algo(),
  maxRoundsToWaitForConfirmation: 5,
});
```

**What just happened:** You sent a payment that will wait up to 5 rounds for confirmation. If the transaction is not confirmed within that window the call throws. This parameter can be added to any send call; set it to `0` to skip waiting entirely (fire-and-forget).

### Configure logging

Replace the default console logger with your own implementation to control how the library reports internal activity.

```typescript
import { Config } from "@algorandfoundation/algokit-utils";

// Silence all library output
Config.configure({
  logger: {
    error: () => {},
    warn: () => {},
    info: () => {},
    verbose: () => {},
    debug: () => {},
  },
});

// Or route logs through your application's logger
Config.configure({
  logger: {
    error: (msg, ...args) => myLogger.error(msg, ...args),
    warn: (msg, ...args) => myLogger.warn(msg, ...args),
    info: (msg, ...args) => myLogger.info(msg, ...args),
    verbose: (msg, ...args) => myLogger.trace(msg, ...args),
    debug: (msg, ...args) => myLogger.debug(msg, ...args),
  },
});
```

**What just happened:** You swapped out the library's default `console`-based logger. The first example silences all output; the second pipes everything through a custom `myLogger` instance. The `Logger` interface has five levels — `error`, `warn`, `info`, `verbose`, and `debug` — each accepting a message string and optional extra parameters.
