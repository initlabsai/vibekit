/**
 * The TUI's natural-language lane: an in-process @initlabs/vibekit-agent
 * session over a compose-only localnet deployment. The model reads via tools
 * and composes payments as unsigned groups; it never signs (there is no
 * signer in its deployment) and never emits UI — its tool results become
 * records and trusted views through the experience bridge, and any composed
 * payment lands on the same approval card as a typed `pay`.
 */
import {
  createAgent,
  type AgentEvent,
  type AgentSession,
} from "@initlabs/vibekit-agent";
import { accountTools } from "@initlabs/vibekit-tools-accounts";
import {
  transactionTools,
  transactionWriteTools,
} from "@initlabs/vibekit-tools-transactions";
import type { AnyTool } from "@initlabs/vibekit-core";
import type { ProviderConfig } from "@initlabs/vibekit-agent";

/** Reads the BYOM config from the environment; undefined disables the lane. */
export function loadAgentConfig(
  env: Record<string, string | undefined>,
): ProviderConfig | undefined {
  const model = env.VIBEKIT_AGENT_MODEL;
  if (!model) return undefined;
  const provider = (env.VIBEKIT_AGENT_PROVIDER ??
    "ollama") as ProviderConfig["provider"];
  return {
    provider,
    model,
    ...(env.VIBEKIT_AGENT_BASE_URL
      ? { baseUrl: env.VIBEKIT_AGENT_BASE_URL }
      : {}),
    ...(env.VIBEKIT_AGENT_API_KEY ? { apiKey: env.VIBEKIT_AGENT_API_KEY } : {}),
  };
}

const EXPLORER_TOOL_NAMES = [
  "lookup_transaction",
  "get_account_portfolio",
  "send_payment",
];

function explorerTools(): AnyTool[] {
  return [
    ...transactionTools,
    ...transactionWriteTools,
    ...accountTools,
  ].filter((tool) => EXPLORER_TOOL_NAMES.includes(tool.name));
}

/** Builds the workspace-discipline and address-book briefing for the model. */
export function explorerInstructions(
  addressBook: ReadonlyArray<{ address: string; name?: string }>,
): string {
  const book = addressBook
    .map((entry) => `- ${entry.name ?? "unnamed"}: ${entry.address}`)
    .join("\n");
  return [
    "You are the VibeKit Explorer agent. Every tool result renders as a card in",
    "a results feed next to this conversation — the user is already looking at the full",
    "details. NEVER restate what a card shows: no IDs, no addresses, no amounts,",
    "no field lists, no markdown headings or bullet lists. After your tool calls,",
    "reply with ONE short plain sentence of context or interpretation, nothing more.",
    "When the user names an account (like SMOKE1), resolve it to its address from",
    "the account list below before calling any tool — never pass a name to a tool.",
    "Payments: send_payment composes an unsigned transaction. It does NOT send",
    "anything. After calling it, say the payment is ready for review — approval,",
    "signing, and submission happen in the approval dialog, never here.",
    "Amounts for send_payment are in microALGO (1 ALGO = 1000000 microALGO).",
    "The user's accounts (keystore):",
    book || "- none available",
  ].join("\n");
}

export interface ExplorerAgentOptions {
  model: ProviderConfig | Parameters<typeof createAgent>[0]["model"];
  addressBook: ReadonlyArray<{ address: string; name?: string }>;
  network?: "localnet" | "testnet" | "mainnet";
  /** Test seam: replaces the real tool set. */
  tools?: AnyTool[];
}

/** Creates the Explorer's agent session (compose-only, signerless). */
export function createExplorerAgent(
  options: ExplorerAgentOptions,
): AgentSession {
  return createAgent({
    network: options.network ?? "localnet",
    mode: "compose",
    tools: options.tools ?? explorerTools(),
    model: options.model,
    maxSteps: 8,
    extraInstructions: explorerInstructions(options.addressBook),
  });
}

/** Renderer callbacks for one agent turn. */
export interface AgentTurnHandlers {
  onText(delta: string): void;
  onReasoning?(delta: string): void;
  onToolCall(toolName: string): void;
  onToolResult(event: Extract<AgentEvent, { type: "tool-result" }>): void;
  onError(message: string): void;
}

/** Pumps one user turn through the session, dispatching renderer callbacks. */
export async function runAgentTurn(
  session: AgentSession,
  input: string,
  handlers: AgentTurnHandlers,
): Promise<void> {
  for await (const event of session.stream(input)) {
    switch (event.type) {
      case "text-delta":
        handlers.onText(event.text);
        break;
      case "reasoning-delta":
        handlers.onReasoning?.(event.text);
        break;
      case "tool-call":
        handlers.onToolCall(event.toolName);
        break;
      case "tool-result":
        handlers.onToolResult(event);
        break;
      case "error":
        handlers.onError(event.message);
        break;
      default:
        break;
    }
  }
}
