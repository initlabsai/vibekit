/** The empty feed: the companion introduces herself. Room to breathe; the chips say the rest. */
import { CompanionFace } from './features/profile/companion'
import { Button, Frame } from './primitives'

const EXAMPLES = ['what is asset 31566704?', 'who is algorand.algo?', 'blocks', 'pay 0.5 to <address>']

export function Welcome({ onSubmit, agent }: { onSubmit: (raw: string) => void; agent: { enabled: boolean; model?: string } }) {
  return (
    <Frame className="welcome intro">
      <div className="intro-face">
        <CompanionFace mood="calm" seed={0} />
      </div>
      <p className="hero intro-hero">
        <span className="hero-value">
          <span>Hi. I read </span>
          <em>Algorand</em>
          <span> for you.</span>
        </span>
      </p>
      <p className="intro-lede">
        Ask in plain words, or paste an id. Every card is a real tool result and I only say what it says.
        I'm early alpha — be explicit, be kind, and I never sign; your wallet does.
      </p>
      <div className="examples intro-examples">
        {EXAMPLES.map((example) => (
          <Button key={example} label={example} onPress={() => onSubmit(example)} />
        ))}
      </div>
      <ul className="intro-moods" aria-label="her moods">
        {(
          [
            ['thinking', 'thinking'],
            ['working', 'on it'],
            ['calm', 'all good'],
            ['bright', 'confirmed'],
            ['squint', "something's wrong"],
          ] as const
        ).map(([mood, label]) => (
          <li key={mood}>
            <CompanionFace mood={mood} seed={0} />
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <p className="intro-foot">{agent.enabled ? `${agent.model} · early alpha` : 'no agent configured · the direct lane still works'}</p>
    </Frame>
  )
}
