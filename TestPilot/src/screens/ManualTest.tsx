import { useEffect, useState } from "react";
import { AlertTriangle, Bookmark, Check, Copy, FileCode, Globe, Loader2, Lock, Play, Save, Sparkles, Trash2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card, SegmentedControl } from "@/components/ui/primitives";
import { RunPanel } from "@/screens/runner/RunPanel";
import { timeAgo } from "@/lib/utils";
import type { SavedTest } from "@/lib/runner";
import { aiGenerateSpec, aiInterpret, aiSaveSpec, fetchAiStatus } from "@/lib/ai";

const ENVS = ["production", "staging", "local", "custom"];
const BROWSERS = ["chromium", "firefox", "webkit"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary";

export function ManualTest() {
  const adhocReady = useStore((s) => s.runnerAdhocReady);
  const loadRunnerFrameworks = useStore((s) => s.loadRunnerFrameworks);
  const startAdhocTest = useStore((s) => s.startAdhocTest);
  const run = useStore((s) => s.runnerRun);
  const runnerError = useStore((s) => s.runnerError);
  const savedTests = useStore((s) => s.savedTests);
  const saveManualTest = useStore((s) => s.saveManualTest);
  const deleteManualTest = useStore((s) => s.deleteManualTest);
  const runnerFrameworks = useStore((s) => s.runnerFrameworks);
  const pushToast = useStore((s) => s.pushToast);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [env, setEnv] = useState("staging");
  const [project, setProject] = useState("chromium");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [expectTitle, setExpectTitle] = useState("");
  const [expectText, setExpectText] = useState("");
  const [showCreds, setShowCreds] = useState(false);

  // ── API request mode ──────────────────────────────────────────────────────
  const [mode, setMode] = useState<"page" | "api">("page");
  const [method, setMethod] = useState("GET");
  const [apiHeaders, setApiHeaders] = useState("");
  const [apiBody, setApiBody] = useState("");
  const [expectStatus, setExpectStatus] = useState("");
  const [maxMs, setMaxMs] = useState("");
  const [jsonPath, setJsonPath] = useState("");
  const [jsonValue, setJsonValue] = useState("");
  const [contains, setContains] = useState("");

  // ── AI prompt state ─────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [aiSource, setAiSource] = useState<string | undefined>(undefined);
  const [aiBusy, setAiBusy] = useState<"interpret" | "generate" | "save" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [spec, setSpec] = useState<string | null>(null);
  const [specFilename, setSpecFilename] = useState("");
  const [saveFw, setSaveFw] = useState("");
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (adhocReady === null) void loadRunnerFrameworks();
  }, [adhocReady, loadRunnerFrameworks]);

  useEffect(() => {
    fetchAiStatus()
      .then((s) => {
        setAiReady(s.ready);
        setAiSource(s.source);
      })
      .catch(() => setAiReady(false));
  }, []);

  const SOURCE_LABEL: Record<string, string> = {
    key: "using .env key",
    token: "using .env auth token",
    env: "using env credentials",
    profile: "using ant auth login",
  };

  const running = run?.status === "running";
  const urlValid = /^https?:\/\/.+/i.test(url.trim());
  const notReady = !!adhocReady && !adhocReady.ready;
  const canRun = urlValid && !running && !notReady;
  const promptReady = aiReady !== false && !!prompt.trim() && aiBusy === null;

  // Launch: Claude interprets the instruction into generic-smoke config, fills
  // the form, and runs the ad-hoc smoke now. No code is generated or executed.
  const launchFromPrompt = async () => {
    if (!promptReady || !canRun) return;
    setAiBusy("interpret");
    setAiError(null);
    setAiSummary(null);
    try {
      const r = await aiInterpret({ prompt: prompt.trim(), url: url.trim() });
      if (r.expectTitle) setExpectTitle(r.expectTitle);
      if (r.expectText) setExpectText(r.expectText);
      if (r.loginUrl) {
        setLoginUrl(r.loginUrl);
        setShowCreds(true);
      }
      const runTitle = title.trim() || prompt.trim().slice(0, 60);
      if (!title.trim()) setTitle(runTitle);
      // Pass explicit AI-derived values — don't rely on the setState calls above
      // having flushed (React batches them). Only show the "started the run"
      // summary if the run actually started.
      const started = await startAdhocTest({
        title: runTitle || undefined,
        url: url.trim(),
        project,
        env,
        loginUrl: (r.loginUrl ?? loginUrl).trim() || undefined,
        user: user || undefined,
        pass: pass || undefined,
        expectTitle: (r.expectTitle ?? expectTitle).trim() || undefined,
        expectText: (r.expectText ?? expectText).trim() || undefined,
      });
      if (started) setAiSummary(r.summary);
      else
        setAiError(
          useStore.getState().runnerError ??
            "Interpreted the instruction, but the run didn't start (another run may already be in progress).",
        );
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(null);
    }
  };

  // Generate: Claude writes a full Playwright spec to review / copy / save.
  const generateFromPrompt = async () => {
    if (!promptReady || !urlValid) return;
    setAiBusy("generate");
    setAiError(null);
    setSpec(null);
    setSavedPath(null);
    try {
      const r = await aiGenerateSpec({ prompt: prompt.trim(), url: url.trim() });
      setSpec(r.spec);
      setSpecFilename(r.filename);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(null);
    }
  };

  const copySpec = async () => {
    if (!spec) return;
    try {
      await navigator.clipboard.writeText(spec);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const saveSpecToFramework = async () => {
    if (!spec || !saveFw || aiBusy) return;
    setAiBusy("save");
    setAiError(null);
    try {
      const r = await aiSaveSpec({ frameworkId: saveFw, filename: specFilename, spec });
      setSavedPath(r.path);
      pushToast({ icon: "generate", title: "Spec saved for review", subtitle: r.path });
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(null);
    }
  };

  const submit = () => {
    if (!canRun) return;
    void startAdhocTest({
      title: title.trim() || undefined,
      url: url.trim(),
      project,
      env,
      loginUrl: loginUrl.trim() || undefined,
      user: user || undefined,
      pass: pass || undefined,
      expectTitle: expectTitle.trim() || undefined,
      expectText: expectText.trim() || undefined,
    });
  };

  const submitApi = () => {
    if (!canRun) return;
    void startAdhocTest({
      title: title.trim() || undefined,
      url: url.trim(),
      env,
      kind: "api",
      method,
      headers: apiHeaders.trim() || undefined,
      body: apiBody.trim() || undefined,
      expectStatus: expectStatus.trim() || undefined,
      maxMs: maxMs.trim() || undefined,
      jsonPath: jsonPath.trim() || undefined,
      jsonValue: jsonValue.trim() || undefined,
      contains: contains.trim() || undefined,
    });
  };

  const save = () => {
    if (!urlValid) return;
    let name = title.trim();
    if (!name) {
      name = url.trim();
      try {
        name = new URL(url.trim()).host;
      } catch {
        /* keep the raw url */
      }
    }
    saveManualTest({
      name,
      url: url.trim(),
      env,
      project,
      loginUrl: loginUrl.trim() || undefined,
      user: user || undefined,
      expectTitle: expectTitle.trim() || undefined,
      expectText: expectText.trim() || undefined,
    });
    pushToast({ icon: "check", title: "Target saved", subtitle: name });
  };

  const load = (t: SavedTest) => {
    setTitle(t.name ?? "");
    setUrl(t.url);
    setEnv(t.env ?? "staging");
    setProject(t.project ?? "chromium");
    setLoginUrl(t.loginUrl ?? "");
    setUser(t.user ?? "");
    setExpectTitle(t.expectTitle ?? "");
    setExpectText(t.expectText ?? "");
    setPass(""); // never stored — re-enter
    if (t.user) setShowCreds(true);
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="m-0 text-[24px] font-bold tracking-tight">Manual Test</h1>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          On-demand checks, run by TestPilot's own Playwright. <b className="text-ink-2">Page test</b> loads a URL in a
          headless browser (status, redirects, title, console errors, screenshot). <b className="text-ink-2">API request</b>{" "}
          hits any endpoint and asserts status, latency, JSON path, or body — no browser.
        </p>
      </div>

      {adhocReady && !adhocReady.ready && (
        <Card className="mb-4 flex items-center gap-2.5 border-[color-mix(in_srgb,var(--warning)_40%,transparent)] p-3.5 text-[13px] text-warning">
          <AlertTriangle size={15} className="shrink-0" /> {adhocReady.problem}
        </Card>
      )}
      {runnerError && (
        <Card className="mb-4 flex items-center gap-2.5 border-[color-mix(in_srgb,var(--destructive)_35%,transparent)] p-3.5 text-[13px] text-destructive">
          <AlertTriangle size={15} className="shrink-0" /> {runnerError}
        </Card>
      )}

      {/* Ask AI — plain-English prompt → launch a smoke now, or generate a spec */}
      <Card className="mb-[18px] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles size={16} className="text-primary" />
          <h2 className="m-0 text-[15px] font-semibold">Ask AI</h2>
          <span className="text-[12px] text-muted-foreground">describe a check in plain English</span>
          {aiReady === false && (
            <span className="ml-auto rounded-chip bg-surface-3 px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
              add a key to .env or run: ant auth login
            </span>
          )}
          {aiReady === true && aiSource && aiSource !== "none" && (
            <span className="ml-auto rounded-chip bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
              {SOURCE_LABEL[aiSource] ?? "ready"}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <textarea
            className={`${inputCls} min-h-[76px] resize-y`}
            placeholder="e.g. Log in, open the Pricing page, and check the Enterprise plan card and the 'Contact sales' button are visible."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={aiReady === false}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={!promptReady || !canRun} onClick={launchFromPrompt} title="Interpret the instruction and run the smoke now">
              {aiBusy === "interpret" ? <Loader2 size={14} className="cp-spin" /> : <Play size={14} />}
              Launch test
            </Button>
            <Button variant="outline" disabled={!promptReady || !urlValid} onClick={generateFromPrompt} title="Write a Playwright spec from the instruction">
              {aiBusy === "generate" ? <Loader2 size={14} className="cp-spin" /> : <FileCode size={14} />}
              Generate spec
            </Button>
            <span className="text-[11.5px] text-muted-foreground">
              Launch = interpret &amp; run now · Generate = write a spec to review
            </span>
          </div>

          {aiError && (
            <div className="flex items-center gap-2 rounded-control border border-[color-mix(in_srgb,var(--destructive)_35%,transparent)] px-3 py-2 text-[12.5px] text-destructive">
              <AlertTriangle size={14} className="shrink-0" /> {aiError}
            </div>
          )}
          {aiSummary && (
            <div className="rounded-control border border-border bg-surface-1 px-3 py-2 text-[12.5px] text-ink-2">
              <b className="font-semibold text-ink-1">Interpreted:</b> {aiSummary} — filled the form below and started the run.
            </div>
          )}

          {spec && (
            <div className="overflow-hidden rounded-control border border-border">
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-1 px-3 py-2">
                <FileCode size={13} className="text-muted-foreground" />
                <span className="font-mono text-[12px] text-ink-1">{specFilename}</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={copySpec}
                    className="flex items-center gap-1 rounded-control border border-border px-2 py-1 text-[11.5px] text-ink-2 hover:bg-surface-2"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                  </button>
                  <select
                    value={saveFw}
                    onChange={(e) => setSaveFw(e.target.value)}
                    className="rounded-control border border-border bg-card px-2 py-1 text-[11.5px] text-ink-1 outline-none"
                  >
                    <option value="">Save to framework…</option>
                    {(runnerFrameworks ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" disabled={!saveFw || aiBusy !== null} onClick={saveSpecToFramework}>
                    {aiBusy === "save" ? <Loader2 size={12} className="cp-spin" /> : <Save size={12} />} Save
                  </Button>
                </div>
              </div>
              <pre className="max-h-[340px] overflow-auto bg-[oklch(0.17_0.01_265)] px-3 py-3 font-mono text-[11.5px] leading-[1.55] text-[oklch(0.9_0.008_265)]">
                {spec}
              </pre>
              {savedPath && (
                <div className="border-t border-border bg-surface-1 px-3 py-2 text-[11.5px] text-ink-2">
                  Saved to <span className="font-mono">{savedPath}</span> — review it, then commit it into the framework
                  yourself (nothing is auto-committed).
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-[18px]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Globe size={16} className="text-muted-foreground" />
            <h2 className="m-0 text-[15px] font-semibold">Target</h2>
            <div className="ml-auto">
              <SegmentedControl<"page" | "api">
                value={mode}
                onChange={setMode}
                options={[
                  { value: "page", label: "Page test" },
                  { value: "api", label: "API request" },
                ]}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3.5 p-4">
            <Field label="Title" hint="A name for this test (used when you save it)">
              <input
                className={inputCls}
                placeholder="e.g. Pricing page smoke"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field
              label={mode === "api" ? "Endpoint URL" : "Website URL"}
              hint={mode === "api" ? "Full URL of the API endpoint" : "Full URL including https://"}
            >
              <input
                className={inputCls}
                placeholder={mode === "api" ? "https://api.example.com/v1/resource" : "https://staging.example.com/dashboard"}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Environment">
                <select className={inputCls} value={env} onChange={(e) => setEnv(e.target.value)}>
                  {ENVS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              {mode === "page" ? (
                <Field label="Browser">
                  <select className={inputCls} value={project} onChange={(e) => setProject(e.target.value)}>
                    {BROWSERS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Method">
                  <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                    {METHODS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            {mode === "page" && (
              <>
            <div className="rounded-control border border-border">
              <button
                type="button"
                onClick={() => setShowCreds((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-ink-2"
              >
                <Lock size={13} className="text-muted-foreground" />
                Credentials (optional — best-effort login)
                <span className="ml-auto text-[11px] text-muted-foreground">{showCreds ? "hide" : "show"}</span>
              </button>
              {showCreds && (
                <div className="flex flex-col gap-3 border-t border-border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Username / email">
                      <input
                        className={inputCls}
                        autoComplete="off"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                      />
                    </Field>
                    <Field label="Password">
                      <input
                        className={inputCls}
                        type="password"
                        autoComplete="off"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Login URL" hint="Optional — where the login form lives, if not the target URL">
                    <input
                      className={inputCls}
                      placeholder="https://staging.example.com/login"
                      value={loginUrl}
                      onChange={(e) => setLoginUrl(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <Lock size={12} className="mt-0.5 shrink-0" />
                    Used for this run only — sent to the local server, passed to the browser process, never saved to disk
                    or the page URL.
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Expect title contains" hint="Optional">
                <input className={inputCls} value={expectTitle} onChange={(e) => setExpectTitle(e.target.value)} />
              </Field>
              <Field label="Expect page text" hint="Optional">
                <input className={inputCls} value={expectText} onChange={(e) => setExpectText(e.target.value)} />
              </Field>
            </div>
              </>
            )}

            {mode === "api" && (
              <>
                <Field
                  label="Headers"
                  hint="Optional JSON object — put auth here (Authorization, api-key) or a browser User-Agent if the API is behind Cloudflare."
                >
                  <textarea
                    className={inputCls}
                    rows={3}
                    placeholder={'{"Accept":"application/json"}'}
                    value={apiHeaders}
                    onChange={(e) => setApiHeaders(e.target.value)}
                  />
                </Field>
                {method !== "GET" && method !== "HEAD" && (
                  <Field label="Request body" hint="Sent with the request (JSON or raw text)">
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder={'{"key":"value"}'}
                      value={apiBody}
                      onChange={(e) => setApiBody(e.target.value)}
                    />
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Expect status" hint="Blank asserts any 2xx">
                    <input className={inputCls} placeholder="200" value={expectStatus} onChange={(e) => setExpectStatus(e.target.value)} />
                  </Field>
                  <Field label="Max time (ms)" hint="Optional latency SLA">
                    <input className={inputCls} placeholder="3000" value={maxMs} onChange={(e) => setMaxMs(e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Assert JSON path" hint="Optional, e.g. data.plans.0.type">
                    <input className={inputCls} placeholder="data.0.id" value={jsonPath} onChange={(e) => setJsonPath(e.target.value)} />
                  </Field>
                  <Field label="Equals value" hint="Blank = just require it present">
                    <input className={inputCls} value={jsonValue} onChange={(e) => setJsonValue(e.target.value)} />
                  </Field>
                </div>
                <Field label="Body contains" hint="Optional substring the response must contain">
                  <input className={inputCls} value={contains} onChange={(e) => setContains(e.target.value)} />
                </Field>
              </>
            )}

            <div className="flex items-center gap-2 border-t border-border pt-3.5">
              <Button variant="primary" disabled={!canRun} onClick={mode === "api" ? submitApi : submit}>
                {running ? <Loader2 size={14} className="cp-spin" /> : <Play size={14} />}
                {running ? "Running…" : mode === "api" ? "Send request" : "Run test"}
              </Button>
              {mode === "page" && (
                <Button variant="outline" disabled={!urlValid} onClick={save} title="Save these values to rerun later">
                  <Bookmark size={13} /> Save
                </Button>
              )}
              {!urlValid && (
                <span className="text-[11.5px] text-warning">
                  {url.length > 0 ? "Enter a full http(s):// URL to run or save" : "Enter a Website URL to run or save"}
                </span>
              )}
            </div>
          </div>

          {savedTests.length > 0 && (
            <Card className="mt-[18px] overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <Bookmark size={14} className="text-muted-foreground" />
                <h2 className="m-0 text-[13.5px] font-semibold">Saved targets</h2>
                <span className="text-[11.5px] text-muted-foreground">rerun a saved test</span>
              </div>
              <div className="flex flex-col">
                {savedTests.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-1"
                  >
                    <button onClick={() => load(t)} className="min-w-0 flex-1 text-left" title="Load into the form">
                      <div className="truncate text-[13px] font-medium text-ink-1">{t.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 truncate font-mono text-[11px] text-muted-foreground">
                        <span className="truncate">{t.url}</span>
                        <span className="shrink-0">· {t.env ?? "staging"} · {t.project ?? "chromium"}</span>
                        {t.user && <span className="shrink-0">· 🔑 {t.user}</span>}
                      </div>
                    </button>
                    <span className="shrink-0 text-[10.5px] text-muted-foreground">{timeAgo(t.savedAt)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={running || notReady}
                      onClick={() => {
                        load(t);
                        // Login-gated targets never persist the password, so a one-click
                        // run would go out unauthenticated and hit the login wall. Instead
                        // load() reveals the credentials form (setShowCreds) — the user
                        // enters the password and runs from the main form.
                        if (t.user) return;
                        // startAdhocTest reads current form via submit; load() is sync-batched,
                        // so start with the saved values directly.
                        void startAdhocTest({
                          title: t.name,
                          url: t.url,
                          project: t.project,
                          env: t.env,
                          loginUrl: t.loginUrl,
                          expectTitle: t.expectTitle,
                          expectText: t.expectText,
                        });
                      }}
                      title={t.user ? "Loads the target — enter the password below, then Run test" : "Rerun this saved target"}
                    >
                      <Play size={12} /> Run
                    </Button>
                    <button
                      onClick={() => deleteManualTest(t.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border text-muted-foreground hover:bg-surface-2"
                      title="Delete saved target"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                Passwords are never saved — re-enter before running a login-gated target.
              </div>
            </Card>
          )}
        </Card>

        <RunPanel />
      </div>
    </div>
  );
}
