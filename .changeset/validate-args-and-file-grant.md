---
'@initlabs/vibekit': minor
---

`executeToolCall` validates arguments against the tool's parameter schema before the handler runs (`INVALID_ARGS`), so every host gets defaults and drops extras the same way. Local file reads are now a capability a deployment grants with `readFile` (`readLocalFile` from `./preset` on local hosts); without it, `appSpecPath` answers `APP_SPEC_PATH_UNAVAILABLE` instead of reading the host's filesystem. Write tools fetch suggested params once per group.
