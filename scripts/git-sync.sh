#!/usr/bin/env bash
set -euo pipefail

# Bundle staging + commit + push while enforcing a message: `./scripts/git-sync.sh "my message"`.
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 \"commit message\""
    exit 1
fi

message="$*"

git add .
git commit -m "$message"
git push
