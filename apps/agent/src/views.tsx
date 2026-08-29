/** The empty feed: the companion says hello, as one of her own messages. */
import { CompanionFace } from './features/profile/companion'

/** USDC where it lives; localnet has no well-known asset, so it gets the block tail instead. */
const USDC: Record<string, string | undefined> = { mainnet: '31566704', testnet: '10458941' }

/** Intro chips: mainnet can name ecosystem reads; other nets only things that resolve there. */
export function welcomeExamples(network: string): string[] {
  if (network === 'mainnet') {
    return [
      "get algorand's price chart",
      'who is vibekit.algo?',
      'quote 10 ALGO to USDC',
      'what prediction markets are live?',
    ]
  }
  const usdc = USDC[network]
  if (usdc) return [`what is asset ${usdc}?`, '/blocks', '/status']
  return ['/blocks', '/status']
}

export function Welcome({ onSubmit, network }: { onSubmit: (raw: string) => void; network: string }) {
  const EXAMPLES = welcomeExamples(network)
  return (
    <div className="note-agent intro">
      <CompanionFace mood="calm" seed={0} />
      <div className="note-agent-body">
        <p className="note-agent-text">
          hi. i'm <em>qt314</em>. i read algorand for you. i'm the helpfulest, but plz be specific. i'm in alpha i guess.
        </p>
        <p className="intro-examples">
          try{' '}
          {EXAMPLES.map((example, i) => (
            <span key={example}>
              {i > 0 ? ' · ' : ''}
              <button type="button" className="send" onClick={() => onSubmit(example)}>{example}</button>
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}
