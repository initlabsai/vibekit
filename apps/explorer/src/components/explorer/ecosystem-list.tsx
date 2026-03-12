'use client'

import { useState, useMemo } from 'react'
import { Globe } from 'lucide-react'
import { TableFilter } from './table-filter'
import { SortableHeader } from './sortable-header'
import { useTableSort } from './use-table-sort'
import { ECOSYSTEM_CATEGORIES, type EcosystemCategory } from '@vibekit/ecosystem'

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

interface EcosystemListProps {
  data: Record<string, unknown>
}

export function EcosystemList({ data }: EcosystemListProps) {
  const projects = (data.projects ?? []) as EcosystemProject[]
  const category = data.category as string | undefined
  const query = data.query as string | undefined
  const [filter, setFilter] = useState('')
  const { sort, onSort, sortData } = useTableSort<EcosystemProject>()

  const filtered = useMemo(() => {
    if (!filter) return projects
    const q = filter.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    )
  }, [projects, filter])

  const sorted = useMemo(
    () =>
      sortData(filtered, {
        name: (a, b) => a.name.localeCompare(b.name),
        category: (a, b) => a.category.localeCompare(b.category),
      }),
    [filtered, sortData]
  )

  const title = category
    ? ECOSYSTEM_CATEGORIES[category as EcosystemCategory] ?? 'Ecosystem'
    : query
      ? `Ecosystem: "${query}"`
      : 'Ecosystem'

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-algo-border">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-algo-teal" />
          <h3 className="text-sm font-semibold text-algo-teal">
            {title} ({filtered.length})
          </h3>
        </div>
        <TableFilter value={filter} onChange={setFilter} placeholder="Filter projects..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-algo-muted border-b border-algo-border">
              <SortableHeader label="Name" sortKey="name" currentSort={sort} onSort={onSort} />
              <SortableHeader label="Category" sortKey="category" currentSort={sort} onSort={onSort} />
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-left px-4 py-2 font-medium">Links</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((project) => (
              <tr key={project.id} className="border-b border-algo-border/50 hover:bg-algo-dark/50">
                <td className="px-4 py-2 font-medium text-algo-teal whitespace-nowrap">{project.name}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className="px-1.5 py-0.5 rounded-full bg-algo-dark text-algo-muted text-[11px]">
                    {ECOSYSTEM_CATEGORIES[project.category] ?? project.category}
                  </span>
                </td>
                <td className="px-4 py-2 text-algo-muted max-w-xs truncate">{project.description}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {project.website && (
                      <a href={project.website} target="_blank" rel="noopener noreferrer" className="text-algo-teal hover:underline">
                        Website
                      </a>
                    )}
                    {project.github && (
                      <a href={project.github} target="_blank" rel="noopener noreferrer" className="text-algo-muted hover:text-algo-teal">
                        GitHub
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
