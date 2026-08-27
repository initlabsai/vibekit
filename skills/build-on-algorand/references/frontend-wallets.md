# Frontend wallets

Keep wallet integration small. The wallet owns account selection and signing;
the generated client owns contract encoding; the frontend owns network and
app-ID configuration.

If the optional TxnLab catalog is installed, load its `use-wallet` skill for a
deeper integration. Otherwise, use the canonical
[use-wallet skill source](https://github.com/TxnLab/skills/tree/main/skills/use-wallet).
Use [use-wallet-ui](https://github.com/TxnLab/use-wallet-ui) when the product
wants a maintained connect/account UI rather than custom controls.

## Minimal React shape

For a browser-only SPA, create one `WalletManager` at module scope, configure
only supported wallets, and wrap the app with `WalletProvider`:

```tsx
import type { ReactNode } from 'react'
import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider,
} from '@txnlab/use-wallet-react'

const manager = new WalletManager({
  wallets: [{ id: WalletId.PERA }, { id: WalletId.LUTE }],
  defaultNetwork: NetworkId.TESTNET,
})

export function WalletRoot({ children }: { children: ReactNode }) {
  return <WalletProvider manager={manager}>{children}</WalletProvider>
}
```

In SSR frameworks, create a stable client-only manager; do not share a mutable
manager across server requests. Keep wallet network and algod configuration
aligned with the `AlgorandClient` used by the generated client. For use-wallet
v4, use its separate `useNetwork` API for network state and switching; do not
copy v3 provider snippets.

At the call site, hand the wallet signer directly to the generated method:

```tsx
const { activeAddress, transactionSigner } = useWallet()

if (!activeAddress) throw new Error('Connect a wallet first')

const client = new ExampleClient({ algorand, appId })
const result = await client.send.exampleMethod({
  args: { value },
  sender: activeAddress,
  signer: transactionSigner,
})
```

Inspect the generated client before copying this shape; constructor and method
names follow the project's generator version. Passing `sender` and `signer`
per call keeps authority visible. If the existing application registers a
signer on `AlgorandClient` instead, use that pattern consistently rather than
mixing implicit and explicit resolution.

See the public VibeKit starter's
[wallet setup](https://github.com/initlabsai/algorand-starter-fullstack/blob/main/app/src/App.tsx)
and [generated-client call](https://github.com/initlabsai/algorand-starter-fullstack/blob/main/app/src/components/AppCalls.tsx)
for a complete handoff.

## Browser constraints

- Require a connected address before constructing a write request.
- Initiate signing from a direct user action; popup and mobile wallets can
  reject signing started by an effect, timer, or background callback.
- Display the network, app, action, and material amounts before requesting a
  signature. Do not silently switch networks.
- Keep the wallet manager stable across renders and restore sessions only
  through the library's supported lifecycle.
- Gate wallet-dependent rendering until the adapter is ready in SSR apps to
  avoid hydration mismatches.
- Never put mnemonics, private keys, or secret signing material in browser
  state, environment variables shipped to the client, logs, or analytics.
- Treat rejection as a normal user outcome and do not auto-retry signing.
