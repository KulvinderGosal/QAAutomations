# CRITICAL Priority Tests

## Overview

This directory contains CRITICAL priority regression tests for PushEngage plugin.

## Test Coverage

### PUSH BROADCASTS (1/13 - 8%)

1. [x] Send immediate push broadcast
2. [ ] Schedule broadcast for future date/time
3. [ ] Create recurring notification
4. [ ] Create A/B test broadcast
5. [ ] Send broadcast to specific segment
6. [ ] Send broadcast to audience group
7. [ ] Duplicate existing broadcast
8. [ ] Export broadcast data
9. [ ] View broadcast analytics and stats
10. [ ] Edit draft broadcast
11. [ ] Delete broadcast
12. [ ] Verify broadcast appears in history
13. [ ] Resend existing broadcast

### SETTINGS CORE (0/9 - 0%)

1. [ ] Connect WordPress site to PushEngage
2. [ ] Disconnect site from PushEngage
3. [ ] Verify dashboard sign-in flow
4. [ ] Enable auto push settings
5. [ ] Disable auto push settings
6. [ ] Configure enabled post types
7. [ ] Use site icon for notifications
8. [ ] Upload custom notification icon
9. [ ] Save settings and verify

### SMOKE (5/5 - 100%)

1. [x] Login to WordPress admin
2. [x] WordPress dashboard loads
3. [x] PushEngage menu visible in sidebar
4. [x] Click PushEngage menu
5. [x] Frontend site is reachable

## Running Tests

```bash
# Run all critical priority tests
npm run test:critical

# Run specific feature tests
npm run test:critical:push-broadcasts
npm run test:critical:settings-core
```

## Status Legend

- [x] Implemented and working
- [ ] Not yet implemented (TODO)

## Priority Definition

**CRITICAL**: Must pass before any release. Core functionality that breaks the product if it fails.
