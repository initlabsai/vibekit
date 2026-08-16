## Smart contract deployment

> All snippets in this section assume an `AlgorandClient` named `algorand` and
> an account named `deployer` — see [Client initialization](#client-initialization)
> and [Account management](#account-management) for setup.

### Create an AppFactory from an app spec

Point an `AppFactory` at an ARC-56 (or ARC-32) app spec so it knows your contract's interface.

```python
from algokit_utils.applications.app_factory import AppFactory, AppFactoryParams

factory = AppFactory(
    AppFactoryParams(
        algorand=algorand,
        app_spec=app_spec_json,
        default_sender=deployer.addr,
        default_signer=deployer.signer,
    )
)
```

**What just happened:** You created an `AppFactory` bound to the parsed app spec and a default sender. The factory can now compile, create, and deploy instances of this contract. It accepts ARC-56 `Arc56Contract` objects, ARC-32 objects, or raw JSON strings — the library normalises internally.

### Create a new app instance via AppFactory

Deploy a fresh app instance using a bare create call (no ABI method).

```python
from algokit_utils.applications.app_factory import AppFactoryCreateParams

app_client, result = factory.send.bare.create(AppFactoryCreateParams())

print(f"App ID: {result.app_id}")
print(f"App address: {result.app_address}")
```

**What just happened:** The factory compiled the TEAL programs from the app spec, sent a bare application create transaction, and returned both an `AppClient` (for subsequent interaction) and the creation result containing the new `app_id` and `app_address`.

### Create a new app instance with an ABI method

Call a specific ABI method as the create transaction.

```python
from algokit_utils.applications.app_factory import AppFactoryCreateMethodCallParams

app_client, result = factory.send.create(
    AppFactoryCreateMethodCallParams(
        method="createApplication",
        args=["Hello, World!"],
    )
)

print(f"Returned: {result.abi_return}")
```

**What just happened:** Instead of a bare call, the factory invoked the `createApplication` ABI method during app creation. The `result.abi_return` field contains the decoded ABI return value. You get back the same `(AppClient, result)` tuple as a bare create.

### Idempotent deploy via AppFactory

Deploy once, then no-op on subsequent calls if the contract hasn't changed.

```python
from algokit_utils.applications.enums import OnSchemaBreak, OnUpdate

app_client, result = factory.deploy(
    on_update=OnUpdate.UpdateApp,
    on_schema_break=OnSchemaBreak.ReplaceApp,
)

print(f"Operation: {result.operation_performed}")  # Create, Update, Replace, or Nothing
```

**What just happened:** `factory.deploy()` checked whether an app with this name already exists for the sender. If not, it creates one. If the TEAL code changed, it applies the `on_update` strategy (here: update in place). If the state schema grew beyond the existing allocation, it applies the `on_schema_break` strategy (here: delete and recreate). If nothing changed, `operation_performed` is `Nothing` and no transaction is sent. This is the recommended pattern for CI/CD pipelines.

### Deploy with onSchemaBreak and onUpdate strategies

Control what happens when the contract code or state schema changes between deployments.

```python
from algokit_utils.applications.app_client import (
    AppClientBareCallCreateParams,
    AppClientMethodCallParams,
)
from algokit_utils.applications.enums import OnSchemaBreak, OnUpdate

app_client, result = factory.deploy(
    on_update=OnUpdate.ReplaceApp,
    on_schema_break=OnSchemaBreak.Fail,
    create_params=AppClientBareCallCreateParams(),
    update_params=AppClientMethodCallParams(method="updateApplication"),
    delete_params=AppClientMethodCallParams(method="deleteApplication"),
)
```

**What just happened:** You configured explicit strategies for handling changes. `on_update=ReplaceApp` means if the TEAL code changes, the old app is deleted and a new one is created. `on_schema_break=Fail` means a breaking schema change throws an error. The available strategies are: `Fail` (throw), `UpdateApp` (update in place — `on_update` only), `ReplaceApp` (delete and recreate), and `AppendApp` (create new, keep old). The `create_params`, `update_params`, and `delete_params` let you specify how each operation is performed.

### Deploy with template variable replacements

Substitute TEAL template placeholders at deploy time.

```python
from algokit_utils.applications.app_client import AppClientCompilationParams
from algokit_utils.applications.app_factory import AppFactory, AppFactoryParams

factory = AppFactory(
    AppFactoryParams(
        algorand=algorand,
        app_spec=app_spec_json,
        default_sender=deployer.addr,
        default_signer=deployer.signer,
    )
)

app_client, result = factory.deploy(
    on_update=OnUpdate.UpdateApp,
    on_schema_break=OnSchemaBreak.ReplaceApp,
    compilation_params=AppClientCompilationParams(
        deploy_time_params={"VALUE": 42, "NAME": "my-instance"},
        updatable=True,
        deletable=True,
    ),
)
```

**What just happened:** The factory replaced `TMPL_VALUE` and `TMPL_NAME` in the TEAL programs before compilation. Setting `updatable=True` and `deletable=True` also injects `TMPL_UPDATABLE` and `TMPL_DELETABLE` template values if present in the TEAL. Template params can be set at the factory level or overridden per-call via `compilation_params`.
