---
title: Components
description: Copy-paste React over the tool contract — vibekit add <name>.
draft: false
---

Each component's props are a tool's output type, so the same data from an
agent event, a REST response, or an MCP result renders unchanged. The files
are copied into your project and are yours after that; the `vk-*` classes
in `components.css` are hooks to restyle.

```bash
vibekit add --list
vibekit add transaction asset approval        # --dir components  --force
```

| name | props | what it is |
| --- | --- | --- |
| `companion` | `mood, step, faces` | [qt314's face](../add-a-companion/) — your own strings |
| `action` | `host, store, newId, onNotice` | `useAction`: one action from draft to confirmed, headless |
| `approval` | `WriteDraftData`, a simulation, approve/deny | the decision screen; red on mainnet or a failed simulation |
| `tool-result` | a `tool-result` event | JSON, errors handled — the fallback for any tool |
| `transaction` | `ViewData<'transaction.detail'>` | one transaction |
| `asset` | `ViewData<'asset.detail'>` / `'asset.list'` | an asset, and the list |
| `account` | `ViewData<'account.summary'>` | balance, holdings, rekey flag |

Source: [`packages/vibekit/components`](https://github.com/initlabsai/vibekit/tree/main/packages/vibekit/components).
The rule for adding one: if a component needs logic, the tool should return
that field — a curl user needs it too.
