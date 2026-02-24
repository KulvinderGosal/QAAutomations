# Playwright MCP Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     QA Automation Framework                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─────────────────────┬─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
                    │   Playwright     │  │   MCP Server     │  │  Test Reports    │
                    │   (Primary)      │  │   (Optional)     │  │                  │
                    └──────────────────┘  └──────────────────┘  └──────────────────┘
                              │                     │                     │
                              │                     │                     │
                    ┌─────────┴─────────┐  ┌────────┴────────┐  ┌────────┴────────┐
                    │                   │  │                 │  │                 │
                    ▼                   ▼  ▼                 ▼  ▼                 ▼
            ┌─────────────┐    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
            │  Browser    │    │  Test       │      │  MCP        │      │  HTML       │
            │  Automation │    │  Assertions │      │  Tools      │      │  JSON       │
            │             │    │             │      │  (22 tools) │      │  JUnit      │
            └─────────────┘    └─────────────┘      └─────────────┘      └─────────────┘
```

## Test Execution Flow

### Standard Execution (No MCP)
```
Start Test
    │
    ├─> Playwright Setup
    │
    ├─> Navigate to Page
    │
    ├─> Perform Actions
    │       ├─> Fill forms
    │       ├─> Click buttons
    │       └─> Wait for elements
    │
    ├─> Run Assertions
    │       ├─> Check visibility
    │       ├─> Verify text
    │       └─> Validate state
    │
    ├─> Capture on Failure
    │       ├─> Screenshot
    │       ├─> Video
    │       └─> Trace
    │
    └─> Generate Report
            ├─> HTML Report
            ├─> JSON Results
            └─> JUnit XML
```

### Hybrid Execution (With MCP)
```
Start Test
    │
    ├─> Playwright Setup
    │
    ├─> Navigate to Page
    │       │
    │       └─> [MCP] Optional Snapshot ✨
    │
    ├─> Perform Actions
    │       ├─> Fill forms
    │       ├─> Click buttons
    │       ├─> Wait for elements
    │       │
    │       └─> [MCP] Optional Analysis ✨
    │
    ├─> Run Assertions
    │       ├─> Check visibility
    │       ├─> Verify text
    │       ├─> Validate state
    │       │
    │       └─> [MCP] Optional Validation ✨
    │
    ├─> Capture on Failure
    │       ├─> Screenshot (Playwright)
    │       ├─> Video (Playwright)
    │       ├─> Trace (Playwright)
    │       │
    │       └─> [MCP] Enhanced Debug ✨
    │               ├─> Accessibility Snapshot
    │               ├─> Console Logs
    │               ├─> Network Requests
    │               └─> Full Context
    │
    └─> Generate Report
            ├─> HTML Report
            ├─> JSON Results
            ├─> JUnit XML
            │
            └─> [MCP] Debug Files ✨
```

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Test Suite                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  Playwright Tests (95%)                    │ │
│  │                                                            │ │
│  │  • Fast automated execution                               │ │
│  │  • CI/CD compatible                                       │ │
│  │  • Production ready                                       │ │
│  │  • No user approval needed                                │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────┐    │ │
│  │  │  if (MCP_ENABLED) {                              │    │ │
│  │  │      try {                                        │    │ │
│  │  │          ┌────────────────────────────────────┐  │    │ │
│  │  │          │  MCP Enhancement Layer (5%)        │  │    │ │
│  │  │          │                                    │  │    │ │
│  │  │          │  • Accessibility snapshots         │  │    │ │
│  │  │          │  • Console log capture             │  │    │ │
│  │  │          │  • Network monitoring              │  │    │ │
│  │  │          │  • Enhanced debugging              │  │    │ │
│  │  │          │  • Requires user approval          │  │    │ │
│  │  │          │                                    │  │    │ │
│  │  │          └────────────────────────────────────┘  │    │ │
│  │  │      } catch (e) {                                │    │ │
│  │  │          // Test continues without MCP            │    │ │
│  │  │      }                                             │    │ │
│  │  │  }                                                 │    │ │
│  │  └──────────────────────────────────────────────────┘    │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Interaction

```
┌─────────────┐
│  Test File  │
└──────┬──────┘
       │
       ├──────────────────────────────────────┐
       │                                      │
       ▼                                      ▼
┌──────────────────┐              ┌───────────────────┐
│  Playwright API  │              │  MCP Helper Lib   │
└────────┬─────────┘              └─────────┬─────────┘
         │                                  │
         │                                  ▼
         │                        ┌───────────────────┐
         │                        │  MCP Server       │
         │                        │  (user-playwright)│
         │                        └─────────┬─────────┘
         │                                  │
         │                                  ▼
         │                        ┌───────────────────┐
         │                        │  Browser Tools    │
         │                        │  (22 tools)       │
         │                        └─────────┬─────────┘
         │                                  │
         └──────────────┬───────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  Browser         │
              │  (Chromium/      │
              │   Firefox/       │
              │   WebKit)        │
              └──────────────────┘
