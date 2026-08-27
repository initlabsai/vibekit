# TUI plugins

Status: idea, 2026-08-22. Not before 1.0.

## What "plugin" should mean

Two layers, shipped separately:

1. **Tools** (1.0.x, ~a day). `ToolPlugin` is already the unit — `nfdPlugin()`
   and `alpha-arcade` are plugins, and the explorer agent composes them into
   its deployment today. Missing piece is a loader: a config key
   (`plugins: ["@someone/vibekit-plugin-x", "./my-plugin.ts"]`), a dynamic
   import, tools land in the agent. Results render as raw JSON cards.
   Trust model is "your node_modules". The direct lane (paste an id) need not
   know them; the agent does.

2. **Cards** (1.1, 2–4 days). Trusted views are a closed list on purpose
   (protocol ids, record builders, React components in `cards/`). Open it with
   **cards as data**, not components.

## Cards as data — the decision

A plugin tool returns its result plus a `card` description, and the TUI renders
it with the primitives every first-party card already uses
(`Frame`/`Header`/`Fact`/`Ident`/`Button` in `apps/tui/src/ui.tsx`):

```ts
card: {
  kicker: 'MARKET',
  chip?: 'prediction',
  pill: 'OPEN', tone?: 'ok' | 'warn' | 'bad' | 'idle',
  hero?: { value: '0.62', unit: 'YES', copy?: string },
  facts: [{ label: 'volume', value: '12,400 ALGO' }, { label: 'id', value: '…', copy: '…' }],
  rows?: [{ cells: string[], open?: OpenTarget }],
  actions?: [{ label: 'transactions ▸', open: OpenTarget }],
  footer?: 'closes in 3d',
}
```

Plugins describe; the Explorer draws. Properties this buys, by construction:

- no React/OpenTUI in plugins — no duplicate-React hook breakage, no version
  coupling, no bundling story;
- the design language is enforced: a plugin cannot paint a pink border, break
  copy-on-click, or invent a layout;
- it is *tool* output (built by the handler from its own data), never model
  output — "every card is real chain data" still holds;
- `copy` and `open` keep ids copyable and drill-ins uniform.

Why not shadcn-style exported components: the direction of control is wrong for
a terminal. With components the plugin owns rendering and the host hopes it
matches; with data the host owns rendering and the plugin cannot not match.

What the DSL cannot do: bespoke layouts (transaction graph, ASCII amount hero).
Those stay first-party. Plugins need "my entity as a card with copyable ids and
an action or two"; facts + rows + a button is that.

## Named consumers (abstraction-budget rule)

- The NFD card (`apps/tui/src/cards/nfd.tsx`, hand-built 2026-08-22) is exactly
  a card description — reference implementation #1.
- alpha-arcade markets render as raw JSON in the TUI today — #2.

## Do not build

Pages, keybindings, commands, composer hooks. That is where "plugin" becomes
"framework" and we maintain other people's UX. Tools + cards is "add
functionality"; the composer is the UI.

## Open questions

- Plugin-declared `view` ids: namespace them (`plugin:<name>.<view>`) so the
  trusted-view list stays closed for first-party ids.
- Loader location: `~/.config/vibekit/config.json` vs per-project; probably
  both, project wins.
- Whether a plugin may add to the direct lane's classifier (e.g. recognise a
  market id pasted into the composer). Lean no for v1.
