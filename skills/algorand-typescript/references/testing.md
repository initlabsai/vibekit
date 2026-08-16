# Canonical Test Examples

## Contents

- [Typed Client Import Paths (CRITICAL)](#typed-client-import-paths-critical)
- [HelloWorld - Basic Contract](#helloworld---basic-contract)
- [BoxStorage - Boxes and BoxMaps](#boxstorage---boxes-and-boxmaps)
- [LocalStorage - Opt-in and Local State](#localstorage---opt-in-and-local-state)
- [StructInBox - Struct Returns as Tuples](#structinbox---struct-returns-as-tuples)
- [Key Patterns Summary](#key-patterns-summary)
- [Unit Testing (only when explicitly requested)](#unit-testing-only-when-explicitly-requested)

Real-world examples from [algorandfoundation/devportal-code-examples](https://github.com/algorandfoundation/devportal-code-examples/tree/main/projects/typescript-examples/contracts).

## Typed Client Import Paths (CRITICAL)

The artifact directory name matches the **source directory name**, not the contract class name:

```
smart_contracts/
├── hello_world/              ← source directory name
│   └── contract.algo.ts      # Contains class AuctionHouse
├── artifacts/
│   └── hello_world/          ← matches source dir, NOT class name
│       ├── AuctionHouseClient.ts
│       └── AuctionHouse.arc56.json
```

```typescript
// CORRECT — use source directory name
import { AuctionHouseFactory } from '../artifacts/hello_world/AuctionHouseClient'

// INCORRECT — do NOT use contract class name as directory
import { AuctionHouseFactory } from '../artifacts/AuctionHouse/AuctionHouseClient'
import { AuctionHouseFactory } from '../artifacts/clients/AuctionHouse/AuctionHouseClient'
```

**Rule:** After `algokit project run build`, check `smart_contracts/artifacts/` to confirm
the actual directory name. For multi-contract projects, each source directory gets its own
artifact subdirectory.

**Note:** The canonical examples below use the `devportal-code-examples` project structure
(`artifacts/clients/ContractName/`), which differs from AlgoKit template projects. Adapt
import paths to match your project.

## HelloWorld - Basic Contract

**Source:** [HelloWorld/contract.algo.e2e.spec.ts](https://github.com/algorandfoundation/devportal-code-examples/blob/main/projects/typescript-examples/contracts/HelloWorld/contract.algo.e2e.spec.ts)

```typescript
import { Config } from '@algorandfoundation/algokit-utils'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import { Address } from 'algosdk'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { HelloWorldFactory } from '../artifacts/clients/HelloWorld/HelloWorldClient'

describe('HelloWorld contract', () => {
  const localnet = algorandFixture()

  beforeAll(() => {
    Config.configure({ debug: true })
  })
  beforeEach(localnet.newScope)

  const deploy = async (account: Address) => {
    const factory = localnet.algorand.client.getTypedAppFactory(HelloWorldFactory, {
      defaultSender: account,
    })
    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
      suppressLog: true,
    })
    return { client: appClient }
  }

  test('say hello', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    const result = await client
      .newGroup()
      .sayHello({ args: { firstName: 'Silvio', lastName: 'Micali' } })
      .simulate()

    expect(result.returns[0]).toBe('Hello Silvio Micali')
  })
})
```

## BoxStorage - Boxes and BoxMaps

**Source:** [BoxStorage/contract.algo.e2e.test.ts](https://github.com/algorandfoundation/devportal-code-examples/blob/main/projects/typescript-examples/contracts/BoxStorage/contract.algo.e2e.test.ts)

```typescript
import { Config } from '@algorandfoundation/algokit-utils'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import { Address, ABIUintType } from 'algosdk'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { BoxStorageFactory } from '../artifacts/clients/BoxStorage/BoxStorageClient'

describe('BoxStorage contract', () => {
  const localnet = algorandFixture()

  beforeAll(() => {
    Config.configure({ debug: true })
  })
  beforeEach(localnet.newScope)

  const deploy = async (account: Address) => {
    const factory = localnet.algorand.client.getTypedAppFactory(BoxStorageFactory, {
      defaultSender: account,
    })
    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
      suppressLog: true,
    })
    return { client: appClient }
  }

  // CRITICAL: Fund app account before any box operations
  const fundContract = async (sender: Address, receiver: Address) => {
    await localnet.algorand.send.payment({
      amount: (1).algo(),
      sender,
      receiver,
    })
  }

  // Helper for BoxMap references with uint64 keys
  function createBoxReference(appId: bigint, prefix: string, key: bigint) {
    const uint64Type = new ABIUintType(64)
    const encodedKey = uint64Type.encode(key)
    const boxName = new Uint8Array([...new TextEncoder().encode(prefix), ...encodedKey])
    return { appId, name: boxName }
  }

  test('set and read box value', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // Fund BEFORE box operations
    await fundContract(testAccount, client.appAddress)

    await client
      .newGroup()
      .setBox({ args: { valueInt: 42n }, boxReferences: ['boxInt'] })
      .send()

    const boxValue = await client.state.box.boxInt()
    expect(boxValue).toBe(42n)
  })

  test('set and read BoxMap', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    await fundContract(testAccount, client.appAddress)

    await client
      .newGroup()
      .setBoxMap({
        args: { key: 1n, value: 'Hello' },
        boxReferences: [createBoxReference(client.appId, 'boxMap', 1n)],
      })
      .send()

    const value = await client.getBoxMap({ args: { key: 1n } })
    expect(value).toBe('Hello')
  })
})
```

## LocalStorage - Opt-in and Local State

**Source:** [LocalStorage/contract.algo.e2e.spec.ts](https://github.com/algorandfoundation/devportal-code-examples/blob/main/projects/typescript-examples/contracts/LocalStorage/contract.algo.e2e.spec.ts)

```typescript
import { Config } from '@algorandfoundation/algokit-utils'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import { Address } from 'algosdk'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { LocalStorageFactory } from '../artifacts/clients/LocalStorage/LocalStorageClient'

describe('LocalStorage contract', () => {
  const localnet = algorandFixture()

  beforeAll(() => {
    Config.configure({ debug: true })
  })
  beforeEach(localnet.newScope)

  const deploy = async (account: Address) => {
    const factory = localnet.algorand.client.getTypedAppFactory(LocalStorageFactory, {
      defaultSender: account,
    })
    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
      suppressLog: true,
    })
    return { client: appClient }
  }

  test('opt in and read local state', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    // MUST opt in before accessing local state
    await client.newGroup().optIn.optInToApplication().send()

    const result = await client.newGroup().readLocalState().simulate()
    expect(result.returns![0]).toBeDefined()
  })

  test('write and read local state', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    await client.newGroup().optIn.optInToApplication().send()

    await client
      .newGroup()
      .writeLocalState({
        args: {
          valueString: 'Hello',
          valueBool: true,
          valueAccount: testAccount.addr.toString(),
        },
      })
      .send()

    const result = await client.newGroup().readLocalState().simulate()
    expect(result.returns![0]![3]).toBe('Hello')
  })
})
```

## StructInBox - Struct Returns as Tuples

**Source:** [StructInBox/contract.algo.e2e.spec.ts](https://github.com/algorandfoundation/devportal-code-examples/blob/main/projects/typescript-examples/contracts/StructInBox/contract.algo.e2e.spec.ts)

```typescript
test('create and get user struct', async () => {
  const { testAccount } = localnet.context
  const { client } = await deploy(testAccount)

  await fundContract(testAccount, client.appAddress)

  const testUser = {
    id: 1n,
    name: 'TestUser',
    age: 25n,
  }

  await client.send.createNewUser({
    args: { id: 1n, user: testUser },
    boxReferences: [createBoxReference(client.appId, 'users', 1n)],
  })

  const { returns } = await client.send.getUser({
    args: { id: 1n },
    boxReferences: [createBoxReference(client.appId, 'users', 1n)],
  })

  // CRITICAL: Struct returns are tuples, access by index
  const [id, name, age] = returns?.[0]?.returnValue as [bigint, string, bigint]
  expect(id).toBe(testUser.id)
  expect(name).toBe(testUser.name)
  expect(age).toBe(testUser.age)
})
```

## Key Patterns Summary

| Pattern | Code |
|---------|------|
| Deploy | `const { appClient } = await factory.deploy({ onUpdate: 'append', onSchemaBreak: 'append' })` |
| Send method | `await client.send.methodName({ args: { ... } })` |
| Chain methods | `await client.newGroup().method1().method2().send()` |
| Simulate | `await client.newGroup().method().simulate()` |
| Fund app | `await localnet.algorand.send.payment({ amount: (1).algo(), sender, receiver: client.appAddress })` |
| Opt-in | `await client.newGroup().optIn.optInToApplication().send()` |
| Box reference | `boxReferences: ['boxName']` or `boxReferences: [createBoxReference(...)]` |
| Struct return | `const [field1, field2] = result.return as [Type1, Type2]` |

---

## Unit Testing (only when explicitly requested)

**Only use unit tests if the user explicitly requests them.** Integration tests (E2E) are the default and recommended approach.

### When to use unit tests

- User explicitly says "unit test" or "offline test"
- Testing pure contract logic without network interaction
- Fast iteration during contract development

### File naming

- Unit tests: `contract.algo.spec.ts` (no `.e2e.` in the name)

### Key Differences from E2E Tests

| Aspect | E2E Tests | Unit Tests |
|--------|-----------|------------|
| **Framework** | `algorandFixture` | `TestExecutionContext` |
| **Network** | LocalNet | Emulated AVM |
| **Contract access** | Via typed client | Direct instance |
| **Method calls** | `client.send.method({ args: {...} })` | `contract.method(arg1, arg2)` |
| **Struct returns** | Tuples `[field1, field2]` | Object properties `result.field1` |
| **File naming** | `*.e2e.spec.ts` | `*.spec.ts` |

### Basic Setup

```typescript
import { TestExecutionContext } from '@algorandfoundation/algorand-typescript-testing'
import { describe, expect, it, afterEach } from 'vitest'
import MyContract from './contract.algo'

describe('MyContract unit tests', () => {
  const ctx = new TestExecutionContext()

  afterEach(() => {
    ctx.reset()
  })

  it('should call method directly', () => {
    const contract = ctx.contract.create(MyContract)
    const result = contract.myMethod('arg1', 42n)
    expect(result).toBe('expected value')
  })
})
```

### Canonical Example

**Source:** [HelloWorld/contract.algo.spec.ts](https://github.com/algorandfoundation/devportal-code-examples/blob/main/projects/typescript-examples/contracts/HelloWorld/contract.algo.spec.ts)

```typescript
import { TestExecutionContext } from '@algorandfoundation/algorand-typescript-testing'
import { describe, expect, it } from 'vitest'
import HelloWorld from './contract.algo'

describe('HelloWorld unit tests', () => {
  const ctx = new TestExecutionContext()

  it('returns greeting', () => {
    const contract = ctx.contract.create(HelloWorld)
    const result = contract.sayHello('Sally', 'Jones')
    expect(result).toBe('Hello Sally Jones')
  })
})
```

### Testing with State

```typescript
import { TestExecutionContext } from '@algorandfoundation/algorand-typescript-testing'
import { Uint64 } from '@algorandfoundation/algorand-typescript'
import { describe, expect, it, afterEach } from 'vitest'
import CounterContract from './contract.algo'

describe('Counter unit tests', () => {
  const ctx = new TestExecutionContext()

  afterEach(() => {
    ctx.reset()
  })

  it('increments counter', () => {
    const contract = ctx.contract.create(CounterContract)
    contract.increment()
    contract.increment()
    expect(contract.counter.value).toBe(Uint64(2))
  })
})
```

### Testing with Multiple Accounts

```typescript
it('supports multiple accounts', () => {
  const contract = ctx.contract.create(MyContract)
  const account1 = ctx.any.account()
  const account2 = ctx.any.account()

  ctx.txn.sender = account1
  contract.doSomething()

  ctx.txn.sender = account2
  contract.doSomethingElse()
})
```

### Testing Boxes

```typescript
it('sets box value', () => {
  const contract = ctx.contract.create(BoxContract)
  const key = Bytes('myKey')
  const value = Bytes('myValue')

  contract.setBox(key, value)

  const storedValue = ctx.ledger.getBox(contract, key)
  expect(storedValue).toEqual(value)
})
```

### Unit Testing Documentation

- [TypeScript Unit Testing Guide](https://dev.algorand.co/algokit/unit-testing/typescript/overview)
- [TestExecutionContext API](https://dev.algorand.co/algokit/unit-testing/typescript/concepts)
- [State Management in Tests](https://dev.algorand.co/algokit/unit-testing/typescript/state-management)
