import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const components: Components = {
  strong: ({ children }) => (
    <strong className="font-semibold text-algo-text">{children}</strong>
  ),
  code: ({ children, className }) => {
    // Fenced code blocks get a language className from remark
    if (className) {
      return <code className={className}>{children}</code>
    }
    return (
      <code className="rounded bg-algo-dark px-1.5 py-0.5 font-mono text-[0.85em] text-algo-teal-light">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-md bg-algo-dark p-3 text-xs">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-algo-teal underline"
    >
      {children}
    </a>
  ),
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-inside list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-inside list-decimal space-y-1">{children}</ol>
  ),
}

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
