---
title: Installation
description: Install the VibeKit CLI and Explorer, or run them from a source checkout.
draft: false
banner:
  content: '<strong>VibeKit is in alpha.</strong> The packages are unstable and not ready to build on — APIs will break without notice.'
---

The installer downloads two binaries: the `vibekit` CLI and the `vibekit-tui`
Explorer sidecar. The Explorer is not optional — `vibekit explore` resolves the
sidecar as a sibling of the CLI binary, so both land in the same directory.

There is no stable release yet, so every install below sets the `alpha`
channel. Once 1.0.0 ships you can drop it.

## macOS and Linux

```bash
curl -fsSL https://getvibekit.ai/alpha | sh
```

`/alpha` is the same script as `/install` with the channel pre-set, so the
one-liner stays short. The explicit form is equivalent:

```bash
curl -fsSL https://getvibekit.ai/install | VIBEKIT_CHANNEL=alpha sh
```

Installs to `~/.local/bin`. If that is not on your `PATH`, the installer prints
the line to add for your shell.

## Windows

```powershell
irm https://getvibekit.ai/alpha.ps1 | iex
```

`/alpha.ps1` is `/install.ps1` with the channel pre-set. The explicit form is
equivalent:

```powershell
$env:VIBEKIT_CHANNEL = "alpha"; irm https://getvibekit.ai/install.ps1 | iex
```

Installs to `~\.vibekit\bin` and adds that directory to your user `PATH`
automatically. Restart your terminal for the change to take effect.

:::caution
Windows binaries are built by CI but not yet verified by hand. If something
breaks, [open an issue](https://github.com/initlabsai/vibekit/issues).
:::

## Installer options

Both installers read the same environment variables.

| Variable | Meaning |
| --- | --- |
| `VIBEKIT_VERSION` | Install a specific tag, e.g. `v1.0.0-alpha.0` |
| `VIBEKIT_CHANNEL` | `stable` (default), `alpha`, or `beta` |
| `VIBEKIT_INSTALL_DIR` | Override the install directory |
| `VIBEKIT_FORCE_INSTALL` | Replace an existing install without prompting |

Upgrading over an existing install prompts for confirmation. When you are
piping the installer into a shell with no terminal attached — CI, a container,
a provisioning script — set `VIBEKIT_FORCE_INSTALL=1` so it does not try to
prompt.

A specific version, on either platform:

```bash
curl -fsSL https://getvibekit.ai/install | VIBEKIT_VERSION=v1.0.0-alpha.0 sh
```

```powershell
$env:VIBEKIT_VERSION = "v1.0.0-alpha.0"; irm https://getvibekit.ai/install.ps1 | iex
```

## Manual install

Download both binaries for your platform from
[GitHub Releases](https://github.com/initlabsai/vibekit/releases), put them in
the same directory on your `PATH`, and rename them to `vibekit` and
`vibekit-tui` (`.exe` on Windows). On macOS and Linux, `chmod +x` both.

## Verify

```bash
vibekit --version
vibekit doctor
```

`doctor` reports what is missing — Docker for LocalNet, the keystore daemon for
signing — without changing anything. `vibekit doctor --fix` is the opt-in
repair path.

## Requirements

- Docker Compose v2 for LocalNet
- Node.js and npm — the keystore daemon runs under Node; `vibekit keystore`
  installs the pinned `@algorandfoundation/keystore-node` for you
- A Secret Service keychain on Linux when you use the keystore
- On Windows, the
  [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)
  for OS credential store support (`winget install Microsoft.VCRedist.2015+.x64`)

## Run from a source checkout

You do not need the released binaries to work on VibeKit itself. From a clone,
with Bun 1.4 or newer:

```bash
bun install
bun run cli -- --help
```

For example, scaffold a project with:

```bash
bun run cli -- new my-algorand-app --template contracts
```

The Explorer is a separate terminal application. Start it from the repository
root:

```bash
bun run tui
```

`bun run cli -- explore` also works; set `VIBEKIT_EXPLORE` to point it at a
specific TUI entry.
