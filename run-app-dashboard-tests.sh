#!/bin/bash

###############################################################################
# PushEngage App Dashboard Test Runner
# Description: Run Playwright tests for PushEngage App Dashboard
# Usage: ./run-app-dashboard-tests.sh [options]
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
CONFIG="playwright-app-dashboard.config.js"
MODE="all"
HEADED=false
DEBUG=false
UI=false
REPORTER="list"

# Function to display usage
usage() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     PushEngage App Dashboard Test Runner                      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -m, --mode <mode>        Test mode: all, critical, high, medium, low,"
    echo "                           login, dashboard, campaign, design, audience,"
    echo "                           analytics, site-settings, chat-widgets, publisher"
    echo "  -h, --headed             Run tests in headed mode (show browser)"
    echo "  -d, --debug              Run tests in debug mode"
    echo "  -u, --ui                 Run tests in UI mode"
    echo "  -r, --report             Show HTML report after tests"
    echo "  --help                   Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 -m critical                        # Run critical tests only"
    echo "  $0 -m login -h                        # Run login tests in headed mode"
    echo "  $0 -m dashboard -d                    # Run dashboard tests in debug mode"
    echo "  $0 -m campaign --ui                   # Run campaign tests in UI mode"
    echo ""
    exit 0
}

# Function to display banner
banner() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     PushEngage App Dashboard Test Execution                   ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to run tests
run_tests() {
    local test_path=$1
    local description=$2
    
    echo -e "${GREEN}Running: ${description}${NC}"
    echo -e "${YELLOW}Test Path: ${test_path}${NC}"
    echo ""
    
    # Build command
    local cmd="npx playwright test --config=${CONFIG}"
    
    if [ "$HEADED" = true ]; then
        cmd="$cmd --headed"
    fi
    
    if [ "$DEBUG" = true ]; then
        cmd="$cmd --debug"
    fi
    
    if [ "$UI" = true ]; then
        cmd="$cmd --ui"
    fi
    
    cmd="$cmd ${test_path}"
    
    # Run tests
    echo -e "${BLUE}Executing: ${cmd}${NC}"
    echo ""
    eval $cmd
    
    local exit_code=$?
    
    echo ""
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ Tests completed successfully!${NC}"
    else
        echo -e "${RED}❌ Tests failed with exit code: ${exit_code}${NC}"
    fi
    
    return $exit_code
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -h|--headed)
            HEADED=true
            shift
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        -u|--ui)
            UI=true
            shift
            ;;
        -r|--report)
            SHOW_REPORT=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Display banner
banner

# Determine test path based on mode
case $MODE in
    all)
        TEST_PATH="tests/app-dashboard"
        DESCRIPTION="All App Dashboard Tests"
        ;;
    critical)
        TEST_PATH="tests/app-dashboard/critical"
        DESCRIPTION="Critical Priority Tests (P0)"
        ;;
    high)
        TEST_PATH="tests/app-dashboard/high"
        DESCRIPTION="High Priority Tests (P1)"
        ;;
    medium)
        TEST_PATH="tests/app-dashboard/medium"
        DESCRIPTION="Medium Priority Tests (P2)"
        ;;
    low)
        TEST_PATH="tests/app-dashboard/low"
        DESCRIPTION="Low Priority Tests (P3)"
        ;;
    login)
        TEST_PATH="tests/app-dashboard/*/login"
        DESCRIPTION="Login Module Tests"
        ;;
    dashboard)
        TEST_PATH="tests/app-dashboard/*/dashboard"
        DESCRIPTION="Dashboard Module Tests"
        ;;
    campaign)
        TEST_PATH="tests/app-dashboard/*/campaign"
        DESCRIPTION="Campaign Module Tests"
        ;;
    design)
        TEST_PATH="tests/app-dashboard/*/design"
        DESCRIPTION="Design Module Tests"
        ;;
    audience)
        TEST_PATH="tests/app-dashboard/*/audience"
        DESCRIPTION="Audience Module Tests"
        ;;
    analytics)
        TEST_PATH="tests/app-dashboard/*/analytics"
        DESCRIPTION="Analytics Module Tests"
        ;;
    site-settings)
        TEST_PATH="tests/app-dashboard/*/site-settings"
        DESCRIPTION="Site Settings Module Tests"
        ;;
    chat-widgets)
        TEST_PATH="tests/app-dashboard/*/chat-widgets"
        DESCRIPTION="Chat Widgets Module Tests"
        ;;
    publisher)
        TEST_PATH="tests/app-dashboard/*/publisher"
        DESCRIPTION="Publisher Module Tests"
        ;;
    *)
        echo -e "${RED}Invalid mode: ${MODE}${NC}"
        echo ""
        usage
        ;;
esac

# Run tests
run_tests "$TEST_PATH" "$DESCRIPTION"
EXIT_CODE=$?

# Show report if requested
if [ "$SHOW_REPORT" = true ] && [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}Opening HTML report...${NC}"
    npx playwright show-report test-results/app-dashboard-report
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Test Execution Complete                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

exit $EXIT_CODE
