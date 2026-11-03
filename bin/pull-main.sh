#!/usr/bin/env bash
# A read-only peek at what's shipped on main, for reviewing/learning from a
# local clone (e.g. in VSCode). It fetches origin/main and prints the recent
# history. Pass --checkout to actually switch your working copy to main.
#
#   bin/pull-main.sh            # fetch + show the latest main
#   bin/pull-main.sh --checkout # ...and switch to main (fast-forward pull)
#
# NB: never run this in the VPS deploy checkouts (~/epicentre,
# ~/epicentre-preview) - CI hard-resets those. Use it in your own clone.
set -euo pipefail

git fetch origin main

echo "=== origin/main - latest 15 commits ==="
git --no-pager log --oneline -15 origin/main

if [ "${1:-}" = "--checkout" ]; then
  git checkout main
  git pull --ff-only origin main
  echo
  echo "Now on main (up to date). Make a feature branch before editing:"
  echo "  git checkout -b feature/<slug>"
else
  echo
  echo "(run with --checkout to switch your working copy to main)"
fi
