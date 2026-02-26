#!/bin/sh
#
# VibeKit Installation Script
#
# Downloads the latest VibeKit binary for your platform and installs it to ~/.local/bin
#
# Usage:
#   curl -fsSL https://getvibekit.ai/install | sh
#
# Or with a specific version:
#   curl -fsSL https://getvibekit.ai/install | VIBEKIT_VERSION=cli-v0.1.0 sh
#
# Or install alpha/beta releases:
#   curl -fsSL https://getvibekit.ai/install | VIBEKIT_CHANNEL=alpha sh
#
# Environment variables:
#   VIBEKIT_VERSION       - Install a specific version (default: latest)
#   VIBEKIT_CHANNEL       - Release channel: stable (default), alpha, or beta
#   VIBEKIT_INSTALL_DIR   - Custom install directory (default: ~/.local/bin)
#   VIBEKIT_FORCE_INSTALL - Skip confirmation prompts if set
#

set -eu

# GitHub repository
REPO="gabrielkuettel/vibekit"

# Track the resolved version for display
RESOLVED_VERSION=""
RESOLVED_CHANNEL=""
RELEASE_URL=""

# Installation directory (XDG standard for user binaries)
INSTALL_DIR="${VIBEKIT_INSTALL_DIR:-$HOME/.local/bin}"

# Colors
Red=''
Green=''
Yellow=''
Blue=''
Dim=''
Bold=''
Reset=''

if [ -t 1 ]; then
  Reset='\033[0m'
  Red='\033[0;31m'
  Green='\033[0;32m'
  Yellow='\033[0;33m'
  Blue='\033[0;34m'
  Dim='\033[0;2m'
  Bold='\033[1m'
fi

info() {
  printf '%b\n' "${Dim}$*${Reset}"
}

success() {
  printf '%b\n' "${Green}$*${Reset}"
}

warn() {
  printf '%b\n' "${Yellow}WARN${Reset}: $*"
}

error() {
  printf '%b\n' "${Red}ERROR${Reset}: $*" >&2
  exit 1
}

# Fetch latest pre-release tag matching channel pattern
# Sets RESOLVED_VERSION and RELEASE_URL globals
fetch_latest_prerelease() {
  channel="$1"
  api_url="https://api.github.com/repos/$REPO/releases"
  info "Fetching latest $channel release..."

  if command -v curl >/dev/null 2>&1; then
    response=$(curl -fsSL "$api_url" 2>/dev/null) || error "Failed to fetch releases from GitHub API"
  elif command -v wget >/dev/null 2>&1; then
    response=$(wget -qO- "$api_url" 2>/dev/null) || error "Failed to fetch releases from GitHub API"
  else
    error "Neither curl nor wget found. Please install one and try again."
  fi

  # Find first tag matching channel pattern (e.g., cli-v0.2.0-alpha.1)
  tag=$(printf '%s' "$response" | grep -o "\"tag_name\": *\"cli-v[^\"]*-${channel}\\.[^\"]*\"" | head -1 | sed 's/.*"cli-v/cli-v/' | sed 's/".*//')

  if [ -z "$tag" ]; then
    error "No $channel release found. See: https://github.com/$REPO/releases"
  fi

  printf '%b\n' "${Green}Found:${Reset} $tag"
  RESOLVED_VERSION="$tag"
  RELEASE_URL="https://github.com/$REPO/releases/download/$tag"
}

# Determine release URL based on version or channel
# Sets RELEASE_URL, RESOLVED_VERSION, and RESOLVED_CHANNEL globals
determine_release_url() {
  if [ -n "${VIBEKIT_VERSION:-}" ]; then
    RESOLVED_VERSION="$VIBEKIT_VERSION"
    RESOLVED_CHANNEL="specific"
    RELEASE_URL="https://github.com/$REPO/releases/download/$VIBEKIT_VERSION"
    return
  fi

  channel="${VIBEKIT_CHANNEL:-stable}"
  RESOLVED_CHANNEL="$channel"

  case "$channel" in
    stable)
      RESOLVED_VERSION="latest"
      RELEASE_URL="https://github.com/$REPO/releases/latest/download"
      ;;
    alpha|beta)
      fetch_latest_prerelease "$channel"
      ;;
    *)
      error "Unknown channel: $channel. Use 'stable', 'alpha', or 'beta'."
      ;;
  esac
}

