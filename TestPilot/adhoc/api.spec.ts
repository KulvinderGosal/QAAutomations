// Generic ad-hoc API request — the "test any endpoint" engine behind TestPilot's
// Manual Test "API request" mode. Uses Playwright's request fixture (no browser).
// Everything is parameterised via ADHOC_API_* env vars set by the runner
// middleware; any secret headers arrive by env for this one process only and are
// never logged or written to disk.
import { test, expect } from "@playwright/test";

const URL = process.env.ADHOC_API_URL || "";
const METHOD = (process.env.ADHOC_API_METHOD || "GET").toUpperCase();
const HEADERS_RAW = process.env.ADHOC_API_HEADERS || "";
const BODY = process.env.ADHOC_API_BODY || "";
const EXPECT_STATUS = process.env.ADHOC_API_EXPECT_STATUS || ""; // "" = assert 2xx
const MAX_MS = Number(process.env.ADHOC_API_MAX_MS || 0); // 0 = no SLA
const JSON_PATH = process.env.ADHOC_API_JSONPATH || ""; // e.g. data.plans.0.type
const JSON_VALUE = process.env.ADHOC_API_JSONVALUE || ""; // expected value at that path (string compare)
const CONTAINS = process.env.ADHOC_API_CONTAINS || ""; // substring the body must contain

/** Safe dot/index path lookup into a parsed JSON value. */
function atPath(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    const idx = Number(key);
    return Number.isInteger(idx) && Array.isArray(acc) ? acc[idx] : (acc as Record<string, unknown>)[key];
  }, obj);
}

test("ad-hoc API request", async ({ request }) => {
  test.skip(!URL, "ADHOC_API_URL not provided");

  let headers: Record<string, string> | undefined;
  if (HEADERS_RAW.trim()) {
    try {
      headers = JSON.parse(HEADERS_RAW) as Record<string, string>;
    } catch {
      throw new Error("Headers must be a valid JSON object (e.g. {\"Accept\":\"application/json\"}).");
    }
  }

  const started = Date.now();
  const res = await request.fetch(URL, {
    method: METHOD,
    headers,
    ...(BODY.trim() && METHOD !== "GET" && METHOD !== "HEAD" ? { data: BODY } : {}),
  });
  const ms = Date.now() - started;

  const status = res.status();
  const bodyText = await res.text();
  // Non-secret request/response summary → appears in the run terminal.
  console.log(`→ ${METHOD} ${URL}`);
  console.log(`← ${status} ${res.statusText()}  ·  ${ms}ms  ·  ${bodyText.length}B`);
  console.log(bodyText.length <= 2000 ? bodyText : `${bodyText.slice(0, 2000)}\n… (${bodyText.length}B total, truncated)`);

  await test.step(`status ${EXPECT_STATUS || "2xx"}`, async () => {
    if (EXPECT_STATUS) expect(status, `expected HTTP ${EXPECT_STATUS}`).toBe(Number(EXPECT_STATUS));
    else expect(res.ok(), `expected a 2xx status, got ${status}`).toBeTruthy();
  });

  if (MAX_MS > 0) {
    await test.step(`latency < ${MAX_MS}ms`, async () => {
      expect(ms, `responded in ${ms}ms (SLA ${MAX_MS}ms)`).toBeLessThan(MAX_MS);
    });
  }

  if (CONTAINS.trim()) {
    await test.step(`body contains "${CONTAINS}"`, async () => {
      expect(bodyText).toContain(CONTAINS);
    });
  }

  if (JSON_PATH.trim()) {
    await test.step(`json ${JSON_PATH}${JSON_VALUE ? ` === ${JSON_VALUE}` : " is present"}`, async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        throw new Error("Response body is not valid JSON, but a JSON path assertion was requested.");
      }
      const val = atPath(parsed, JSON_PATH.trim());
      if (JSON_VALUE.trim()) expect(String(val), `${JSON_PATH} value`).toBe(JSON_VALUE.trim());
      else expect(val, `${JSON_PATH} should be present`).toBeDefined();
    });
  }
});
