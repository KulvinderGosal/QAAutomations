#!/bin/bash
# Installs npm dependencies so Playwright tests can run in Claude Code sessions (cloud and local).
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Local sessions: only install when dependencies are missing, to keep startup fast
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ -d node_modules/@playwright/test ]; then
  exit 0
fi

# Browsers are pre-installed in the cloud image; don't download them again
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# --no-save keeps package-lock.json untouched so sessions don't leave stray diffs
npm install --no-audit --no-fund --no-save

# playwright.config.js runs the chromium project on Google Chrome (channel: 'chrome'),
# which the cloud image doesn't include
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ ! -x /opt/google/chrome/chrome ]; then
  npx playwright install chrome
fi
