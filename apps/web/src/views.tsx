/** The screens that are not cards: the welcome and the accounts landing. */
import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero } from './primitives'

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

export function AccountsLanding({
  accounts,
  note,
  onOpen,
}: {
  accounts: ReadonlyArray<{ address: string; name?: string }>
  note: string
  onOpen: (address: string) => void
}) {
  return (
    <Frame>
      <Header kicker="ACCOUNTS" />
      <Facts>
        {accounts.map((account) => (
          <Fact key={account.address} label={account.name ?? 'account'}>
            <Copyable value={account.address} width={24} />{' '}
            <Button label="open" onPress={() => onOpen(account.address)} />
          </Fact>
        ))}
      </Facts>
      <FooterNote text={note} />
    </Frame>
  )
}
