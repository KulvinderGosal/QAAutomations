#!/bin/bash

# PushEngage QA Automation - Test Runner Script
# Usage: ./run-tests.sh [test-type] [options]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEST_TYPE=${1:-all}
REPORT_DIR="$SCRIPT_DIR/test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   PushEngage QA Automation Framework   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if .env exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo -e "${YELLOW}   Copying .env.example to .env${NC}"
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo -e "${YELLOW}   Please update .env with your credentials${NC}"
    exit 1
fi

# Load environment
export $(cat "$SCRIPT_DIR/.env" | xargs)

# Help function
show_help() {
    cat << 'HELP'
Usage: ./run-tests.sh [test-type] [options]

Test Types:
  all                 - Run all tests
  smoke               - Run smoke tests only
  plugin              - Run WordPress plugin tests only
  headed              - Run tests in headed mode (visible browser)
  debug               - Run tests in debug mode
  chrome              - Run tests on Chrome only
  firefox             - Run tests on Firefox only
  webkit              - Run tests on Safari only

Options:
  --help              - Show this help message
  --report            - Show test report after completion
  --no-parallel       - Run tests sequentially (slower)

Examples:
  ./run-tests.sh smoke
  ./run-tests.sh plugin --headed
  ./run-tests.sh all --report
  ./run-tests.sh chrome --no-parallel

HELP
}

# Run tests based on type
run_tests() {
    local test_type=$1
    local extra_args=""
    
    case "$test_type" in
        all)
            echo -e "${BLUE}Running ALL tests...${NC}\n"
            npm run test
            ;;
        smoke)
            echo -e "${BLUE}Running SMOKE tests...${NC}\n"
            npm run test:smoke
            ;;
        plugin)
            echo -e "${BLUE}Running WORDPRESS PLUGIN tests...${NC}\n"
            npm run test:wordpress-plugin
            ;;
        headed)
            echo -e "${BLUE}Running tests in HEADED mode...${NC}\n"
            npm run test:headed
            ;;
        debug)
            echo -e "${BLUE}Running tests in DEBUG mode...${NC}\n"
            npm run test:debug
            ;;
        chrome)
            echo -e "${BLUE}Running tests on CHROME only...${NC}\n"
            npm run test:chrome
            ;;
        firefox)
            echo -e "${BLUE}Running tests on FIREFOX only...${NC}\n"
            npm run test:firefox
            ;;
        webkit)
            echo -e "${BLUE}Running tests on WEBKIT only...${NC}\n"
            npm run test:webkit
            ;;
        --help)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown test type: $test_type${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Check for options
check_options() {
    for arg in "$@"; do
        case "$arg" in
            --help)
                show_help
                exit 0
                ;;
            --report)
                echo -e "\n${BLUE}Opening test report...${NC}"
                sleep 2
                npm run report
                ;;
            --no-parallel)
                echo -e "${YELLOW}Sequential mode enabled (slower)${NC}\n"
                ;;
        esac
    done
}

# Main execution
echo -e "${GREEN}Environment: ${WP_ADMIN_URL}${NC}"
echo -e "${GREEN}Username: ${WP_USERNAME}${NC}"
echo -e "${GREEN}Plugin: ${PLUGIN_NAME}${NC}"
echo ""

run_tests "$TEST_TYPE"
check_options "$@"

echo -e "\n${GREEN}✓ Test execution completed!${NC}"
echo -e "${BLUE}Reports available at: $REPORT_DIR${NC}"
