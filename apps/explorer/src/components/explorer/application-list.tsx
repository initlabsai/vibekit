import { Code2 } from 'lucide-react'
import { ApplicationCard } from './application-card'

interface ApplicationListProps {
  data: Record<string, unknown>
}

export function ApplicationList({ data }: ApplicationListProps) {
  const applications = (data.applications ?? []) as Record<string, unknown>[]

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-algo-border">
        <Code2 className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">
          Applications ({applications.length})
        </h3>
      </div>
      <div className="divide-y divide-algo-border/50">
        {applications.map((app) => (
          <ApplicationCard key={String(app.applicationId)} data={app} />
        ))}
      </div>
    </div>
  )
}
