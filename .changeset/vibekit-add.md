---
'@initlabs/vibekit-cli': minor
---

`vibekit add <component…>`: copies a React component's source into your project, ShadCN-style — `companion`, `action` (the headless useAction hook), `approval`, `tool-result`, `transaction`, `asset`, `account`. Each takes a tool's output type as props; the .css files are hooks to restyle. `--list` browses, `--dir` targets, `--force` overwrites. The source of truth is `packages/vibekit/components`, bundled at build time.
