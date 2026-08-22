/**
 * `vibekit explore setup` — configure the Explorer's agent model. Writes
 * provider/model/baseUrl to ~/.config/vibekit/config.json; API keys stay
 * in env vars and are never written to disk.
 */
import * as p from "@clack/prompts";
import pc from "picocolors";

import {
  listZeroSignalModels,
  loadStoredAgentConfig,
  probeZeroSignal,
  saveStoredAgentConfig,
  zeroSignalBaseUrl,
  readZeroSignalCatalog,
  formatZeroSignalPrice,
  type StoredAgentConfig,
} from "@initlabs/vibekit-agent/config";

import { confirm, select, text } from "../utils/prompts.js";

const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1";

export interface ExploreSetupFlags {
  provider?: string;
  model?: string;
  baseUrl?: string;
}

export function parseExploreSetupFlags(args: string[]): ExploreSetupFlags {
  const flags: ExploreSetupFlags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--provider") flags.provider = args[++i];
    else if (arg === "--model") flags.model = args[++i];
    else if (arg === "--base-url") flags.baseUrl = args[++i];
  }
  return flags;
}

function zeroSignalInstallSteps(): string {
  switch (process.platform) {
    case "darwin":
      return "brew install txnlab/tap/zs-proxy";
    case "win32":
      return "scoop bucket add txnlab https://github.com/TxnLab/scoop-bucket && scoop install zs-proxy";
    default:
      // Their install script; shown, never run — the user pastes it themselves.
      return "curl -fsSL https://zerosignal.ai/install.sh | sh";
  }
}

async function listOllamaModels(): Promise<string[]> {
  const response = await fetch(`${OLLAMA_DEFAULT_BASE_URL}/models`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`ollama answered ${response.status}`);
  const body = (await response.json()) as { data?: Array<{ id?: unknown }> };
  return (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function pickModel(
  models: string[],
  providerLabel: string,
  hint: (id: string) => string | undefined = () => undefined,
): Promise<string> {
  if (models.length === 0) {
    return text({
      message: `No models listed — enter a ${providerLabel} model id`,
    });
  }
  // The whole list: the select scrolls, and a silent cap once hid the cheapest half.
  const choice = await select({
    message: `Model (live from ${providerLabel})`,
    options: [
      ...models.map((id) => ({ value: id, label: id, hint: hint(id) })),
      { value: "__other__", label: "other — type an id" },
    ],
  });
  if (choice !== "__other__") return choice as string;
  return text({ message: "Model id" });
}

async function zeroSignalFlow(): Promise<StoredAgentConfig> {
  for (;;) {
    if (await probeZeroSignal()) break;
    p.log.warn(`zs-proxy is not running at ${zeroSignalBaseUrl()}.

To set it up:
  ${zeroSignalInstallSteps()}
  zs-proxy proxy start   ${pc.dim("# first run walks through wallet setup")}
  zs-proxy fund          ${pc.dim("# pay-per-message USDC; no subscription")}

Quickstart: https://txnlab.gitbook.io/zerosignal/using-the-proxy/quick-start`);
    const retry = await confirm("Re-check for the daemon?", true);
    if (!retry) {
      p.cancel("Run setup again once zs-proxy is up.");
      process.exit(0);
    }
  }
  const catalog = readZeroSignalCatalog();
  // Text models only (an image model cannot drive the Explorer), alphabetical.
  const models = (await listZeroSignalModels())
    .filter((id) => catalog.get(id)?.text !== false)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  const model = await pickModel(models, "the ZeroSignal operator network", (id) =>
    formatZeroSignalPrice(catalog.get(id)),
  );
  return { provider: "zerosignal", model };
}

async function ollamaFlow(): Promise<StoredAgentConfig> {
  let models: string[] = [];
  try {
    models = await listOllamaModels();
  } catch {
    p.log.warn(
      "Ollama is not answering on :11434 — start it (or pick a model id to use later).",
    );
  }
  const model = await pickModel(models, "ollama");
  return { provider: "ollama", model };
}

async function keyedFlow(
  provider: "anthropic" | "openai",
  envVar: string,
  exampleModel: string,
): Promise<StoredAgentConfig> {
  if (process.env[envVar]) {
    p.log.success(
      `${envVar} found in your environment — it stays there; nothing is written to disk.`,
    );
  } else {
    p.log.warn(
      `${envVar} is not set. The Explorer reads it from your environment at launch; export it before running vibekit explore.`,
    );
  }
  const model = await text({ message: `Model id (e.g. ${exampleModel})` });
  return { provider, model };
}

async function openAICompatibleFlow(): Promise<StoredAgentConfig> {
  const baseUrl = await text({ message: "Base URL (e.g. http://box:8000/v1)" });
  const model = await text({ message: "Model id" });
  return { provider: "openai-compatible", model, baseUrl };
}

export async function commandExploreSetup(args: string[]): Promise<void> {
  const flags = parseExploreSetupFlags(args);

  // Headless: all required flags present → no prompts (agents, CI).
  if (flags.provider && flags.model) {
    const path = saveStoredAgentConfig({
      provider: flags.provider as StoredAgentConfig["provider"],
      model: flags.model,
      ...(flags.baseUrl ? { baseUrl: flags.baseUrl } : {}),
    });
    console.log(`Saved ${flags.provider}/${flags.model} to ${path}`);
    return;
  }

  p.intro(pc.cyan("Explorer agent setup"));
  const current = loadStoredAgentConfig();
  if (current) p.log.info(`Currently: ${current.provider} / ${current.model}`);

  const provider = await select({
    message: "Inference provider for the Explorer chat lane",
    options: [
      {
        value: "zerosignal",
        label: "ZeroSignal",
        hint: "private, decentralized, no API keys, this is the way",
      },
      { value: "ollama", label: "Ollama", hint: "local models, no API key" },
      {
        value: "anthropic",
        label: "Anthropic",
        hint: "needs ANTHROPIC_API_KEY in env",
      },
      { value: "openai", label: "OpenAI", hint: "needs OPENAI_API_KEY in env" },
      {
        value: "openai-compatible",
        label: "OpenAI-compatible endpoint",
        hint: "custom base URL",
      },
    ],
  });

  let config: StoredAgentConfig;
  switch (provider) {
    case "zerosignal":
      config = await zeroSignalFlow();
      break;
    case "ollama":
      config = await ollamaFlow();
      break;
    case "anthropic":
      config = await keyedFlow(
        "anthropic",
        "ANTHROPIC_API_KEY",
        "claude-sonnet-5",
      );
      break;
    case "openai":
      config = await keyedFlow("openai", "OPENAI_API_KEY", "gpt-5");
      break;
    default:
      config = await openAICompatibleFlow();
  }

  const path = saveStoredAgentConfig(config);
  p.outro(
    `Saved to ${path} — run ${pc.cyan("vibekit explore")} to chat. Env vars (VIBEKIT_AGENT_*) still override.`,
  );
}
