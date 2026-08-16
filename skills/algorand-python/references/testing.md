# Testing Algorand Python Contracts

## Contents

- [Default: Integration Tests](#default-integration-tests)
- [BoxStorage E2E Example](#boxstorage-e2e-example)
- [LocalStorage E2E Example](#localstorage-e2e-example)
- [Common Patterns](#common-patterns)
- [Key Patterns Summary](#key-patterns-summary)
- [Critical Rules](#critical-rules)
- [Running Tests](#running-tests)
- [Unit Testing (only when explicitly requested)](#unit-testing-only-when-explicitly-requested)
- [Priority Repositories for Examples](#priority-repositories-for-examples)

Write tests for Algorand Python contracts using pytest and AlgoKit Utils.

## Default: Integration Tests

**Always write integration tests unless explicitly asked for unit tests.** Integration tests run against LocalNet and test real contract behavior.

### File Naming

- Integration tests: `test_contract.py` or `test_contract_e2e.py`
- Unit tests (only if requested): `test_contract_unit.py`

### Canonical Example

Study and adapt from: [devportal-code-examples/contracts/HelloWorld](https://github.com/algorandfoundation/devportal-code-examples/tree/main/projects/python-examples/contracts/HelloWorld)

```python
import pytest
from algokit_utils import AlgorandClient, AlgoAmount
from artifacts.my_contract_client import MyContractFactory


@pytest.fixture
def algorand() -> AlgorandClient:
    """Create AlgorandClient connected to LocalNet."""
    return AlgorandClient.default_localnet()


@pytest.fixture
def deployer(algorand: AlgorandClient):
    """Get a funded deployer account."""
    account = algorand.account.random()
    algorand.account.ensure_funded(
        account.address,
        AlgoAmount(algo=10),
    )
    return account


@pytest.fixture
def app_client(algorand: AlgorandClient, deployer):
    """Deploy contract and return typed client."""
    factory = algorand.client.get_typed_app_factory(
        MyContractFactory,
        default_sender=deployer.address,
    )
    result = factory.deploy(
        on_update="append",
        on_schema_break="append",
    )
    return result.app_client


def test_my_method(app_client):
    """Test calling a contract method."""
    result = app_client.send.my_method(value=42)
    assert result.abi_return == 42
```

## BoxStorage E2E Example

```python
import pytest
from algokit_utils import AlgorandClient, AlgoAmount
from artifacts.box_storage_client import BoxStorageFactory


@pytest.fixture
def algorand() -> AlgorandClient:
    return AlgorandClient.default_localnet()


@pytest.fixture
def deployer(algorand: AlgorandClient):
    account = algorand.account.random()
    algorand.account.ensure_funded(account.address, AlgoAmount(algo=10))
    return account


@pytest.fixture
def app_client(algorand: AlgorandClient, deployer):
    factory = algorand.client.get_typed_app_factory(
        BoxStorageFactory,
        default_sender=deployer.address,
    )
    result = factory.deploy(on_update="append", on_schema_break="append")
    return result.app_client


def fund_contract(algorand, sender, app_client):
    """CRITICAL: Fund app account before any box operations."""
    algorand.send.payment(
        sender=sender.address,
        receiver=app_client.app_address,
        amount=AlgoAmount(algo=1),
    )


def test_set_and_read_box(algorand, deployer, app_client):
    """Test setting and reading a box value."""
    fund_contract(algorand, deployer, app_client)

    app_client.send.set_box(value_int=42)

    # Read box state via typed client
    box_value = app_client.state.box.box_int()
    assert box_value == 42


def test_set_and_read_box_map(algorand, deployer, app_client):
    """Test BoxMap with key-value pairs."""
    fund_contract(algorand, deployer, app_client)

    app_client.send.set_box_map(key=1, value="Hello")

    result = app_client.send.get_box_map(key=1)
    assert result.abi_return == "Hello"
```

## LocalStorage E2E Example

```python
import pytest
from algokit_utils import AlgorandClient, AlgoAmount
from artifacts.local_storage_client import LocalStorageFactory


@pytest.fixture
def algorand() -> AlgorandClient:
    return AlgorandClient.default_localnet()


@pytest.fixture
def deployer(algorand: AlgorandClient):
    account = algorand.account.random()
    algorand.account.ensure_funded(account.address, AlgoAmount(algo=10))
    return account


@pytest.fixture
def app_client(algorand: AlgorandClient, deployer):
    factory = algorand.client.get_typed_app_factory(
        LocalStorageFactory,
        default_sender=deployer.address,
    )
    result = factory.deploy(on_update="append", on_schema_break="append")
    return result.app_client


def test_opt_in_and_read_local_state(app_client):
    """MUST opt in before accessing local state."""
    app_client.send.opt_in.opt_in()

    result = app_client.send.read_local_state()
    assert result.abi_return is not None


def test_write_and_read_local_state(app_client):
    """Write local state then verify values."""
    app_client.send.opt_in.opt_in()

    app_client.send.write_local_state(
        value_string="Hello",
        value_bool=True,
    )

    result = app_client.send.read_local_state()
    assert result.abi_return is not None


def test_multi_user_local_state(algorand, deployer, app_client):
    """Each user has independent local state."""
    # User 1 opts in and writes
    app_client.send.opt_in.opt_in()
    app_client.send.write_local_state(value_string="Alice")

    # Create user 2
    user2 = algorand.account.random()
    algorand.account.ensure_funded(user2.address, AlgoAmount(algo=5))

    client2 = algorand.client.get_typed_app_client_by_id(
        LocalStorageFactory,
        app_id=app_client.app_id,
        default_sender=user2.address,
    )
    client2.send.opt_in.opt_in()
    client2.send.write_local_state(value_string="Bob")

    # Verify each user's state is independent
    local1 = app_client.state.local_state(deployer.address).get_all()
    local2 = app_client.state.local_state(user2.address).get_all()
    assert local1 != local2
```

## Common Patterns

### Fund Contract for Box Storage

```python
def test_box_storage(algorand, app_client, deployer):
    # Fund app account for box MBR
    algorand.send.payment(
        sender=deployer.address,
        receiver=app_client.app_address,
        amount=AlgoAmount(algo=1),
    )

    # Now box operations will succeed
    app_client.send.set_box(key=1, value="hello")
```

### Multiple Users

```python
def test_multi_user(algorand, app_client, deployer):
    # Create and fund second user
    user2 = algorand.account.random()
    algorand.account.ensure_funded(
        user2.address,
        AlgoAmount(algo=5),
    )

    # Get client for same app with different sender
    client2 = algorand.client.get_typed_app_client_by_id(
        MyContractFactory,
        app_id=app_client.app_id,
        default_sender=user2.address,
    )

    # Opt in as user2
    client2.send.opt_in.opt_in()
```

### Testing with Transaction Groups

```python
def test_grouped_calls(app_client):
    result = (
        app_client.new_group()
        .method1(arg1="hello")
        .method2(arg2=42)
        .send()
    )
    assert result.returns[0].value == "expected"
```

### Error Testing

```python
import pytest
from algokit_utils import LogicError


def test_unauthorized_access(app_client):
    """Test that unauthorized calls are rejected."""
    with pytest.raises(LogicError, match="assert failed"):
        app_client.send.admin_only_method()


def test_invalid_input(app_client):
    """Test input validation."""
    with pytest.raises(LogicError):
        app_client.send.set_value(value=0)  # Contract requires value > 0
```

### Simulation (Read-Only Calls)

```python
def test_read_only_via_simulate(app_client):
    """Use simulate for read-only methods — no fees, no signing."""
    result = (
        app_client.new_group()
        .get_counter()
        .simulate()
    )
    counter_value = result.returns[0].value
    assert counter_value >= 0


def test_simulate_before_send(app_client):
    """Dry-run a state-changing call to check it would succeed."""
    result = (
        app_client.new_group()
        .increment(amount=1)
        .simulate()
    )
    # Verify it would succeed without actually changing state
    assert result.returns[0].value is not None
```

### State Verification

```python
def test_global_state(app_client):
    """Read and verify global state."""
    app_client.send.increment()
    app_client.send.increment()

    state = app_client.state.global_state.get_all()
    assert state["counter"] == 2

    # Or read a specific key
    counter = app_client.state.global_state.counter()
    assert counter == 2


def test_local_state(app_client, deployer):
    """Read and verify local state for an account."""
    app_client.send.opt_in.opt_in()
    app_client.send.set_nickname(name="Alice")

    local = app_client.state.local_state(deployer.address).get_all()
    assert local["nickname"] == "Alice"


def test_box_state(algorand, deployer, app_client):
    """Read and verify box state."""
    algorand.send.payment(
        sender=deployer.address,
        receiver=app_client.app_address,
        amount=AlgoAmount(algo=1),
    )
    app_client.send.set_box(value=42)

    box_value = app_client.state.box.my_box()
    assert box_value == 42
```

## Key Patterns Summary

| Pattern | Code |
|---------|------|
| Deploy | `result = factory.deploy(on_update="append", on_schema_break="append")` |
| Send method | `result = app_client.send.method_name(arg1=value)` |
| Chain methods | `app_client.new_group().method1().method2().send()` |
| Simulate | `app_client.new_group().method().simulate()` |
| Fund app | `algorand.send.payment(sender=deployer.address, receiver=app_client.app_address, amount=AlgoAmount(algo=1))` |
| Opt-in | `app_client.send.opt_in.opt_in()` |
| Error test | `with pytest.raises(LogicError, match="assert failed"): ...` |

## Critical Rules

| Rule | Details |
|------|---------|
| **Use pytest fixtures** | Set up AlgorandClient and accounts as fixtures |
| **Fund accounts** | Use `ensure_funded` for test accounts |
| **Fund app for boxes** | Send payment to `app_client.app_address` before box operations |
| **Opt-in before local state** | Call `opt_in` before reading/writing local state |
| **Build before testing** | Run `algokit project run build` to generate typed clients |

## Running Tests

```bash
algokit project run build   # Build first (generates typed clients)
algokit project run test    # Run pytest
```

---

## Unit Testing (only when explicitly requested)

**Only use unit tests if the user explicitly requests them.** Integration tests (E2E) are the default and recommended approach.

### When to use unit tests

- User explicitly says "unit test" or "offline test"
- Testing pure contract logic without network interaction
- Fast iteration during contract development

### Key Differences from E2E Tests

| Aspect | E2E Tests | Unit Tests |
|--------|-----------|------------|
| **Framework** | pytest + AlgorandClient | `algopy_testing_context()` |
| **Network** | LocalNet | Emulated AVM |
| **Contract access** | Via typed client | Direct instance |
| **Method calls** | `app_client.send.method(arg=val)` | `contract.method(arg)` |
| **File naming** | `test_contract.py` | `test_contract_unit.py` |

### Basic Setup

```python
from algopy_testing import algopy_testing_context

def test_basic():
    with algopy_testing_context() as context:
        contract = MyContract()
        result = contract.my_method(arc4.UInt64(42))
        assert result == arc4.UInt64(42)
```

### Testing with State

```python
from algopy_testing import algopy_testing_context
from algopy import UInt64

def test_counter():
    with algopy_testing_context() as context:
        contract = CounterContract()
        contract.increment()
        contract.increment()
        assert contract.counter == UInt64(2)
```

### Testing with Multiple Accounts

```python
from algopy_testing import algopy_testing_context

def test_multi_account():
    with algopy_testing_context() as context:
        contract = MyContract()

        account1 = context.any.account()
        account2 = context.any.account()

        context.txn.sender = account1
        contract.do_something()

        context.txn.sender = account2
        contract.do_something_else()
```

### Testing Boxes

```python
from algopy_testing import algopy_testing_context
from algopy import Bytes

def test_box_operations():
    with algopy_testing_context() as context:
        contract = BoxContract()
        contract.set_box(Bytes(b"myKey"), Bytes(b"myValue"))

        stored = context.ledger.get_box(contract, Bytes(b"myKey"))
        assert stored == Bytes(b"myValue")
```

### Testing Logic Signatures

```python
from algopy_testing import algopy_testing_context
from algopy import Bytes

def test_logicsig():
    with algopy_testing_context() as context:
        with context.txn.create_group([
            context.any.txn.payment(),
        ]):
            result = context.execute_logicsig(
                my_logic_sig, Bytes(b"secret")
            )
        assert result is True
```

### Unit Testing Documentation

- [Python Unit Testing Guide](https://dev.algorand.co/algokit/unit-testing/python/overview)
- [AlgopyTestContext API](https://dev.algorand.co/algokit/unit-testing/python/concepts)
- [State Management in Tests](https://dev.algorand.co/algokit/unit-testing/python/state-management)

## Priority Repositories for Examples

| Repository | Path |
|-----------|------|
| `algorandfoundation/devportal-code-examples` | `projects/python-examples/contracts/` |
| `algorandfoundation/puya` | `examples/` |
| `algorandfoundation/algokit-python-template` | Template test patterns |
