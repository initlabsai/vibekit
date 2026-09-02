---
'@initlabs/vibekit-cli': minor
---

The CLI notices when a newer release exists: one dim line on exit with the
upgrade command, checked against GitHub at most once a day and cached in
~/.config/vibekit/update-check.json. Skipped for the MCP server, non-TTY,
CI, and VIBEKIT_NO_UPDATE_CHECK=1.
