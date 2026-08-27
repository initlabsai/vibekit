---
'@initlabs/vibekit': major
'@initlabs/vibekit-explorer': major
'@initlabs/vibekit-cli': major
'@initlabs/vibekit-tui': major
---

Collapse the ten npm packages into one, `@initlabs/vibekit`, with subpath
exports. `@initlabs/vibekit-core` is now the root import; the rest move to
`./tools`, `./tools/views`, `./agent`, `./agent/config`, `./mcp`,
`./mcp/stdio`, `./mcp/http`, `./signer-keystore`, `./preset`, and
`./plugins/<name>`. The old package names are retired.
