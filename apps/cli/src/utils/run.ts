/** Subprocess helpers: captured output for checks, streamed output for things the user watches. */

export interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** Runs a command and captures its output. Throws when the binary cannot be spawned. */
export async function run(cmd: string[], cwd?: string): Promise<RunResult> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { exitCode, stdout, stderr }
}

/** Runs a command with the terminal as its stdio (logs to follow, a CLI to pass through). */
export async function runInteractive(cmd: string[], cwd?: string): Promise<number> {
  const proc = Bun.spawn(cmd, { cwd, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
  return proc.exited
}
