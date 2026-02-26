export interface CommandResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
}

export async function runCommand(
  cmd: string,
  args: string[] = [],
  options: { silent?: boolean; cwd?: string } = {}
): Promise<CommandResult> {
  try {
    const proc = Bun.spawn([cmd, ...args], {
      stdin: 'inherit',
      stdout: options.silent ? 'pipe' : 'inherit',
      stderr: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd,
    })

    const exitCode = await proc.exited

    let stdout = ''
    let stderr = ''

    if (options.silent) {
      stdout = proc.stdout ? await new Response(proc.stdout).text() : ''
      stderr = proc.stderr ? await new Response(proc.stderr).text() : ''
    }

    return {
      success: exitCode === 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
    }
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    }
  }
}

export async function commandExists(cmd: string): Promise<boolean> {
  if (process.platform === 'win32') {
    // `where` doesn't resolve Windows App Execution Aliases (e.g. winget/MSIX installs),
    // so fall back to running the command directly if `where` fails
    const whereResult = await runCommand('where', [cmd], { silent: true })
    if (whereResult.success) return true
    const result = await runCommand(cmd, ['--version'], { silent: true })
    return result.success
  }
  const result = await runCommand('which', [cmd], { silent: true })
  return result.success
}

export async function getCommandOutput(cmd: string, args: string[] = []): Promise<string | null> {
  const result = await runCommand(cmd, args, { silent: true })
  return result.success ? result.stdout : null
}
