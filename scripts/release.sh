#!/bin/bash

# Causal Release Script
# Creates a new release with semantic versioning

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -f "src-tauri/Cargo.toml" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Check if git is clean
if [ -n "$(git status --porcelain)" ]; then
    print_error "Git working directory is not clean. Please commit or stash your changes first."
    git status --short
    exit 1
fi

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "You are on branch '$CURRENT_BRANCH', not 'main'"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Aborting release"
        exit 0
    fi
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_info "Current version: $CURRENT_VERSION"

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Calculate next versions
NEXT_MAJOR="$((MAJOR + 1)).0.0"
NEXT_MINOR="$MAJOR.$((MINOR + 1)).0"
NEXT_PATCH="$MAJOR.$MINOR.$((PATCH + 1))"

echo
echo "Select version bump type:"
echo "  1) Patch   ($CURRENT_VERSION → $NEXT_PATCH) - Bug fixes"
echo "  2) Minor   ($CURRENT_VERSION → $NEXT_MINOR) - New features, backwards compatible"
echo "  3) Major   ($CURRENT_VERSION → $NEXT_MAJOR) - Breaking changes"
echo "  4) Pre-release - Release candidate, beta, or alpha"
echo "  5) Custom  - Enter a custom version"
echo

read -p "Enter choice (1-5): " -n 1 -r CHOICE
echo
echo

NEW_VERSION=""
case $CHOICE in
    1)
        NEW_VERSION=$NEXT_PATCH
        ;;
    2)
        NEW_VERSION=$NEXT_MINOR
        ;;
    3)
        NEW_VERSION=$NEXT_MAJOR
        ;;
    4)
        echo "Select pre-release type:"
        echo "  1) RC (Release Candidate)"
        echo "  2) Beta"
        echo "  3) Alpha"
        echo
        read -p "Enter choice (1-3): " -n 1 -r PRERELEASE_CHOICE
        echo

        PRERELEASE_TYPE=""
        case $PRERELEASE_CHOICE in
            1) PRERELEASE_TYPE="rc" ;;
            2) PRERELEASE_TYPE="beta" ;;
            3) PRERELEASE_TYPE="alpha" ;;
            *)
                print_error "Invalid choice"
                exit 1
                ;;
        esac

        read -p "Enter pre-release number (e.g., 1): " PRERELEASE_NUM
        if ! [[ $PRERELEASE_NUM =~ ^[0-9]+$ ]]; then
            print_error "Invalid pre-release number. Must be a positive integer."
            exit 1
        fi

        NEW_VERSION="$CURRENT_VERSION-$PRERELEASE_TYPE.$PRERELEASE_NUM"
        ;;
    5)
        read -p "Enter custom version (e.g., 1.2.3 or 1.2.3-rc.1): " NEW_VERSION
        # Validate semantic version format (with optional pre-release suffix)
        if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-z]+\.[0-9]+)?$ ]]; then
            print_error "Invalid version format. Must be MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-prerelease.number (e.g., 1.2.3 or 1.2.3-rc.1)"
            exit 1
        fi
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

print_info "New version: $NEW_VERSION"

# Confirm with user
echo
read -p "Proceed with version $NEW_VERSION? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Aborting release"
    exit 0
fi

print_info "Updating version numbers..."

# Update package.json
print_info "  • package.json"
npm version --no-git-tag-version "$NEW_VERSION" > /dev/null

# Update src-tauri/Cargo.toml
print_info "  • src-tauri/Cargo.toml"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
else
    # Linux/Windows (Git Bash)
    sed -i "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
fi

# Update src-tauri/tauri.conf.json
print_info "  • src-tauri/tauri.conf.json"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
else
    # Linux/Windows (Git Bash)
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
fi

print_success "Version numbers updated"

# Update Cargo.lock
print_info "Updating Cargo.lock..."
cd src-tauri && cargo check --quiet && cd ..
print_success "Cargo.lock updated"

# Commit changes
print_info "Committing changes..."
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -m "chore: Bump version to $NEW_VERSION"
print_success "Changes committed"

# Create tag
TAG_NAME="v$NEW_VERSION"
print_info "Creating tag $TAG_NAME..."
git tag -a "$TAG_NAME" -m "Release $NEW_VERSION"
print_success "Tag created"

# Push changes and tag
echo
print_warning "Ready to push to GitHub"
print_info "This will:"
print_info "  • Push commit to $CURRENT_BRANCH"
print_info "  • Push tag $TAG_NAME"
print_info "  • Trigger GitHub Actions release workflow"
echo

read -p "Push now? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Changes committed and tagged locally, but not pushed"
    print_info "To push later, run:"
    print_info "  git push origin $CURRENT_BRANCH"
    print_info "  git push origin $TAG_NAME"
    exit 0
fi

print_info "Pushing to GitHub..."
git push origin "$CURRENT_BRANCH"
git push origin "$TAG_NAME"
print_success "Pushed to GitHub"

echo
print_success "Release $TAG_NAME created successfully!"
print_info "GitHub Actions will now build and create a draft release"
print_info "View workflow: https://github.com/jdsingh1/causal/actions"
print_info "View releases: https://github.com/jdsingh1/causal/releases"
echo
