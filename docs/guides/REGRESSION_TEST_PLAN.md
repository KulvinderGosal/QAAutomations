# PushEngage Plugin - Complete Regression Test Plan

## 🎯 Test Organization Strategy

### Priority-Based Test Suites

```
tests/pushengage/
├── critical/              # P0 - Must pass before release
│   ├── smoke/            # Basic functionality
│   ├── push-broadcasts/  # Core notification sending
│   └── settings/         # Critical settings
├── high/                  # P1 - Important features
│   ├── drip-campaigns/   # Automated campaigns
│   ├── triggers/         # Automation triggers
│   ├── audience/         # Segmentation
│   └── woocommerce/      # E-commerce integration
├── medium/                # P2 - Standard features
│   ├── click-to-chat/    # Chat widget
│   ├── whatsapp/         # WhatsApp integration
│   └── goal-tracking/    # Analytics
└── low/                   # P3 - Nice to have
    └── about-us/         # Help/documentation
```

## 📊 Feature Coverage Matrix

| Feature | Priority | Test Count | Status |
|---------|----------|------------|--------|
| **Smoke Tests** | P0 | 5 | ✅ Done |
| **Push Broadcasts** | P0 | 14 | ✅ 1 Done, 13 To Do |
| **Settings - Site Connection** | P0 | 3 | 📝 To Do |
| **Settings - Auto Push** | P0 | 6 | 📝 To Do |
| **Drip Campaigns** | P1 | 6 | 📝 To Do |
| **Triggers** | P1 | 11 | 📝 To Do |
| **Audience Management** | P1 | 4 | 📝 To Do |
| **WooCommerce Templates** | P1 | 70+ | 📝 To Do |
| **Click to Chat** | P2 | 4 | 📝 To Do |
| **WhatsApp Integration** | P2 | 5 | 📝 To Do |
| **Goal Tracking** | P2 | 2 | 📝 To Do |
| **WooCommerce Settings** | P2 | 3 | 📝 To Do |
| **About Us** | P3 | 1 | 📝 To Do |
| **TOTAL** | | **~135+** | 2% Complete |

## 🚀 Implementation Plan

### Phase 1: Critical Tests (P0) - Week 1
1. ✅ Smoke tests (5 tests) - DONE
2. ✅ Send Push Broadcast - DONE
3. ⏳ Push Broadcast variations:
   - Scheduled broadcast
   - Recurring broadcast
   - A/B testing broadcast
   - Segment targeting
   - Duplicate broadcast
   - Export broadcast
4. ⏳ Settings - Site Connection:
   - Connect site
   - Disconnect site
   - Dashboard sign-in
5. ⏳ Settings - Auto Push:
   - Enable/disable auto push
   - Configure post types
   - Notification icon settings

### Phase 2: High Priority (P1) - Week 2
1. Drip Campaigns (6 tests)
2. Triggers (11 tests)
3. Audience Management (4 tests)
4. WooCommerce Core Templates (20 most critical)

### Phase 3: Medium Priority (P2) - Week 3
1. Click to Chat (4 tests)
2. WhatsApp Integration (5 tests)
3. Goal Tracking (2 tests)
4. WooCommerce Settings (3 tests)
5. Remaining WooCommerce Templates (50+)

### Phase 4: Low Priority (P3) - Week 4
1. About Us / Help (1 test)
2. Additional edge cases
3. Performance tests
4. Cleanup and optimization

## 📋 Test Cases by Feature

### CRITICAL (P0)

#### 1. Push Broadcasts (14 tests)
- [x] Send immediate broadcast
- [ ] Schedule broadcast for future
- [ ] Create recurring broadcast
- [ ] A/B test broadcast
- [ ] Send to all subscribers
- [ ] Send to specific segment
- [ ] Send to audience group
- [ ] Duplicate existing broadcast
- [ ] Export broadcast
- [ ] View broadcast analytics
- [ ] Edit draft broadcast
- [ ] Delete broadcast
- [ ] Verify broadcast history
- [ ] Resend broadcast

#### 2. Settings - Site Connection (3 tests)
- [ ] Connect new site
- [ ] Disconnect site
- [ ] Verify dashboard sign-in

#### 3. Settings - Auto Push (6 tests)
- [ ] Enable auto push
- [ ] Disable auto push
- [ ] Configure post types
- [ ] Use site icon
- [ ] Upload notification icon
- [ ] Save settings

### HIGH PRIORITY (P1)

#### 4. Drip Campaigns (6 tests)
- [ ] Create basic drip
- [ ] Create drip for audience
- [ ] Duplicate drip
- [ ] Edit drip
- [ ] Export drip
- [ ] Delete drip

