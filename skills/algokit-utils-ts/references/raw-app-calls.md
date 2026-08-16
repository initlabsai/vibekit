## Raw app calls

### Send a raw app call

Call an existing application without an ABI method (a "bare" no-op call).

```typescript
import { AlgorandClient } from "@algorandfoundation/algokit-utils";

const algorand = AlgorandClient.defaultLocalNet();

const sender = algorand.account.random();
await algorand.account.ensureFunded(
  sender,
  algorand.account.localNetDispenser(),
  (10).algo(),
);

const appId = 123n; // ID of an already-deployed application

const result = await algorand.send.appCall({
  sender: sender.addr,
  appId,
});

console.log(`App call TX: ${result.txIds[0]}`);
```

**What just happened?** `algorand.send.appCall()` built, signed, and submitted a
bare application call transaction with an `OnComplete` of `NoOp` (the default).
No ABI method selector is involved — the raw `args` array is empty. Use this when
you know the app ID but do not have (or need) an app spec.

### Create an app from compiled TEAL

Deploy a new application by supplying approval and clear-state programs directly.

```typescript
const approvalTeal = `#pragma version 10
int 1`;
const clearTeal = `#pragma version 10
int 1`;

const createResult = await algorand.send.appCreate({
  sender: sender.addr,
  approvalProgram: approvalTeal,
  clearStateProgram: clearTeal,
  schema: {
    globalInts: 1,
    globalByteSlices: 1,
    localInts: 0,
    localByteSlices: 0,
  },
});

console.log(`Created app ${createResult.appId} at ${createResult.appAddress}`);
```

**What just happened?** `algorand.send.appCreate()` compiled the TEAL source
strings on the node, built an application-create transaction with the specified
state schema, signed it, and submitted it. The returned `appId` is the
on-chain ID of the new application and `appAddress` is its Algorand address.

### Update an app

Replace the approval and clear-state programs of an existing application.

```typescript
const newApprovalTeal = `#pragma version 10
int 1`;
const newClearTeal = `#pragma version 10
int 1`;

const updateResult = await algorand.send.appUpdate({
  sender: sender.addr,
  appId: createResult.appId,
  approvalProgram: newApprovalTeal,
  clearStateProgram: newClearTeal,
});

console.log(`Updated app in TX: ${updateResult.txIds[0]}`);
```

**What just happened?** `algorand.send.appUpdate()` submitted an
`OnComplete.UpdateApplication` transaction that swaps the on-chain programs.
The `appId` must reference an application the sender is authorized to update.

### Delete an app

Remove an application from the ledger.

```typescript
const deleteResult = await algorand.send.appDelete({
  sender: sender.addr,
  appId: createResult.appId,
});

console.log(`Deleted app in TX: ${deleteResult.txIds[0]}`);
```

**What just happened?** `algorand.send.appDelete()` submitted an
`OnComplete.DeleteApplication` transaction. After confirmation the application's
programs and state are removed from the ledger. The sender must be the app
creator (or the address the app's approval program authorises for deletion).

### Call an ABI method

Invoke a specific ABI method on an existing application without using an AppClient.

```typescript
import { ABIMethod } from "@algorandfoundation/algokit-utils/abi";

const method = new ABIMethod({
  name: "hello",
  args: [{ name: "name", type: "string" }],
  returns: { type: "string" },
});

const methodResult = await algorand.send.appCallMethodCall({
  sender: sender.addr,
  appId: 456n,
  method,
  args: ["world"],
});

console.log(`ABI return: ${methodResult.return?.returnValue}`);
```

**What just happened?** `algorand.send.appCallMethodCall()` encoded the ABI
method selector and arguments, built a no-op application call, signed it, and
submitted it. The `return` field on the result contains the ABI-decoded return
value. You construct the `ABIMethod` manually — no app spec file is needed.

### Create an app via ABI method

Deploy a new application whose creation triggers an ABI method (an ARC-4 `create` method).

```typescript
const createMethod = new ABIMethod({
  name: "createApplication",
  args: [{ name: "greeting", type: "string" }],
  returns: { type: "void" },
});

const abiCreateResult = await algorand.send.appCreateMethodCall({
  sender: sender.addr,
  method: createMethod,
  args: ["hello"],
  approvalProgram: approvalTeal,
  clearStateProgram: clearTeal,
  schema: {
    globalInts: 1,
    globalByteSlices: 1,
    localInts: 0,
    localByteSlices: 0,
  },
});

console.log(`Created app ${abiCreateResult.appId} via ABI method`);
console.log(`ABI return: ${abiCreateResult.return?.value}`);
```

**What just happened?** `algorand.send.appCreateMethodCall()` combined an
application-create transaction with ABI method encoding. The method selector and
arguments are packed into the transaction's `args` array while the approval and
clear-state programs are deployed on-chain. The result includes both `appId`
(the new application ID) and `return` (the ABI-decoded return value).
