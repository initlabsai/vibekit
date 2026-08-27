#!/bin/sh
#
# VibeKit Installation Script
#
# Downloads the VibeKit CLI and the Explorer TUI sidecar for your platform
# and installs both to ~/.local/bin. The Explorer is not optional: `vibekit
# explore` resolves the sidecar as a sibling of the CLI binary.
#
# Usage:
#   curl -fsSL https://getvibekit.ai/install | sh
#
# Or a specific version:
#   curl -fsSL https://getvibekit.ai/install | VIBEKIT_VERSION=v1.0.0-alpha.0 sh
#
# Or a prerelease channel:
#   curl -fsSL https://getvibekit.ai/install | VIBEKIT_CHANNEL=alpha sh
#
# Environment variables:
#   VIBEKIT_VERSION       - Install a specific tag (default: resolve by channel)
#   VIBEKIT_CHANNEL       - stable (default), alpha, or beta
#   VIBEKIT_INSTALL_DIR   - Custom install directory (default: ~/.local/bin)
#   VIBEKIT_FORCE_INSTALL - Skip confirmation prompts if set
#

set -eu

REPO="initlabsai/vibekit"

RESOLVED_VERSION=""
RESOLVED_CHANNEL=""
RELEASE_URL=""
TMPDIR_VK=""

INSTALL_DIR="${VIBEKIT_INSTALL_DIR:-$HOME/.local/bin}"

Red=''
Green=''
Yellow=''
Dim=''
Bold=''
Reset=''

if [ -t 1 ]; then
  Reset='\033[0m'
  Red='\033[0;31m'
  Green='\033[0;32m'
  Yellow='\033[0;33m'
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

cleanup() {
  [ -n "$TMPDIR_VK" ] && [ -d "$TMPDIR_VK" ] && rm -rf "$TMPDIR_VK"
}

error() {
  printf '%b\n' "${Red}ERROR${Reset}: $*" >&2
  cleanup
  exit 1
}

trap cleanup EXIT INT TERM

# GET a URL to stdout. Fails loudly; no silent empty responses.
http_get() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" || return 1
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$1" || return 1
  else
    error "Neither curl nor wget found. Please install one and try again."
  fi
}

# Newest release whose tag matches the channel. Anchoring the pattern to the
# opening quote excludes the heritage `cli-v*` tags from the pre-1.0 repo.
#
# head -1 trusts the API's order, which is newest-first EXCEPT that GitHub
# hoists whichever release is flagged "latest" to the top. A prerelease tag
# published without --prerelease therefore outranks every newer one. The
# release workflow sets it from the hyphen in the tag; a hand-made release
# must too.
fetch_latest_prerelease() {
  channel="$1"
  info "Fetching latest $channel release..."

  response=$(http_get "https://api.github.com/repos/$REPO/releases") ||
    error "Failed to fetch releases from the GitHub API"

  tag=$(printf '%s' "$response" |
    grep -o "\"tag_name\": *\"v[^\"]*-${channel}\\.[^\"]*\"" |
    head -1 | sed 's/.*"tag_name": *"//' | sed 's/"$//')

  [ -n "$tag" ] ||
    error "No $channel release found. See: https://github.com/$REPO/releases"

  printf '%b\n' "${Green}Found:${Reset} $tag"
  RESOLVED_VERSION="$tag"
  RELEASE_URL="https://github.com/$REPO/releases/download/$tag"
}

# GitHub's "latest" already excludes prereleases, but the heritage cli-v*
# releases are not prereleases -- so verify the tag really is a v<semver>
# before pointing anyone at it.
fetch_latest_stable() {
  info "Resolving the latest stable release..."

  response=$(http_get "https://api.github.com/repos/$REPO/releases/latest") ||
    error "Failed to fetch the latest release from the GitHub API"

  tag=$(printf '%s' "$response" |
    grep -o "\"tag_name\": *\"[^\"]*\"" |
    head -1 | sed 's/.*"tag_name": *"//' | sed 's/"$//')

  case "$tag" in
    v[0-9]*-*)
      error "The latest release ($tag) is a prerelease. Install it with:

  curl -fsSL https://getvibekit.ai/install | VIBEKIT_CHANNEL=alpha sh"
      ;;
    v[0-9]*)
      ;;
    *)
      error "No stable release yet. Install a prerelease:

  curl -fsSL https://getvibekit.ai/install | VIBEKIT_CHANNEL=alpha sh"
      ;;
  esac

  printf '%b\n' "${Green}Found:${Reset} $tag"
  RESOLVED_VERSION="$tag"
  RELEASE_URL="https://github.com/$REPO/releases/download/$tag"
}

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
    stable)     fetch_latest_stable ;;
    alpha|beta) fetch_latest_prerelease "$channel" ;;
    *)          error "Unknown channel: $channel. Use 'stable', 'alpha', or 'beta'." ;;
  esac
}

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
        arm64)  echo "darwin-arm64" ;;
        x86_64) echo "darwin-x64" ;;
        *)      error "Unsupported macOS architecture: $arch" ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64) echo "linux-x64" ;;
        *)      error "Only x64 is supported on Linux. Detected: $arch" ;;
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

