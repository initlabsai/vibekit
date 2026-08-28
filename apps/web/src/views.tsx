/** The welcome card an empty feed shows: the website's hero, with examples that run when clicked. */
import { Button, Frame, Header } from './primitives'

const EXAMPLES = ['asset 31566704', 'app 1002541853', 'blocks', 'algorand.algo', 'pay 0.5 to <address>']

export function Welcome({ onSubmit }: { onSubmit: (raw: string) => void }) {
  return (
    <Frame className="welcome">
      <Header kicker="EXPLORER" chip="direct lane · no AI required" />
      <p className="hero">
        <span className="hero-value">
          <span>Explore </span>
          <em>Algorand</em>
          <span>.</span>
        </span>
      </p>
      <p className="welcome-sub">paste an id · name an asset, app, or block · pay from a connected wallet</p>
      <p className="welcome-lede">
        Every card is a tool result you can trust; every write walks draft → simulate → inspect →
        approve → sign → confirm, and your wallet holds the keys.
      </p>
      <div className="examples">
        {EXAMPLES.map((example) => (
          <Button key={example} label={example} onPress={() => onSubmit(example)} />
        ))}
      </div>
    </Frame>
  )
}
