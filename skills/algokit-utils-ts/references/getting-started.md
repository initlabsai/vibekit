## Getting started

Before exploring the snippets below, install the library and set up your
environment.

### Installation

```bash
npm install @algorandfoundation/algokit-utils@^10.0.0
```

### Basic import

```typescript
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
```

### Prerequisites

Most examples in this document assume you have a running
[AlgoKit LocalNet](https://github.com/algorandfoundation/algokit-cli)
instance. LocalNet gives you a private Algorand network with pre-funded
accounts, an indexer, and a KMD wallet — everything you need to experiment
without spending real Algo.

Start LocalNet with:

```bash
algokit localnet start
```
