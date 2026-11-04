/**
 * Test-site fixtures. All come from .env so the same cases run against any test site.
 * See the "PushEngage MCP QA" block in .env.example.
 */
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);

/** Swap two adjacent letters in the middle of the name: "Sports Fans" -> "Sprots Fans". */
function misspell(name) {
  if (!name) return name;
  const chars = [...name];
  for (let i = Math.max(1, Math.floor(chars.length / 3)); i < chars.length - 1; i++) {
    if (/[a-z]/i.test(chars[i]) && /[a-z]/i.test(chars[i + 1]) && chars[i].toLowerCase() !== chars[i + 1].toLowerCase()) {
      [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
      return chars.join('');
    }
  }
  return `${name}xq`;
}

const segment1 = env('PE_MCP_SEGMENT_1');
const country1 = env('PE_MCP_COUNTRY_1');

const fixtures = {
  segment1,
  segment2: env('PE_MCP_SEGMENT_2'),
  pausedSegment: env('PE_MCP_PAUSED_SEGMENT'),
  misspelledSegment: env('PE_MCP_MISSPELLED_SEGMENT', misspell(segment1)),
  attributeName: env('PE_MCP_ATTRIBUTE_NAME'),
  attributeValue: env('PE_MCP_ATTRIBUTE_VALUE'),
  country1,
  country2: env('PE_MCP_COUNTRY_2'),
  misspelledCountry: env('PE_MCP_MISSPELLED_COUNTRY', misspell(country1)),
  device: env('PE_MCP_DEVICE', 'mobile'),
  browser: env('PE_MCP_BROWSER', 'Chrome'),
  audienceGroup: env('PE_MCP_AUDIENCE_GROUP'),
  url: env('PE_MCP_NOTIFICATION_URL', 'https://example.com/?utm_source=qa-mcp-287'),
  runId: env('PE_MCP_RUN_ID', new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')),
};

/** Unique, searchable title so each case's notification is easy to find in the dashboard. */
function titleFor(caseId) {
  return `[QA-287 ${caseId}] ${fixtures.runId}`;
}

/** Names of fixtures a case needs that are not set. */
function missingFixtures(keys) {
  return keys.filter((k) => !fixtures[k]);
}

module.exports = { fixtures, titleFor, missingFixtures, misspell };
