import { ShieldCheck, ShieldAlert } from 'lucide-react'

type Tier = 'verified' | 'trusted' | 'suspicious' | 'unverified'

export function VerificationBadge({ tier }: { tier: Tier }) {
  switch (tier) {
    case 'verified':
      return <ShieldCheck className="w-4 h-4 text-green-400" />
    case 'trusted':
      return <ShieldCheck className="w-4 h-4 text-blue-400" />
    case 'suspicious':
      return <ShieldAlert className="w-4 h-4 text-red-400" />
    default:
      return null
  }
}
