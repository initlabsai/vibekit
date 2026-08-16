## Smart contract deployment

> All snippets in this section assume an `AlgorandClient` named `algorand` and
> an account named `deployer` — see [Client initialization](#client-initialization)
> and [Account management](#account-management) for setup.

### Create an AppFactory from an app spec

Point an `AppFactory` at an ARC-56 (or ARC-32) app spec so it knows your
contract's interface.

```typescript
import { AppFactory } from "@algorandfoundation/algokit-utils";
import appSpec from "./artifacts/MyContract.arc56.json";

const factory = algorand.client.getAppFactory({
  appSpec,
  defaultSender: deployer.addr,
});
```

**What just happened:** You created an `AppFactory` bound to the parsed app spec
and a default sender. The factory can now compile, create, and deploy instances
of this contract. It accepts ARC-56 `Contract` objects, ARC-32 `AppSpec`
objects, or raw JSON strings in either format — the library normalises
internally. ARC-56 specs include richer metadata (template variables, source
info, struct definitions) while ARC-32 specs are automatically converted to
ARC-56 under the hood.

### Create a new app instance via AppFactory

Deploy a fresh app instance using a bare create call (no ABI method).

```typescript
const { appClient, result } = await factory.send.bare.create();

console.log(`App ID: ${result.appId}`);
console.log(`App address: ${result.appAddress}`);
```

**What just happened:** The factory compiled the TEAL programs from the app spec,
sent a bare application create transaction, and returned both an `AppClient`
(for subsequent interaction) and the creation result containing the new `appId`
and `appAddress`. The schema is derived automatically from the app spec.

### Create a new app instance with an ABI method

Call a specific ABI method as the create transaction.

```typescript
const { appClient, result } = await factory.send.create({
  method: "createApplication",
  args: ["Hello, World!"],
});

console.log(`Returned: ${result.return}`);
```

**What just happened:** Instead of a bare call, the factory invoked the
`createApplication` ABI method during app creation. The `result.return`
field contains the decoded ABI return value from the method. You get back
the same `appClient` + result structure as a bare create.

### Idempotent deploy via AppFactory

Deploy once, then no-op on subsequent calls if the contract hasn't changed.

```typescript
const { appClient, result } = await factory.deploy({
  onUpdate: "update",
  onSchemaBreak: "replace",
});

console.log(`Operation: ${result.operationPerformed}`); // 'create', 'update', 'replace', or 'nothing'
```

**What just happened:** `factory.deploy()` checked whether an app with this name
already exists for the sender. If not, it creates one. If the TEAL code changed,
it applies the `onUpdate` strategy (here: update in place). If the state schema
grew beyond the existing allocation, it applies the `onSchemaBreak` strategy
(here: delete and recreate). If nothing changed, `operationPerformed` is
`'nothing'` and no transaction is sent. This is the recommended pattern for
CI/CD pipelines and scripts that must be safely re-runnable.

### Deploy with onSchemaBreak and onUpdate strategies

Control what happens when the contract code or state schema changes between
deployments.

```typescript
const { appClient, result } = await factory.deploy({
  onUpdate: "replace",
  onSchemaBreak: "fail",
  createParams: {
    method: "createApplication",
    args: [],
  },
  updateParams: {
    method: "updateApplication",
    args: [],
  },
  deleteParams: {
    method: "deleteApplication",
    args: [],
  },
});
```

**What just happened:** You configured explicit strategies for handling changes.
`onUpdate: 'replace'` means if the TEAL code changes, the old app is deleted
and a new one is created (rather than updated in place). `onSchemaBreak: 'fail'`
means a breaking state schema change will throw an error instead of
automatically handling it. The available strategies are: `'fail'` (throw an
error), `'update'` (update the app in place — `onUpdate` only), `'replace'`
(delete and recreate), and `'append'` (create a new app, leave the old one).
The `createParams`, `updateParams`, and `deleteParams` let you specify ABI
methods to call for each operation.

### Deploy with template variable replacements

Substitute TEAL template placeholders at deploy time.

```typescript
const factory = algorand.client.getAppFactory({
  appSpec,
  defaultSender: deployer.addr,
  deployTimeParams: {
    VALUE: 42,
    NAME: "my-instance",
  },
});

const { appClient, result } = await factory.deploy({
  onUpdate: "update",
  onSchemaBreak: "replace",
  updatable: true,
  deletable: true,
});
```

**What just happened:** The factory replaced `TMPL_VALUE` and `TMPL_NAME` in the
TEAL approval and clear programs before compilation. Setting `updatable: true`
and `deletable: true` also injects `TMPL_UPDATABLE` and `TMPL_DELETABLE`
template values (if present in the TEAL). Template params can be set at the
factory level (as shown) or overridden per-call via `deployTimeParams` on the
deploy/create call itself. Values can be strings, numbers, bigints, or
`Uint8Array`.
