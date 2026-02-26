import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (process.platform === 'darwin') {
      await execAsync(`echo -n ${JSON.stringify(text)} | pbcopy`)
    } else if (process.platform === 'win32') {
      await execAsync(`powershell -NoProfile -Command "Set-Clipboard -Value ${JSON.stringify(text)}"`)
    } else {
      // Linux - try Wayland first (wl-copy), then X11 tools (xclip, xsel)
      const commands = [
        `echo -n ${JSON.stringify(text)} | wl-copy`,
        `echo -n ${JSON.stringify(text)} | xclip -selection clipboard`,
        `echo -n ${JSON.stringify(text)} | xsel --clipboard --input`,
      ]

      for (const cmd of commands) {
        try {
          await execAsync(cmd)
          return true
        } catch {
          continue
        }
      }
      return false
    }
    return true
  } catch {
    return false
  }
}