ensure_install_dir() {
  if [ ! -d "$INSTALL_DIR" ]; then
    info "Creating install directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
  fi
}

# Ask once, for both binaries. Nothing is removed here -- the install step
# overwrites in place, so a failed download never destroys a working setup.
check_existing() {
  if [ ! -f "$INSTALL_DIR/vibekit" ] && [ ! -f "$INSTALL_DIR/vibekit-tui" ]; then
    return 0
  fi

  warn "VibeKit is already installed in $INSTALL_DIR"

  if [ -n "${VIBEKIT_FORCE_INSTALL:-}" ]; then
    info "VIBEKIT_FORCE_INSTALL is set, replacing the existing installation..."
    return 0
  fi

  printf '%s' "Replace it? (y/N) "
  read -r response < /dev/tty

  case "$response" in
    [Yy]|[Yy][Ee][Ss]) return 0 ;;
    *) info "Keeping the existing installation."; exit 0 ;;
  esac
}

download() {
  url="$1"
  dest="$2"
  name="$3"

  printf '%b\n' "${Dim}Downloading:${Reset} ${Bold}$name${Reset}"

  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --progress-bar --output "$dest" "$url" ||
      error "Failed to download $name from $url"
  else
    wget -qO "$dest" --show-progress "$url" ||
      error "Failed to download $name from $url"
  fi
}

# Both binaries land in a temp dir first. The Explorer is mandatory, so a
# half-download must not leave a CLI that cannot open the Explorer.
install_binaries() {
  platform="$1"
  TMPDIR_VK=$(mktemp -d)

  download "$RELEASE_URL/vibekit-$platform"     "$TMPDIR_VK/vibekit"     "vibekit-$platform"
  download "$RELEASE_URL/vibekit-tui-$platform" "$TMPDIR_VK/vibekit-tui" "vibekit-tui-$platform"

  chmod +x "$TMPDIR_VK/vibekit" "$TMPDIR_VK/vibekit-tui"

  mv -f "$TMPDIR_VK/vibekit"     "$INSTALL_DIR/vibekit"
  mv -f "$TMPDIR_VK/vibekit-tui" "$INSTALL_DIR/vibekit-tui"
}

# Report pre-1.0 state; never touch it. Old mnemonics and private keys live
# in the OS keyring, and `vibekit doctor --fix` is the opt-in repair path.
legacy_notice() {
  if [ -f "$HOME/.config/vibekit/accounts.db" ]; then
    echo ""
    warn "Found accounts from a pre-1.0 VibeKit ($HOME/.config/vibekit/accounts.db)."
    info "Nothing was changed. Run 'vibekit doctor' to review it."
  fi
}

check_path() {
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) return 0 ;;
  esac

  echo ""
  warn "$INSTALL_DIR is not in your PATH"
  echo ""
  info "Add it to your shell configuration:"
  echo ""

  shell_name=$(basename "${SHELL:-bash}")

  case "$shell_name" in
    zsh)
      echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.zshrc"
      echo "  source ~/.zshrc"
      ;;
    bash)
      echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.bashrc"
      echo "  source ~/.bashrc"
      ;;
    fish)
      echo "  fish_add_path $INSTALL_DIR"
      ;;
    *)
      echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
      echo ""
      info "Add the above line to your shell's config file."
      ;;
  esac
  echo ""
  return 1
}

main() {
  echo ""
  printf '%b\n' "${Bold}VibeKit Installer${Reset}"
  echo ""

  determine_release_url
  ensure_install_dir
  check_existing

  platform=$(detect_platform)
  install_binaries "$platform"

  echo ""
  if [ "$RESOLVED_CHANNEL" = "stable" ] || [ "$RESOLVED_CHANNEL" = "specific" ]; then
    success "Installed: vibekit $RESOLVED_VERSION ($platform)"
  else
    success "Installed: vibekit $RESOLVED_VERSION ($platform) [$RESOLVED_CHANNEL]"
  fi
  printf '%b\n' "${Dim}Location:${Reset} $INSTALL_DIR/vibekit"
  printf '%b\n' "${Dim}Explorer:${Reset} $INSTALL_DIR/vibekit-tui"

  legacy_notice

  echo ""
  check_path || true

  info "To get started, run:"
  echo ""
  echo "  vibekit new"
  echo "  vibekit explore"
  echo ""
}

main
