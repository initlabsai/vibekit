/** The empty feed: the companion introduces herself, and how to be good to her. */
import { CompanionFace } from './features/profile/companion'
import { Button, Frame, Header } from './primitives'

const EXAMPLES = ['what is asset 31566704?', 'show me app 1002541853', 'who is algorand.algo?', 'blocks', 'pay 0.5 to <address>']

export function Welcome({ onSubmit, agent }: { onSubmit: (raw: string) => void; agent: { enabled: boolean; model?: string } }) {
  return (
    <Frame className="welcome">
      <Header kicker="EXPLORER" chip={agent.enabled ? `${agent.model} · early alpha` : 'no agent configured'} />
      <div className="intro-face">
        <CompanionFace mood="calm" seed={0} />
      </div>
      <p className="hero">
        <span className="hero-value">
          <span>Hi. I read </span>
          <em>Algorand</em>
          <span> for you.</span>
        </span>
      </p>
      <p className="welcome-sub">ask in plain words · paste an id · say `pay 0.5 to &lt;address&gt;` and your wallet signs</p>
      <ul className="intro-list">
        <li>Every card is a real tool result; I only say what they say. If a fact isn't on a card, I don't have it.</li>
        <li>I'm early alpha. Be explicit — an id, a name, a round — and I'll be quick and right. Vague asks get vague answers.</li>
        <li>I never sign. A write goes draft → simulate → inspect → approve → sign → confirm, and you hold the keys.</li>
        <li>Be nice. I dance when I'm working <code>{"(>'-')>"}</code> and squint when something's wrong <code>(¬_¬)</code>.</li>
      </ul>
      <div className="examples">
        {EXAMPLES.map((example) => (
          <Button key={example} label={example} onPress={() => onSubmit(example)} />
        ))}
      </div>
    </Frame>
  )
}
