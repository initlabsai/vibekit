---
'@initlabs/vibekit-cli': patch
---

`vibekit init` merges existing files instead of clobbering them. Pointer files
(CLAUDE.md, .cursorrules, copilot instructions) gain the AGENTS.md paragraph by
guarded append; a project's own AGENTS.md is kept, with VibeKit's written beside
it as AGENTS.vibekit.md and chained by one line. TOML configs (codex, grok) now
parse-and-merge like JSON, so your settings and MCP servers survive. The
install-path prompt is a real path picker with tab completion.
