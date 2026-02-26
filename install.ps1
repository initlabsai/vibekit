#
# VibeKit Installation Script for Windows
#
# Downloads the latest VibeKit binary for Windows and installs it to ~/.vibekit/bin
#
# Usage:
#   irm https://getvibekit.ai/install.ps1 | iex
#
# Or with a specific version:
#   $env:VIBEKIT_VERSION = "cli-v0.1.0"; irm https://getvibekit.ai/install.ps1 | iex
#
# Or install alpha/beta releases:
#   $env:VIBEKIT_CHANNEL = "alpha"; irm https://getvibekit.ai/install.ps1 | iex
#
# Environment variables:
#   VIBEKIT_VERSION       - Install a specific version (default: latest)
#   VIBEKIT_CHANNEL       - Release channel: stable (default), alpha, or beta
#   VIBEKIT_INSTALL_DIR   - Custom install directory (default: ~/.vibekit/bin)
#   VIBEKIT_FORCE_INSTALL - Skip confirmation prompts if set
#

$ErrorActionPreference = "Stop"

# GitHub repository
$Repo = "gabrielkuettel/vibekit"

# Installation directory
$InstallDir = if ($env:VIBEKIT_INSTALL_DIR) { $env:VIBEKIT_INSTALL_DIR } else { Join-Path $HOME ".vibekit\bin" }

function Write-Info($msg) { Write-Host $msg -ForegroundColor DarkGray }
function Write-Success($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "WARN: $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; throw $msg }

# Fetch latest pre-release tag matching channel pattern
function Get-LatestPrerelease($Channel) {
    Write-Info "Fetching latest $Channel release..."
    $ApiUrl = "https://api.github.com/repos/$Repo/releases"

    try {
        $Releases = Invoke-RestMethod -Uri $ApiUrl -Headers @{ "User-Agent" = "VibeKit-Installer" }
    } catch {
        Write-Err "Failed to fetch releases from GitHub API: $_"
    }

    $Match = $Releases | Where-Object { $_.tag_name -match "^cli-v.*-${Channel}\.\d+$" } | Select-Object -First 1

    if (-not $Match) {
        Write-Err "No $Channel release found. See: https://github.com/$Repo/releases"
    }

    Write-Success "Found: $($Match.tag_name)"
    return @{
        Version = $Match.tag_name
        Url     = "https://github.com/$Repo/releases/download/$($Match.tag_name)"
    }
}

# Determine release URL based on version or channel
function Get-ReleaseInfo {
    if ($env:VIBEKIT_VERSION) {
        return @{
            Version = $env:VIBEKIT_VERSION
            Channel = "specific"
            Url     = "https://github.com/$Repo/releases/download/$($env:VIBEKIT_VERSION)"
        }
    }

    $Channel = if ($env:VIBEKIT_CHANNEL) { $env:VIBEKIT_CHANNEL } else { "stable" }

    switch ($Channel) {
        "stable" {
            return @{
                Version = "latest"
                Channel = "stable"
                Url     = "https://github.com/$Repo/releases/latest/download"
            }
        }
        { $_ -in "alpha", "beta" } {
            $Info = Get-LatestPrerelease $Channel
            return @{
                Version = $Info.Version
                Channel = $Channel
                Url     = $Info.Url
            }
        }
        default {
            Write-Err "Unknown channel: $Channel. Use 'stable', 'alpha', or 'beta'."
        }
    }
}

# Ensure install directory exists
function Ensure-InstallDir {
    if (-not (Test-Path $InstallDir)) {
        Write-Info "Creating install directory: $InstallDir"
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
}

# Check for existing installation. Returns $false if user chose to keep existing.
function Check-Existing {
    $InstallPath = Join-Path $InstallDir "vibekit.exe"

    if (Test-Path $InstallPath) {
        Write-Warn "VibeKit is already installed at $InstallPath"

        if ($env:VIBEKIT_FORCE_INSTALL) {
            Write-Info "VIBEKIT_FORCE_INSTALL is set, replacing existing installation..."
            Remove-Item $InstallPath -Force
            return $true
        }

        $Response = Read-Host "Do you want to replace it? (y/N)"
        if ($Response -match "^[Yy]") {
            Remove-Item $InstallPath -Force
        } else {
            Write-Info "Keeping existing installation."
            return $false
        }
    }
    return $true
}

# Add install directory to user PATH if not already present
function Ensure-Path {
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($UserPath -split ";" | Where-Object { $_ -eq $InstallDir }) {
        return $true
    }

    Write-Host ""
    Write-Warn "$InstallDir is not in your PATH"
    Write-Host ""

    $NewPath = "$UserPath;$InstallDir"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = "$env:Path;$InstallDir"

    Write-Success "Added $InstallDir to your user PATH."
    Write-Info "Restart your terminal for the PATH change to take effect."
    Write-Host ""
    return $false
}

# Download vibekit
function Download-Vibekit($ReleaseUrl) {
    $Target = "vibekit-win32-x64.exe"
    $Url = "$ReleaseUrl/$Target"
    $InstallPath = Join-Path $InstallDir "vibekit.exe"

    Write-Host "Downloading: " -NoNewline; Write-Host $Target -ForegroundColor White
    Write-Host "From:        " -NoNewline; Write-Host $Url -ForegroundColor DarkGray
    Write-Host "To:          " -NoNewline; Write-Host $InstallPath -ForegroundColor DarkGray
    Write-Host ""

    try {
        Invoke-WebRequest -Uri $Url -OutFile $InstallPath -UseBasicParsing
    } catch {
        Write-Err "Failed to download $Target from $Url`n$_"
    }
}

# Main
function Main {
    Write-Host ""
    Write-Host "VibeKit Installer" -ForegroundColor White
    Write-Host ""

    $Release = Get-ReleaseInfo

    Ensure-InstallDir
    if (-not (Check-Existing)) { return }
    Download-Vibekit $Release.Url

    Write-Host ""
    if ($Release.Channel -eq "specific") {
        Write-Success "Installed: vibekit $($Release.Version) (win32-x64)"
    } elseif ($Release.Channel -eq "stable") {
        Write-Success "Installed: vibekit (win32-x64)"
    } else {
        Write-Success "Installed: vibekit $($Release.Version) (win32-x64) [$($Release.Channel)]"
    }
    Write-Info "Location: $(Join-Path $InstallDir 'vibekit.exe')"
    Write-Host ""

    Ensure-Path | Out-Null

    Write-Info "To get started, run:"
    Write-Host ""
    Write-Host "  vibekit init"
    Write-Host ""
}

Main
