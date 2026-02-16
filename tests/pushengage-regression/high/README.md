# HIGH Priority Tests

## Overview

This directory contains HIGH priority regression tests for PushEngage plugin.

## Test Coverage

### DRIP CAMPAIGNS (0/6 - 0%)

1. [ ] Create basic drip campaign
2. [ ] Create drip for specific audience
3. [ ] Duplicate existing drip campaign
4. [ ] Edit drip campaign
5. [ ] Export drip campaign
6. [ ] Delete drip campaign

### TRIGGERS (0/11 - 0%)

1. [ ] Create custom trigger
2. [ ] Create inventory trigger
3. [ ] Create price drop trigger
4. [ ] Create cart abandonment trigger
5. [ ] Edit existing trigger
6. [ ] Add notification to trigger
7. [ ] Export trigger data
8. [ ] Duplicate trigger
9. [ ] Disable trigger
10. [ ] Enable trigger
11. [ ] Delete trigger

### AUDIENCE (0/4 - 0%)

1. [ ] Create new audience segment
2. [ ] Delete audience segment
3. [ ] Create audience group
4. [ ] Delete audience group

### WOOCOMMERCE CORE (0/8 - 0%)

1. [ ] Configure new order notification
2. [ ] Configure cancelled order notification
3. [ ] Configure failed order notification
4. [ ] Configure pending order notification
5. [ ] Configure processing order notification
6. [ ] Configure on-hold order notification
7. [ ] Configure completed order notification
8. [ ] Configure refunded order notification

## Running Tests

```bash
# Run all high priority tests
npm run test:high

# Run specific feature tests
npm run test:high:push-broadcasts
npm run test:high:settings-core
```

## Status Legend

- [x] Implemented and working
- [ ] Not yet implemented (TODO)

## Priority Definition

**HIGH**: Important features that significantly impact user experience.
