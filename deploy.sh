#!/usr/bin/env bash
#
# Deploy LIFT Coach to https://www.dugcanlift.com/coach/
#
# Copies coach/ into the dugcanlift-site working copy and pushes. Runs from
# your machine over SSH, using the same key every other push to that repo has
# used — no CI, no tokens, nothing stored on GitHub.
#
#   ./deploy.sh              deploy
#   ./deploy.sh --dry-run    show what would change, touch nothing
#
set -euo pipefail

SITE="${SITE_REPO:-$HOME/Projects/dugcanlift-site}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/coach/"
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

[ -d "$SITE/.git" ] || { echo "no site repo at $SITE (set SITE_REPO)" >&2; exit 1; }

# Refuse to deploy on top of edits you haven't dealt with — the rsync below
# deletes, and unstaged work in coach/ would go with it.
if [ -n "$(git -C "$SITE" status --porcelain coach)" ]; then
  echo "site's coach/ has uncommitted changes; commit or discard them first" >&2
  git -C "$SITE" status --short coach >&2
  exit 1
fi

echo "==> syncing site"
git -C "$SITE" pull --rebase --quiet

echo "==> copying coach/"
# --delete so a file removed here is removed there; without it the site keeps
# serving shell files this repo no longer has, and the service worker caches
# them.
rsync -a --delete $DRY --itemize-changes "$SRC" "$SITE/coach/"

if [ -n "$DRY" ]; then
  echo "==> dry run, nothing changed"
  exit 0
fi

if [ -z "$(git -C "$SITE" status --porcelain coach)" ]; then
  echo "==> already up to date, nothing to deploy"
  exit 0
fi

VERSION="$(git -C "$(dirname "$SRC")" rev-parse --short HEAD)"
git -C "$SITE" add coach
git -C "$SITE" commit -q -m "Deploy LIFT Coach $VERSION"
git -C "$SITE" push --quiet

echo "==> deployed $VERSION"
echo "    GitHub Pages takes a minute: https://www.dugcanlift.com/coach/"