#### 5. Triggers (11 tests)
- [ ] Create custom trigger
- [ ] Create inventory trigger
- [ ] Create price drop trigger
- [ ] Create cart abandonment trigger
- [ ] Edit trigger
- [ ] Add notification to trigger
- [ ] Export trigger
- [ ] Duplicate trigger
- [ ] Disable trigger
- [ ] Enable trigger
- [ ] Delete trigger

#### 6. Audience (4 tests)
- [ ] Create segment
- [ ] Delete segment
- [ ] Create audience group
- [ ] Delete audience group

#### 7. WooCommerce Templates (70+ tests)
- [ ] New order notification
- [ ] Cancelled order notification
- [ ] Failed order notification
- [ ] Pending order notification
- [ ] Processing order notification
- [ ] On-hold order notification
- [ ] Completed order notification
- [ ] Refunded order notification
- [ ] (62 more template-specific tests)

### MEDIUM PRIORITY (P2)

#### 8. Click to Chat (4 tests)
- [ ] Enable click to chat
- [ ] Disable click to chat
- [ ] Configure chat widget style
- [ ] Verify chat widget on frontend

#### 9. WhatsApp (5 tests)
- [ ] Configure WhatsApp settings
- [ ] Configure WhatsApp Cloud settings
- [ ] Enable WhatsApp notifications
- [ ] Configure WhatsApp templates
- [ ] Test WhatsApp integration

#### 10. Goal Tracking (2 tests)
- [ ] Enable goal tracking
- [ ] Disable goal tracking

#### 11. WooCommerce Settings (3 tests)
- [ ] Enable cart abandonment trigger
- [ ] Enable order notification trigger
- [ ] Disable triggers

### LOW PRIORITY (P3)

#### 12. About Us (1 test)
- [ ] Verify documentation links

## 🎯 Test Execution Strategy

### Daily Regression (15 min)
```bash
npm run test:critical
```
Runs: Smoke + Core broadcast tests

### Pre-Release Regression (2 hours)
```bash
npm run test:regression
```
Runs: P0 + P1 tests

### Full Regression (4 hours)
```bash
npm run test:full
```
Runs: All tests (P0 + P1 + P2 + P3)

### Feature-Specific Tests
```bash
npm run test:broadcasts       # Push broadcast tests only
npm run test:drip            # Drip campaign tests only
npm run test:triggers        # Trigger tests only
npm run test:woocommerce     # WooCommerce tests only
```

## 📈 Success Criteria

### Phase 1 Complete:
- ✅ All P0 tests passing (20 tests)
- ✅ Test execution time < 10 minutes
- ✅ Screenshots for all critical flows
- ✅ Documentation complete

### Phase 2 Complete:
- ✅ All P0 + P1 tests passing (50+ tests)
- ✅ Test execution time < 30 minutes
- ✅ CI/CD integration ready

### Phase 3 Complete:
- ✅ All P0 + P1 + P2 tests passing (90+ tests)
- ✅ Test execution time < 2 hours
- ✅ Performance benchmarks established

### Phase 4 Complete:
- ✅ All tests passing (135+ tests)
- ✅ 100% feature coverage
- ✅ Automated reporting
- ✅ Production-ready regression suite

## 🔧 Technical Standards

### All Tests Must:
1. ✅ Be idempotent (can run multiple times)
2. ✅ Clean up after themselves
3. ✅ Use page objects for reusability
4. ✅ Include detailed logging
5. ✅ Capture screenshots on failure
6. ✅ Have clear, descriptive names
7. ✅ Follow priority conventions

### File Naming Convention:
```
critical/push-broadcasts/01-send-immediate.spec.js
critical/push-broadcasts/02-schedule-future.spec.js
high/drip-campaigns/01-create-basic.spec.js
medium/click-to-chat/01-enable-widget.spec.js
```

## 📝 Progress Tracking

- **Total Tests Planned:** 135+
- **Tests Completed:** 2 (1.5%)
- **Tests In Progress:** 0
- **Tests Remaining:** 133
- **Estimated Completion:** 4 weeks
- **Current Phase:** Phase 1 - Critical Tests

## 🎊 Current Status

✅ **Infrastructure Ready:**
- Multi-environment support
- Automated login
- Smart element detection
- Screenshot capture
- Detailed logging

✅ **Completed:**
- Smoke tests (5/5)
- Send immediate broadcast (1/14)

🚧 **Next Up:**
- Scheduled broadcasts
- Push broadcast variations
- Settings tests
