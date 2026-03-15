import { Globe, ExternalLink, Github } from 'lucide-react'
import { ECOSYSTEM_CATEGORIES, type EcosystemCategory } from '@vibekit/tools'
import type { ReactNode } from 'react'

interface EcosystemProject {
  id: string
  name: string
  category: EcosystemCategory
  description: string
  features: string[]
  website?: string
  docs?: string
  github?: string
  twitter?: string
}

interface EcosystemCardProps {
  data: Record<string, unknown>
}

export function EcosystemCard({ data }: EcosystemCardProps) {
  const projects = (data.projects ?? []) as EcosystemProject[]
  const project = projects[0]
  if (!project) return null

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">{project.name}</h3>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-algo-dark text-algo-muted">
          {ECOSYSTEM_CATEGORIES[project.category] ?? project.category}
        </span>
      </div>

      <p className="text-xs text-algo-muted mb-3">{project.description}</p>

      {project.features.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {project.features.map((feature) => (
            <span
              key={feature}
              className="px-2 py-0.5 rounded-full bg-algo-dark text-[11px] text-algo-muted"
            >
              {feature}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {project.website && (
          <Field
            label="Website"
            value={
              <a
                href={project.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-algo-teal hover:underline flex items-center gap-1"
              >
                {new URL(project.website).hostname} <ExternalLink className="w-3 h-3" />
              </a>
            }
          />
        )}
        {project.docs && (
          <Field
            label="Docs"
            value={
              <a
                href={project.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-algo-teal hover:underline flex items-center gap-1"
              >
                Documentation <ExternalLink className="w-3 h-3" />
              </a>
            }
          />
        )}
        {project.github && (
          <Field
            label="GitHub"
            value={
              <a
                href={project.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-algo-teal hover:underline flex items-center gap-1"
              >
                <Github className="w-3 h-3" /> Source
              </a>
            }
          />
        )}
        {project.twitter && (
          <Field
            label="Twitter/X"
            value={
              <a
                href={project.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-algo-teal hover:underline flex items-center gap-1"
              >
                {project.twitter.replace('https://x.com/', '@')}{' '}
                <ExternalLink className="w-3 h-3" />
              </a>
            }
          />
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-algo-dark rounded-md p-1.5 sm:p-2">
      <div className="text-algo-muted text-[11px] mb-0.5">{label}</div>
      <div className="text-xs sm:text-sm break-all">{value}</div>
    </div>
  )
}
