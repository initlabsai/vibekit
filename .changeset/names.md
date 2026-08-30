---
'@initlabs/vibekit': minor
'@initlabs/vibekit-cli': minor
---

The names, settled. `actions`: `draftDataSchema`/`DraftData`, `simulationDataSchema`, `stageEventSchema`/`createStageEvent`, `actionIntentSchema`, `actionResultSchema`, `createRecord`, `nextActionEvents`, `createActionHost(deployment)`, `signDraftWith`. `views` exports views only (records and the machine come from `actions`); fixtures are `views/sample`; `ReadHost`, `classifyInput`, `routeInput`, `InputRoute`, `formatTime`; `createDeploymentReadHost`, the block tail. `preset`: `createHost(network)` (the stock combined host) and the Explorer agent (`createExplorerAgent`, `explorerTools`, `explorerSystemPrompt`, `explorerPlugins`, `explainApplicationTool`). `live` is gone. `mcp`: `createMcpServer`, `createMcpServerFactory`, `createMcpHttpHandler`, `serveMcpStdio`. `rest`: `createRestHandler`, `POST …/tools/<name>`. The root exports the contract only; the compose engine is `@initlabs/vibekit/compose`; provider plumbing is `agent/providers`, the config file is `agent/config`.
