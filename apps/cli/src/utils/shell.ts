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
    // On Windows, Bun.spawn can't execute App Execution Aliases (MSIX stubs)
    // directly, so route all commands through cmd.exe
    const spawnArgs =
      process.platform === 'win32' ? ['cmd.exe', '/c', cmd, ...args] : [cmd, ...args]

    const proc = Bun.spawn(spawnArgs, {
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
  const whichCmd = process.platform === 'win32' ? 'where' : 'which'
  const result = await runCommand(whichCmd, [cmd], { silent: true })
  return result.success
}

export async function getCommandOutput(cmd: string, args: string[] = []): Promise<string | null> {
  const result = await runCommand(cmd, args, { silent: true })
  return result.success ? result.stdout : null
}
