'use client'

/** `/wallet`: connect, pick the active account, open it. */
import { useExplorer } from '../../explorer'
import { WalletScreen } from './screen'

export function WalletRoute() {
  const { wallet, network, openTarget, submit, setStatus } = useExplorer()
  return (
    <WalletScreen
      lane={wallet}
      network={network}
      onOpenAccount={(address) => openTarget({ kind: 'account', address })}
      onListAccounts={() => submit('list my accounts')}
      onError={setStatus}
    />
  )
}
