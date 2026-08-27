---
'@initlabs/vibekit': minor
---

The third-party SDKs behind `./agent`, `./mcp`, `./signer-keystore`, and the plugins are optional peer dependencies now, not dependencies. `algosdk` and `zod` stay the only required peers; a consumer that imports only the contract and the tools installs nothing else. Each subpath's peers are listed in the README.
