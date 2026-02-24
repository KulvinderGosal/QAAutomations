# Playwright Installation & Maintenance Guide

## Overview

This project uses a **single global Playwright installation** to avoid duplicate browser downloads and save disk space.

## Installation Location

- **Playwright Package**: `/Users/kulvindersingh/QA-Automation/node_modules/@playwright/test`
- **Browser Binaries**: `~/Library/Caches/ms-playwright/`
- **Current Version**: 1.58.2

## Initial Setup

```bash
# Install dependencies (includes Playwright)
npm install

# Browsers will be automatically installed via postinstall hook
# If not, manually install browsers:
npm run playwright:install
```

## Browser Management

### Check Playwright Status
```bash
npm run playwright:status
```
This shows:
- Current Playwright version
- Total disk space used by browsers

### Install Browsers Manually
```bash
# Install all browsers (chromium, firefox, webkit)
npm run playwright:install

# Install only chromium (recommended for CI/CD)
npx playwright install chromium

# Install system dependencies (Linux only)
npm run playwright:install:deps
```

### Clean Up Old Browsers
```bash
# Remove all old browser versions and reinstall latest
npm run playwright:clean
```

This is useful when:
- You've upgraded Playwright version
- Multiple browser versions are taking up space
- You want a fresh browser installation

## Current Browser Versions

As of Feb 24, 2026:
- Chromium: 1208
- Firefox: 1509
- WebKit: 2248
- FFmpeg: 1011

## Disk Space Management

### Before Cleanup
- **2.0 GB** - Multiple versions of each browser

### After Cleanup
- **1.0 GB** - Only latest versions kept
- **Saved: 1.0 GB** ✅

## Best Practices

### 1. **Use Single Installation**
- All tests use the same Playwright installation from `node_modules/@playwright/test`
- Never install Playwright in subdirectories or test folders
- Use `npx playwright` to ensure you're using the local installation

### 2. **Avoid Duplicate Installations**
```bash
# ❌ DON'T DO THIS
cd tests/some-folder
npm init
npm install @playwright/test

# ✅ DO THIS INSTEAD
# Always run tests from the project root
cd /Users/kulvindersingh/QA-Automation
npm test
```

### 3. **Regular Maintenance**
Run this monthly to keep your installation clean:
```bash
# Check current status
npm run playwright:status

# If you see multiple versions, clean up
npm run playwright:clean
```

### 4. **Version Consistency**
- Keep all Playwright packages at the same version
- Update package.json when upgrading:
```json
{
  "devDependencies": {
    "@playwright/test": "^1.58.2"
  }
}
```

## Troubleshooting

### Problem: "Browser executable not found"
**Solution:**
```bash
npm run playwright:install
```

### Problem: Multiple browser versions taking up space
**Solution:**
```bash
# Check current usage
npm run playwright:status

# Clean and reinstall
npm run playwright:clean
```

### Problem: Tests fail after upgrading Playwright
**Solution:**
```bash
# Reinstall browsers matching the new version
npm run playwright:clean
```

### Problem: Slow test execution
**Solution:**
```bash
# Check if you have too many browser versions
ls -la ~/Library/Caches/ms-playwright/

# Should only see latest versions (e.g., chromium-1208, not chromium-1187)
# If you see old versions, clean them up
npm run playwright:clean
```

## CI/CD Configuration

For CI/CD environments, use this approach:

```yaml
# .github/workflows/tests.yml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install chromium --with-deps

- name: Run tests
  run: npm test
```

**Note:** Only install `chromium` in CI/CD to save time and resources.

## Quick Reference Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install all dependencies including Playwright |
| `npm run playwright:status` | Check version and disk usage |
| `npm run playwright:install` | Install all browsers |
| `npm run playwright:clean` | Remove old browsers and reinstall |
| `npx playwright --version` | Check Playwright version |
| `npx playwright list` | List installed browsers |

## Environment-Specific Notes

### macOS (Current Setup)
- Browser cache: `~/Library/Caches/ms-playwright/`
- System dependencies: Automatically handled

### Linux
- Browser cache: `~/.cache/ms-playwright/`
- May need: `npm run playwright:install:deps`

### Windows
- Browser cache: `%USERPROFILE%\AppData\Local\ms-playwright\`
- System dependencies: Automatically handled

## Maintenance Schedule

- **Weekly**: Check `npm run playwright:status`
- **Monthly**: Run `npm run playwright:clean` if needed
- **After upgrades**: Always run `npm run playwright:clean`

## Support

For issues with Playwright installation:
1. Check [Playwright Documentation](https://playwright.dev/docs/intro)
2. Review this guide
3. Contact: kgosal@awesomemotive.com

---

**Last Updated**: February 24, 2026  
**Playwright Version**: 1.58.2  
**Maintained by**: Kulvinder Singh
