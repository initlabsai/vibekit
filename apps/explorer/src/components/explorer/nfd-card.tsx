import { truncateAddress } from '@/lib/formatters'
import { Globe } from 'lucide-react'

const PROPERTY_LABELS: Record<string, string> = {
  twitter: 'Twitter',
  discord: 'Discord',
  telegram: 'Telegram',
  github: 'GitHub',
  email: 'Email',
  domain: 'Domain',
  website: 'Website',
  blueskydid: 'Bluesky',
  nostrpubkey: 'Nostr',
  bio: 'Bio',
}

interface NfdCardProps {
  data: Record<string, unknown>
}

export function NfdCard({ data }: NfdCardProps) {
  const name = data.name as string | null
  const address = data.address as string
  const owner = data.owner as string | undefined
  const appId = data.appId as number | undefined
  const state = data.state as string | undefined
  const properties = data.properties as Record<string, string> | undefined
  const avatar = properties?.avatar

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">NFD</h3>
        {state ? (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400">
            {state}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3 mb-3">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="w-10 h-10 rounded-full bg-algo-dark object-cover shrink-0"
          />
        ) : null}
        <div>
          <p className="text-base font-semibold">
            {name ?? <span className="text-algo-muted">No NFD found</span>}
          </p>
          <p className="font-mono text-xs text-algo-muted break-all">{address}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        {owner && owner !== address ? (
          <Field label="Owner" value={truncateAddress(owner)} mono />
        ) : null}
        {appId != null ? <Field label="App ID" value={String(appId)} /> : null}
        {properties
          ? Object.entries(properties).map(([key, value]) => {
              if (key === 'avatar' || key === 'name') return null
              return (
                <Field
                  key={key}
                  label={PROPERTY_LABELS[key] ?? key}
                  value={value}
                />
              )
            })
          : null}
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-algo-dark rounded-md p-2">
      <div className="text-algo-muted text-[11px] mb-0.5">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono' : ''} break-all`}>{value}</div>
    </div>
  )
}
