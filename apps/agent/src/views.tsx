/** The empty feed: the companion says hello, as one of her own messages. */
import { CompanionFace } from './features/profile/companion'

const EXAMPLES = ['what is asset 31566704?', 'who is algorand.algo?', '/status', '/pay 0.5 to <address>']

export function Welcome({ onSubmit }: { onSubmit: (raw: string) => void }) {
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
