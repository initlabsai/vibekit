import { Button } from '../../primitives.js'
import { COLORS, shorten } from '../../theme.js'

/** Enable/disable the session's tool plugins; persisted to ~/.config/vibekit. */
export function PluginsScreen({
  plugins,
  width,
  onToggle,
  keys,
}: {
  plugins: ReadonlyArray<{ name: string; description?: string; enabled: boolean }>
  width: number
  onToggle: (name: string) => void
  /** Key hints for this screen, drawn in the bottom frame line. */
  keys: string
}) {
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle="heavy"
      borderColor={COLORS.brass}
      title=" PLUGINS "
      titleColor={COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      <text
        fg={COLORS.muted}
        content="Extra tools the agent can call. Changes save to ~/.config/vibekit and apply on the agent's next message."
      />
      {plugins.map((plugin, index) => (
        <box key={plugin.name} flexDirection="column" marginTop={1} paddingX={1}>
          <box flexDirection="row" justifyContent="space-between" height={1}>
            <text fg={plugin.enabled ? COLORS.brassBright : COLORS.faint}>
              {`[${index + 1}] ${plugin.name}`}
            </text>
            <Button
              label={plugin.enabled ? 'enabled' : 'disabled'}
              active={plugin.enabled}
              onPress={() => onToggle(plugin.name)}
            />
          </box>
          {plugin.description ? <text fg={COLORS.muted}>{`    ${plugin.description}`}</text> : null}
        </box>
      ))}
    </box>
  )
}
