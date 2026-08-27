#
# VibeKit Installation Script for Windows
#
# Downloads the VibeKit CLI and the Explorer TUI sidecar for Windows and
# installs both to ~/.vibekit/bin. The Explorer is not optional: `vibekit
# explore` resolves the sidecar as a sibling of the CLI binary.
#
# Usage:
#   irm https://getvibekit.ai/install.ps1 | iex
#
# Or a specific version:
#   $env:VIBEKIT_VERSION = "v1.0.0-alpha.0"; irm https://getvibekit.ai/install.ps1 | iex
#
# Or a prerelease channel:
#   $env:VIBEKIT_CHANNEL = "alpha"; irm https://getvibekit.ai/install.ps1 | iex
#
# Environment variables:
#   VIBEKIT_VERSION       - Install a specific tag (default: resolve by channel)
#   VIBEKIT_CHANNEL       - stable (default), alpha, or beta
#   VIBEKIT_INSTALL_DIR   - Custom install directory (default: ~/.vibekit/bin)
#   VIBEKIT_FORCE_INSTALL - Skip confirmation prompts if set
#

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Invoke-WebRequest renders a progress bar per byte on Windows PowerShell 5.1,
# which dominates the runtime on a 100MB binary. We print our own lines.
$ProgressPreference = 'SilentlyContinue'

$Repo = 'initlabsai/vibekit'
$InstallDir = if ($env:VIBEKIT_INSTALL_DIR) { $env:VIBEKIT_INSTALL_DIR } else { Join-Path $HOME '.vibekit\bin' }