```

## File Organization

```
QA-Automation/
├── tests/
│   ├── utils/
│   │   ├── playwright-helpers.js       ◄─── Standard helpers (always used)
│   │   ├── mcp-helpers.js              ◄─── MCP helpers (optional)
│   │   └── config.js                   ◄─── Configuration
│   │
│   ├── examples/
│   │   ├── mcp-integration-example.spec.js  ◄─── Example patterns
│   │   └── README.md                   ◄─── Example docs
│   │
│   ├── sign-up/
│   │   └── pushengage-free-plan-signup.spec.js  ◄─── Existing tests
│   │
│   └── pushengage-regression/
│       └── [605 regression tests]
│
├── docs/
│   ├── MCP_INTEGRATION_GUIDE.md        ◄─── Full guide
│   ├── MCP_QUICK_REFERENCE.md          ◄─── Quick ref
│   ├── MCP_IMPLEMENTATION_SUMMARY.md   ◄─── Tech details
│   ├── MCP_TEAM_SUMMARY.md             ◄─── Team overview
│   └── MCP_ARCHITECTURE.md             ◄─── This file
│
└── .cursor/projects/.../mcps/
    └── user-playwright/
        └── tools/                      ◄─── MCP tool schemas
            ├── browser_navigate.json
            ├── browser_snapshot.json
            ├── browser_click.json
            └── [19 more tools]
```

## Data Flow

### Standard Playwright Test
```
Test Code
    │
    ├─> Playwright API
    │       │
    │       └─> Browser Actions
    │               │
    │               └─> Browser
    │                       │
    │                       └─> Page Results
    │                               │
    │                               └─> Assertions
    │                                       │
    │                                       └─> Test Report
```

### Hybrid Test with MCP
```
Test Code
    │
    ├─> Playwright API ──────────────┐
    │       │                        │
    │       └─> Browser Actions      │
    │               │                │
    │               └─> Browser ◄────┼─────┐
    │                       │        │     │
    │                       └─> Page Results  │
    │                               │        │
    │                               └─> Assertions
    │                                       │
    └─> if (MCP_ENABLED) ───────────┘      │
            │                               │
            └─> MCP Helper Lib              │
                    │                       │
                    └─> MCP Server          │
                            │               │
                            └─> MCP Tools ──┘
                                    │
                                    └─> Enhanced Data
                                            │
                                            ├─> Accessibility Tree
                                            ├─> Console Logs
                                            ├─> Network Requests
                                            └─> Debug Artifacts
                                                    │
                                                    └─> Test Report
```

## Decision Flow

### When to Enable MCP?
```
                    Start Test
                         │
                         ▼
              ┌──────────────────────┐
              │ Is test failing?     │
              └──────────┬───────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
             YES                   NO
              │                     │
              ▼                     ▼
    ┌──────────────────┐   ┌──────────────────┐
    │ Need detailed    │   │ Standard         │
    │ debugging info?  │   │ Playwright test  │
    └─────────┬────────┘   └──────────────────┘
              │                     │
         ┌────┴────┐                │
        YES       NO                │
         │         │                │
         ▼         ▼                │
    ┌────────┐ ┌────────┐          │
    │ Enable │ │ Keep   │          │
    │  MCP   │ │  MCP   │          │
    │        │ │ disabled│         │
    └────────┘ └────────┘          │
         │         │                │
         └─────────┴────────────────┘
                   │
                   ▼
              Run Test
```

## Execution Comparison

### Standard Playwright (Default)
```
┌─────────────────────────────────────┐
│ Test Execution                      │
├─────────────────────────────────────┤
│                                     │
│ 1. Setup                 [0.5s]    │
│ 2. Navigate              [2.0s]    │
│ 3. Actions               [3.0s]    │
│ 4. Assertions            [1.0s]    │
│ 5. Screenshots (fail)    [0.5s]    │
│ 6. Cleanup               [0.5s]    │
│                                     │
│ Total: ~7.5 seconds                 │
│                                     │
│ ✅ Fast                             │
│ ✅ No approval needed               │
│ ✅ CI/CD compatible                 │
└─────────────────────────────────────┘
```

### With MCP Enabled (Debug Mode)
```
┌─────────────────────────────────────┐
│ Test Execution                      │
├─────────────────────────────────────┤
│                                     │
│ 1. Setup                 [0.5s]    │
│ 2. Navigate              [2.0s]    │
│    └─ MCP Snapshot       [+2.0s]   │ ◄── User approval
│ 3. Actions               [3.0s]    │
│ 4. Assertions            [1.0s]    │
│ 5. Screenshots (fail)    [0.5s]    │
│    └─ MCP Debug          [+5.0s]   │ ◄── Enhanced capture
│ 6. Cleanup               [0.5s]    │
│                                     │
│ Total: ~14.5 seconds                │
│                                     │
│ ⚠️ Slower (approval overhead)       │
│ ⚠️ Requires user interaction        │
│ ✅ Enhanced debugging data          │
│ ✅ Detailed analysis available      │
└─────────────────────────────────────┘
```

## Summary

### Architecture Principles

1. **Separation of Concerns**
   - Playwright handles automation
   - MCP provides optional analysis
   - Both can operate independently

2. **Optional Enhancement**
   - Tests work without MCP
   - MCP adds value when enabled
   - No breaking changes

3. **Graceful Degradation**
   - If MCP fails, test continues
   - Always have Playwright fallbacks
   - Error handling at all levels

4. **Environment-Based Control**
   - `MCP_ENABLED=true` to enable
   - Default is disabled
   - Easy to toggle per run

### Key Relationships

- **Playwright → Primary** (always used)
- **MCP → Optional** (used when needed)
- **Tests → Independent** (work with or without MCP)
- **Helpers → Abstracted** (hide complexity)

---

**Visual Legend:**
- `◄───` Primary flow
- `┌───┐` Component
- `[+Xs]` Added time
- `✨` Optional enhancement
- `✅` Advantage
- `⚠️` Consideration

**Last Updated:** February 24, 2026
