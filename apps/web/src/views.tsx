/** The welcome card an empty feed shows. */
import { Button, Frame, Header, Hero } from './primitives'

export function Welcome({ onOpenSample }: { onOpenSample: () => void }) {
  return (
    <Frame>
      <Header kicker="EXPLORER" />
      <Hero value="Explore Algorand" />
      <p className="muted">
        Paste a transaction id or an address, or type <code>pay 0.5</code> to walk a payment
        from draft to approval.
      </p>
      <div className="actions">
        <Button label="open the sample transaction" onPress={onOpenSample} />
      </div>
    </Frame>
  )
}