function Write-Info    ($msg) { Write-Host $msg -ForegroundColor DarkGray }
function Write-Ok      ($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Warn    ($msg) { Write-Host 'WARN' -ForegroundColor Yellow -NoNewline; Write-Host ": $msg" }
function Write-Fail    ($msg) { Write-Host 'ERROR' -ForegroundColor Red -NoNewline; Write-Host ": $msg"; exit 1 }

function Get-Releases {
    try {
        Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases" `
            -Headers @{ 'User-Agent' = 'VibeKit-Installer' }
    } catch {
        Write-Fail "Failed to fetch releases from the GitHub API: $_"
    }
}

# Newest release whose tag matches the channel. Anchoring the pattern to a
# leading `v` excludes the heritage `cli-v*` tags from the pre-1.0 repo.
function Resolve-Prerelease ($Channel) {
    Write-Info "Fetching latest $Channel release..."

    $match = Get-Releases | Where-Object { $_.tag_name -match "^v.*-$Channel\.\d+$" } | Select-Object -First 1
    if (-not $match) {
        Write-Fail "No $Channel release found. See: https://github.com/$Repo/releases"
    }

    Write-Host 'Found: ' -ForegroundColor Green -NoNewline; Write-Host $match.tag_name
    return $match.tag_name
}

# GitHub's "latest" already excludes prereleases, but the heritage cli-v*
# releases are not prereleases -- so verify the tag really is a v<semver>
# before pointing anyone at it.
function Resolve-Stable {
    Write-Info 'Resolving the latest stable release...'

    try {
        $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" `
            -Headers @{ 'User-Agent' = 'VibeKit-Installer' }
    } catch {
        Write-Fail "Failed to fetch the latest release from the GitHub API: $_"
    }

    $tag = $latest.tag_name

    if ($tag -match '^v\d.*-') {
        Write-Fail "The latest release ($tag) is a prerelease. Use `$env:VIBEKIT_CHANNEL = 'alpha'."
    }
    if ($tag -notmatch '^v\d') {
        Write-Fail @"
No stable release yet. Install a prerelease:

  `$env:VIBEKIT_CHANNEL = "alpha"; irm https://getvibekit.ai/install.ps1 | iex
"@
    }

    Write-Host 'Found: ' -ForegroundColor Green -NoNewline; Write-Host $tag
    return $tag
}

function Resolve-Release {
    if ($env:VIBEKIT_VERSION) {
        return @{ Version = $env:VIBEKIT_VERSION; Channel = 'specific' }
    }

    $channel = if ($env:VIBEKIT_CHANNEL) { $env:VIBEKIT_CHANNEL } else { 'stable' }

    switch ($channel) {
        'stable'          { return @{ Version = (Resolve-Stable);             Channel = 'stable' } }
        { $_ -in 'alpha','beta' } { return @{ Version = (Resolve-Prerelease $channel); Channel = $channel } }
        default           { Write-Fail "Unknown channel: $channel. Use 'stable', 'alpha', or 'beta'." }
    }
}

# Ask once, for both binaries. Nothing is removed here -- the install step
# overwrites in place, so a failed download never destroys a working setup.
function Confirm-Replace {
    $cli = Join-Path $InstallDir 'vibekit.exe'
    $tui = Join-Path $InstallDir 'vibekit-tui.exe'
    if (-not (Test-Path $cli) -and -not (Test-Path $tui)) { return }

    Write-Warn "VibeKit is already installed in $InstallDir"

    if ($env:VIBEKIT_FORCE_INSTALL) {
        Write-Info 'VIBEKIT_FORCE_INSTALL is set, replacing the existing installation...'
        return
    }

    # `irm | iex` leaves stdin attached to the pipeline, so Read-Host is the
    # only prompt that works here.
    $response = Read-Host 'Replace it? (y/N)'
    if ($response -notmatch '^[Yy]') {
        Write-Info 'Keeping the existing installation.'
        exit 0
    }
}

function Get-Binary ($Url, $Dest, $Name) {
    Write-Host 'Downloading: ' -ForegroundColor DarkGray -NoNewline; Write-Host $Name
    try {
        Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing -Headers @{ 'User-Agent' = 'VibeKit-Installer' }
    } catch {
        Write-Fail "Failed to download $Name from $Url`n$_"
    }
}

# Both binaries land in a temp dir first. The Explorer is mandatory, so a
# half-download must not leave a CLI that cannot open the Explorer.
function Install-Binaries ($Version) {
    $base = "https://github.com/$Repo/releases/download/$Version"
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("vibekit-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null

    try {
        Get-Binary "$base/vibekit-win32-x64.exe"     (Join-Path $tmp 'vibekit.exe')     'vibekit-win32-x64.exe'
        Get-Binary "$base/vibekit-tui-win32-x64.exe" (Join-Path $tmp 'vibekit-tui.exe') 'vibekit-tui-win32-x64.exe'

        Move-Item (Join-Path $tmp 'vibekit.exe')     (Join-Path $InstallDir 'vibekit.exe')     -Force
        Move-Item (Join-Path $tmp 'vibekit-tui.exe') (Join-Path $InstallDir 'vibekit-tui.exe') -Force
    } finally {
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Report pre-1.0 state; never touch it. Old mnemonics and private keys live
# in the OS credential store, and `vibekit doctor --fix` is the opt-in repair path.
function Show-LegacyNotice {
    $candidates = @(
        (Join-Path $env:APPDATA 'vibekit\accounts.db'),
        (Join-Path $HOME '.config\vibekit\accounts.db')
    )
    foreach ($path in $candidates) {
        if ($path -and (Test-Path $path)) {
            Write-Host ''
            Write-Warn "Found accounts from a pre-1.0 VibeKit ($path)."
            Write-Info "Nothing was changed. Run 'vibekit doctor' to review it."
            return
        }
    }
}

function Add-ToPath {
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (($userPath -split ';') -contains $InstallDir) { return }

    [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
    $env:Path = "$env:Path;$InstallDir"

    Write-Host ''
    Write-Ok "Added $InstallDir to your user PATH."
    Write-Info 'Restart your terminal for the change to take effect in new shells.'
}

Write-Host ''
Write-Host 'VibeKit Installer'
Write-Host ''

$release = Resolve-Release

if (-not (Test-Path $InstallDir)) {
    Write-Info "Creating install directory: $InstallDir"
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Confirm-Replace
Install-Binaries $release.Version

Write-Host ''
$suffix = switch ($release.Channel) {
    'specific' { '' }
    'stable'   { '' }
    default    { " [$($release.Channel)]" }
}
Write-Ok "Installed: vibekit $($release.Version) (win32-x64)$suffix"
Write-Info "Location: $(Join-Path $InstallDir 'vibekit.exe')"
Write-Info "Explorer: $(Join-Path $InstallDir 'vibekit-tui.exe')"

Show-LegacyNotice
Add-ToPath

Write-Host ''
Write-Info 'To get started, run:'
Write-Host ''
Write-Host '  vibekit new'
Write-Host '  vibekit explore'
Write-Host ''
