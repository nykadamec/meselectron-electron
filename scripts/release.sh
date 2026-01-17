#!/bin/bash

# Release script for Prehraj.to AutoPilot
# Builds installers, generates checksums, signs with GPG, and creates GitHub release

set -e

# Configuration
APP_NAME="Prehraj.to AutoPilot"
REPO_OWNER="nykadamec"
REPO_NAME="meselectron-electron"
DIST_DIR="../output/build"
RELEASES_DIR="releases"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v git &> /dev/null; then
        log_error "git is not installed"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi

    if [ -z "$GITHUB_TOKEN" ]; then
        log_error "GITHUB_TOKEN is not set. Run: export GITHUB_TOKEN=your_token"
        exit 1
    fi

    if [ -z "$GPG_PRIVATE_KEY" ]; then
        log_warn "GPG_PRIVATE_KEY is not set. Checksums will not be signed."
    fi

    log_info "Prerequisites check passed"
}

# Get current version from package.json
get_version() {
    node -e "console.log(require('../package.json').version)"
}

# Build the application
build_app() {
    log_info "Building application..."

    # Clean previous builds
    rm -rf dist
    rm -rf $RELEASES_DIR

    # Build (Linux target is disabled in electron-builder.yml)
    npm run build

    log_info "Build completed"
}

# Create checksums
create_checksums() {
    log_info "Creating checksums..."

    cd $DIST_DIR

    # Generate SHA-256 checksums for all installer files (Linux excluded)
    sha256sum *.dmg *.exe *.zip > checksums.txt

    cd - > /dev/null

    log_info "Checksums created: $DIST_DIR/checksums.txt"
}

# Sign checksums with GPG
sign_checksums() {
    if [ -z "$GPG_PRIVATE_KEY" ]; then
        log_warn "Skipping GPG signature (no private key)"
        return
    fi

    log_info "Signing checksums with GPG..."

    cd $DIST_DIR

    # Import GPG key
    echo "$GPG_PRIVATE_KEY" | gpg --import --batch --yes

    # Sign the checksums file
    gpg --armor --detach-sign checksums.txt

    cd - > /dev/null

    log_info "Checksums signed: $DIST_DIR/checksums.txt.asc"
}

# Create GitHub release
create_release() {
    local version=$(get_version)
    log_info "Creating GitHub release for version $version..."

    # Get the release notes from CHANGELOG.md or git log
    local release_notes=$(git log --oneline -20 | head -15)

    # Create release using GitHub CLI if available, otherwise use API
    if command -v gh &> /dev/null; then
        cd $DIST_DIR

        # Collect existing files only
        local assets=()
        for f in *.dmg *.exe *.zip checksums.txt checksums.txt.asc; do
            [ -f "$f" ] && assets+=("$f")
        done

        if [ ${#assets[@]} -gt 0 ]; then
            gh release create "v$version" \
                --title "$APP_NAME v$version" \
                --notes "$release_notes" \
                "${assets[@]}" 2>/dev/null || \
            gh release create "v$version" \
                --title "$APP_NAME v$version" \
                --notes "$release_notes" \
                --draft \
                "${assets[@]}"
        fi

        cd - > /dev/null

        log_info "Release created: https://github.com/$REPO_OWNER/$REPO_NAME/releases/tag/v$version"
    else
        log_warn "GitHub CLI (gh) not found. Release must be created manually."
        log_info "Upload these files to the release:"
        ls -la $DIST_DIR/
    fi
}

# Upload to GitHub via API
upload_to_github() {
    local version=$(get_version)

    if [ -z "$(command -v gh)" ]; then
        log_warn "GitHub CLI not available, skipping upload"
        return
    fi

    log_info "Uploading artifacts to GitHub..."

    cd $DIST_DIR

    # Upload each asset (Linux excluded)
    for file in *.dmg *.exe *.zip checksums.txt checksums.txt.asc; do
        if [ -f "$file" ]; then
            log_info "Uploading $file..."
            gh release upload "v$version" "$file" --repo "$REPO_OWNER/$REPO_NAME" || true
        fi
    done

    cd - > /dev/null

    log_info "Upload complete"
}

# Main execution
main() {
    echo "=========================================="
    echo "  $APP_NAME Release Script"
    echo "=========================================="
    echo ""

    check_prerequisites
    build_app
    create_checksums
    sign_checksums
    create_release
    upload_to_github

    echo ""
    echo "=========================================="
    log_info "Release process completed!"
    echo "=========================================="
}

# Run main function
main "$@"
