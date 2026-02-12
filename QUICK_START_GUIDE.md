# ⚡ Quick Start Guide - PushEngage QA Automation

Get up and running in **5 minutes**!

## 1️⃣ Prerequisites Check

```bash
# Check Node.js version (need 16.x or higher)
node --version
npm --version

# If not installed, install Node.js first
# macOS: brew install node
# Ubuntu: sudo apt-get install nodejs npm
# Windows: https://nodejs.org/
```

## 2️⃣ Clone & Setup (2 minutes)

```bash
# Clone the repository
git clone https://github.com/KulvinderGosal/PushEngage-bugs-and-issues.git
cd PushEngage-bugs-and-issues

# Install dependencies (takes ~1-2 minutes)
npm install

# Install Playwright browsers (takes ~3-5 minutes)
npx playwright install --with-deps
```

## 3️⃣ Configure Credentials (1 minute)

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# macOS/Linux:
nano .env

# Windows:
notepad .env
```

Your `.env` should look like:
```env
WP_ADMIN_URL=https://qastaging.pushengage.com/admin
WP_USERNAME=kgosal
WP_PASSWORD=!letmeIn@123=
PLUGIN_NAME=PushEngage
PLUGIN_SEARCH_TERM=pushengage
TEST_TIMEOUT=30000
HEADLESS=true
```

## 4️⃣ Run Your First Test (1 minute)

### Option A: Using the Bash Script (Easiest)

```bash
# Make script executable
chmod +x run-tests.sh

# Run smoke tests
./run-tests.sh smoke

# Or run plugin-specific tests
./run-tests.sh plugin

# Or run ALL tests
./run-tests.sh all
```

### Option B: Using NPM Scripts

```bash
npm run test:smoke
npm run test:wordpress-plugin
npm run test
```

### Option C: See Tests in Browser (Recommended for First Time)

```bash
./run-tests.sh headed
# or
npm run test:headed
```

This opens a real browser window where you can watch the tests execute!

## 5️⃣ View Results

After tests complete:

```bash
# Open HTML report in browser
npm run report

# Or find results in
# - test-results/index.html (open in browser)
# - test-results/results.json (detailed results)
# - test-results/junit.xml (for CI/CD)
```

---

## 🎯 Common Commands Cheat Sheet

| Task | Command |
|------|---------|
| Install everything | `npm install && npx playwright install` |
| Run all tests | `./run-tests.sh all` |
| Run with visible browser | `./run-tests.sh headed` |
| Debug a single test | `./run-tests.sh debug` |
| Run plugin tests only | `./run-tests.sh plugin` |
| Test specific browser | `./run-tests.sh chrome` |
| View test report | `npm run report` |
| Show help | `./run-tests.sh --help` |

---

## ✅ Test What's Included

Your automated tests verify:

### ✨ General WordPress (9 tests)
- Admin dashboard loads
- Navigation menu works
- Posts page accessible
- Pages page accessible
- Users page accessible
- Settings page accessible
- No PHP errors
- Page performance
- Logout works

### 🎯 PushEngage Plugin (10 tests)
- Login succeeds
- Plugin page loads
- **Plugin is searchable**
- Plugin info displays
- Plugin status (active/inactive)
- Plugin actions visible
- Plugin settings accessible
- No plugin errors
- Compatibility check
- No JavaScript errors

---

## 🐛 Something Not Working?

### Can't login?
```bash
# Check credentials
cat .env

# Test manually: https://qastaging.pushengage.com/admin
# Run with browser visible to see what's happening
./run-tests.sh headed
```

### Timeout error?
```bash
# Increase timeout in .env
# Change TEST_TIMEOUT=30000 to TEST_TIMEOUT=60000
nano .env
```

### Playwright not found?
```bash
# Reinstall browsers
npx playwright install --with-deps
```

### Permission denied on run-tests.sh?
```bash
# Make script executable
chmod +x run-tests.sh
```

---

## 🚀 Next: Set Up GitHub Actions (CI/CD)

Once local tests work, automate in GitHub:

1. Go to your GitHub repo Settings
2. Click **Secrets and variables → Actions**
3. Add these secrets:
   - `WP_ADMIN_URL` = `https://qastaging.pushengage.com/admin`
   - `WP_USERNAME` = your username
   - `WP_PASSWORD` = your password
   - `PLUGIN_NAME` = `PushEngage`
   - `PLUGIN_SEARCH_TERM` = `pushengage`

4. Push to GitHub and watch **Actions** tab for automated tests!

---

## 📚 Where to Go Next

- **More Details**: Read `README.md`
- **Add Custom Tests**: Edit `tests/wordpress-plugin/plugin-smoke-test.spec.js`
- **Playwright Docs**: https://playwright.dev
- **Report Issues**: Open GitHub issue

---

## 💡 Pro Tips

1. **Watch tests in real-time**: Use `./run-tests.sh headed` to see browser
2. **Debug issues**: Use `./run-tests.sh debug` to step through tests
3. **Fastest tests**: Use `npm run test:chrome` (Chrome only, no Firefox/Safari)
4. **CI/CD status**: Check GitHub Actions tab after pushing

---

**You're all set!** 🎉 Your automated testing is now ready to run with every release.
