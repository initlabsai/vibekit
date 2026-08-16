## Configuration and global settings

### Set populate_app_call_resources globally

Enable automatic resource population for all application calls.

```python
from algokit_utils.config import config

config.configure(populate_app_call_resources=True)
```

**What just happened:** You turned on automatic resource population library-wide. Every application call sent through `AlgorandClient` will now use simulation to discover and attach the required reference arrays (boxes, accounts, apps, assets) before submitting.

### Configure logging and debugging

Control debug mode, tracing, and logging through the global `config` singleton.

```python
from algokit_utils.config import config
import logging

# Enable debug mode with trace collection
config.configure(debug=True, trace_all=True)

# Use a custom logger
my_logger = logging.getLogger("my-app")
config.configure(logger=my_logger)

# Silence library output
config.configure(debug=False, trace_all=False)
```

**What just happened:** `config` is a singleton `UpdatableConfig` from `algokit_utils.config`. Setting `debug=True` increases log verbosity, and `trace_all=True` stores simulation traces for all operations. You can route logs through any standard `logging.Logger` instance, or silence output by disabling both flags.