# Detect platform
detect_platform() {
  os=$(uname -s)
  arch=$(uname -m)

  # On macOS, detect ARM hardware even when running under Rosetta
  if [ "$os" = "Darwin" ] && [ "$arch" = "x86_64" ]; then
    if sysctl -n hw.optional.arm64 2>/dev/null | grep -q '1'; then
      arch="arm64"
    fi
  fi

  case "$os" in
    Darwin)
      case "$arch" in
        arm64)   echo "darwin-arm64" ;;
        x86_64)  echo "darwin-x64" ;;
        *)       error "Unsupported macOS architecture: $arch" ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64)  echo "linux-x64" ;;
        *)       error "Only x64 is supported on Linux. Detected: $arch" ;;
      esac
      ;;
    MINGW*|MSYS*|CYGWIN*)
      error "Use the PowerShell installer on Windows: irm https://getvibekit.ai/install.ps1 | iex"
      ;;
    *)
      error "Unsupported operating system: $os"
      ;;
  esac
}

# Ensure install directory exists
ensure_install_dir() {
  if [ ! -d "$INSTALL_DIR" ]; then
    info "Creating install directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
  fi
}

# Check for existing installation
check_existing() {
  install_path="$INSTALL_DIR/vibekit"

  if [ -f "$install_path" ]; then
    warn "VibeKit is already installed at $install_path"

    if [ -n "${VIBEKIT_FORCE_INSTALL:-}" ]; then
      info "VIBEKIT_FORCE_INSTALL is set, replacing existing installation..."
      rm "$install_path"
      return 0
    fi

    printf '%s' "Do you want to replace it? (y/N) "
    read -r response < /dev/tty

    case "$response" in
      [Yy]|[Yy][Ee][Ss])
        rm "$install_path"
        ;;
      *)
        info "Keeping existing installation."
        exit 0
        ;;
    esac
  fi
}

# Check if install directory is in PATH
check_path() {
  case ":$PATH:" in
    *":$INSTALL_DIR:"*)
      return 0
      ;;
  esac

  echo ""
  warn "$INSTALL_DIR is not in your PATH"
  echo ""
  info "Add it to your shell configuration:"
  echo ""

  # Detect shell and show appropriate instructions
  shell_name=$(basename "${SHELL:-bash}")

  case "$shell_name" in
    zsh)
      echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
      echo "  source ~/.zshrc"
      ;;
    bash)
      echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
      echo "  source ~/.bashrc"
      ;;
    fish)
      echo "  fish_add_path ~/.local/bin"
      ;;
    *)
      echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
      echo ""
      info "Add the above line to your shell's config file."
      ;;
  esac
  echo ""
  return 1
}

# Download vibekit
download() {
  platform="$1"
  target="vibekit-$platform"
  url="$RELEASE_URL/$target"
  install_path="$INSTALL_DIR/vibekit"

  printf '%b\n' "${Dim}Downloading:${Reset} ${Bold}$target${Reset}"
  printf '%b\n' "${Dim}From:${Reset} $url"
  printf '%b\n' "${Dim}To:${Reset} $install_path"
  echo ""

  error_msg="Failed to download $target from $url"

  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --progress-bar --output "$install_path" "$url" || error "$error_msg"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$install_path" --show-progress "$url" || error "$error_msg"
  else
    error "Neither curl nor wget found. Please install one and try again."
  fi

  chmod +x "$install_path"
}

# Main
main() {
  echo ""
  printf '%b\n' "${Bold}VibeKit Installer${Reset}"
  echo ""

  # Determine release URL (sets RELEASE_URL, RESOLVED_VERSION, RESOLVED_CHANNEL)
  determine_release_url

  ensure_install_dir
  check_existing

  platform=$(detect_platform)

  download "$platform"

  echo ""
  if [ "$RESOLVED_CHANNEL" = "specific" ]; then
    success "Installed: vibekit $RESOLVED_VERSION ($platform)"
  elif [ "$RESOLVED_CHANNEL" = "stable" ]; then
    success "Installed: vibekit ($platform)"
  else
    success "Installed: vibekit $RESOLVED_VERSION ($platform) [$RESOLVED_CHANNEL]"
  fi
  printf '%b\n' "${Dim}Location:${Reset} $INSTALL_DIR/vibekit"
  echo ""

  # Check PATH and show instructions if needed
  check_path || true

  info "To get started, run:"
  echo ""
  echo "  vibekit init"
  echo ""
}

main
