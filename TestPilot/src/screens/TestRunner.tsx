import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Copy, FlaskConical, FolderGit2, GitCommitHorizontal, KeyRound, Loader2, Play, RefreshCw, Zap } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card, Chip } from "@/components/ui/primitives";
import { BRAND_TONE } from "@/lib/tone";
import { RunPanel } from "@/screens/runner/RunPanel";
import { fetchLatestCommit, type RepoCommit } from "@/lib/github";
import { timeAgo } from "@/lib/utils";
import type { RunnerFramework, RunnerSpec } from "@/lib/runner";
import {
  fetchSessions,
  probeSessionNow,
  SESSIONS_CHANGED_EVENT,
  type SessionProbe,
  type SessionSeverity,
  type SessionsResponse,
  type SessionView,
} from "@/lib/sessions";

// I1: visual tone per persona probe severity (server/sessions.ts severityOf).
const SEVERITY_TONE: Record<SessionSeverity, { label: string; cls: string; dot: string }> = {
  ok: { label: "OK", cls: "text-success", dot: "bg-success" },
  warn: { label: "Check", cls: "text-warning", dot: "bg-warning" },
  block: { label: "Needs a human", cls: "text-destructive", dot: "bg-destructive" },
};

/** Cookie codes a single read-only --live GET can confirm (never offered for production). */
const LIVE_CONFIRMABLE = new Set(["stale-session-cookie", "unverified-session-cookie"]);

function fmtWhen(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const m = Math.round(Math.abs(t - Date.now()) / 60_000);
  const span = m < 60 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  return t > Date.now() ? `in ${span}` : `${span} ago`;
}

function identityText(id: Record<string, string | undefined>): string {
  return ["email", "store", "account", "site"]
    .filter((k) => id[k])
    .map((k) => `${k} ${id[k]}`)
    .join(" · ");
}

export function TestRunner() {
  const frameworks = useStore((s) => s.runnerFrameworks);
  const runnerError = useStore((s) => s.runnerError);
  const specsByFw = useStore((s) => s.runnerSpecs);
  const specsLoading = useStore((s) => s.runnerSpecsLoading);
  const run = useStore((s) => s.runnerRun);
  const loadRunnerFrameworks = useStore((s) => s.loadRunnerFrameworks);
  const loadRunnerSpecs = useStore((s) => s.loadRunnerSpecs);
  const startPlaywrightRun = useStore((s) => s.startPlaywrightRun);
  const brand = useStore((s) => s.brand);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // I1 persona probe state (GET /api/sessions — stale entries are re-probed offline).
  const [sessions, setSessions] = useState<SessionsResponse | null>(null);
  const [sessionsErr, setSessionsErr] = useState<string | null>(null);
  const loadSessions = () =>
    fetchSessions()
      .then((r) => {
        setSessions(r);
        setSessionsErr(null);
      })
      .catch((e: unknown) => setSessionsErr((e as Error).message));
  useEffect(() => {
    void loadSessions();
  }, []);
  const [env, setEnv] = useState<string>("");
  const [project, setProject] = useState<string>("");

  useEffect(() => {
    if (!frameworks) void loadRunnerFrameworks();
  }, [frameworks, loadRunnerFrameworks]);

  // The header brand tab scopes the runner: "All" shows everything, otherwise
  // only that brand's frameworks (PushEngage tab → PushEngage, etc.).
  const visibleFrameworks = (frameworks ?? []).filter((f) => brand === "all" || f.brand === brand);

  // Derive the selected framework from the VISIBLE set so switching the brand tab
  // hides its detail panel in the same render its card disappears (no one-frame
  // flash). selectedId is preserved, so switching back to "All" re-reveals it.
  const selected = visibleFrameworks.find((f) => f.id === selectedId) ?? null;
  const specs = selectedId ? specsByFw[selectedId] : undefined;
  const running = run?.status === "running";

  const pick = (fw: RunnerFramework) => {
    setSelectedId(fw.id);
    setEnv(fw.defaultEnv ?? "");
    setProject(fw.projects.length > 1 ? fw.projects[0] : "");
    // An unhealthy framework can't list specs — the card shows its problem instead.
    if (fw.healthy && !specsByFw[fw.id]) void loadRunnerSpecs(fw.id);
  };

  const start = (mode: "spec" | "smoke" | "full", spec?: string) => {
    if (!selected || running) return;
    void startPlaywrightRun({
      framework: selected.id,
      mode,
      spec,
      project: project || undefined,
      env: env || undefined,
    });
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="m-0 text-[24px] font-bold tracking-tight">Test Runner</h1>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          Run any Playwright test across the product frameworks — a single spec, the smoke set, or full regression.
          Runs execute locally with each framework's own Playwright, one at a time. The header tab scopes this list by
          brand.
        </p>
      </div>

      {runnerError && (
        <Card className="mb-4 flex items-center gap-2.5 border-[color-mix(in_srgb,var(--destructive)_35%,transparent)] p-3.5 text-[13px] text-destructive">
          <AlertTriangle size={15} className="shrink-0" /> {runnerError}
        </Card>
      )}

      <SessionsPanel
        frameworks={visibleFrameworks}
        data={sessions}
        error={sessionsErr}
        onReload={() => void loadSessions()}
        onProbed={(p) =>
          setSessions((cur) =>
            cur
              ? {
                  ...cur,
                  sessions: cur.sessions.map((s) => (s.persona === p.persona ? { ...s, probe: p, probeAgeSec: 0 } : s)),
                  blocking: cur.sessions.filter((s) => (s.persona === p.persona ? p : s.probe)?.severity === "block").length,
                }
              : cur,
          )
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        {visibleFrameworks.map((fw) => (
          <FrameworkCard
            key={fw.id}
            fw={fw}
            active={fw.id === selectedId}
            onPick={() => pick(fw)}
            probe={sessions?.sessions.find((s) => s.persona === `${fw.id}:${fw.defaultEnv}`)?.probe ?? null}
          />
        ))}
        {!frameworks && (
          <Card className="col-span-3 flex items-center justify-center gap-2 p-8 text-[13px] text-muted-foreground">
            <Loader2 size={15} className="cp-spin" /> Checking frameworks…
          </Card>
        )}
        {frameworks && visibleFrameworks.length === 0 && (
          <Card className="col-span-3 p-8 text-center text-[13px] text-muted-foreground">
            No {brand} frameworks registered.
          </Card>
        )}
      </div>

      {selected && (
        <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start gap-[18px]">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
              <h2 className="m-0 text-[15px] font-semibold">{selected.label}</h2>
              <span className="text-[11.5px] text-muted-foreground">
                {specs ? `${specs.length} tests · ${new Set(specs.map((s) => s.file)).size} spec files` : ""}
              </span>
              <span className="flex-1" />
              {selected.envVar && (
                <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                  {selected.envVar}
                  <select
                    value={env}
                    onChange={(e) => setEnv(e.target.value)}
                    className="rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1 outline-none"
                  >
                    {selected.envOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selected.projects.length > 1 && (
                <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                  project
                  <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className="rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1 outline-none"
                  >
                    {selected.projects.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option value="all">all projects</option>
                  </select>
                </label>
              )}
              <Button variant="outline" size="sm" disabled={running || !selected.healthy} onClick={() => start("smoke")}>
                <Zap size={13} /> Smoke
              </Button>
              <Button variant="primary" size="sm" disabled={running || !selected.healthy} onClick={() => start("full")}>
                <FlaskConical size={13} /> Full regression
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={specsLoading === selected.id}
                onClick={() => void loadRunnerSpecs(selected.id, true)}
                title="Re-list specs from disk"
              >
                <RefreshCw size={13} className={specsLoading === selected.id ? "cp-spin" : ""} />
              </Button>
            </div>

            {!selected.healthy ? (
              <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-warning">
                <AlertTriangle size={15} /> {selected.problem}
              </div>
            ) : specsLoading === selected.id && !specs ? (
              <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground">
                <Loader2 size={15} className="cp-spin" /> Listing specs (playwright --list)…
              </div>
            ) : specs && specs.length > 0 ? (
              <SpecTree specs={specs} running={running} onRunSpec={(spec) => start("spec", spec)} />
            ) : specs ? (
              <div className="px-4 py-6 text-[13px] text-muted-foreground">No specs found.</div>
            ) : (
              <div className="flex flex-col items-start gap-2 px-4 py-6 text-[13px] text-warning">
                <span className="flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" /> Couldn't list this framework's specs
                  {runnerError ? ` — ${runnerError}` : "."}
                </span>
                <Button variant="outline" size="sm" onClick={() => void loadRunnerSpecs(selected.id, true)}>
                  <RefreshCw size={13} /> Retry listing
                </Button>
              </div>
            )}
          </Card>

          <RunPanel />
        </div>
      )}
      {/* A re-attached in-flight run (e.g. after a page reload) must stay
          visible even before any framework card is picked. */}
      {!selected && run && <RunPanel />}
      {!selected && !run && frameworks && (
        <Card className="p-10 text-center text-[13.5px] text-muted-foreground">
          Pick a framework above to browse and run its tests.
        </Card>
      )}
    </div>
  );
}

// ── Test sessions panel (I1 session canary + live probe) ──────────────────────
// Every auth-gated framework's personas (`<framework>:<env>[:<name>]`), probed with
// the framework's own `npm run auth:probe` (offline: storageState + JWT/cookie
// expiry + identity vs .auth/<env>/meta.json). A "Needs a human" persona BLOCKS
// runs for that env (BLOCKED{SESSION}, nothing spawns) until it is re-captured; the
// built-in canary re-probes every 6h and raises a macOS notification + the red
// banner below + the header badge on any change. Probes never return a token.
function SessionsPanel({
  frameworks,
  data,
  error,
  onReload,
  onProbed,
}: {
  frameworks: RunnerFramework[];
  data: SessionsResponse | null;
  error: string | null;
  onReload: () => void;
  onProbed: (p: SessionProbe) => void;
}) {
  const [busy, setBusy] = useState(false);
  const visible = new Set(frameworks.map((f) => f.id));
  const rows = (data?.sessions ?? []).filter((s) => visible.has(s.framework));
  if (frameworks.length > 0 && !rows.length && !error && data) return null;
  const blocking = rows.filter((s) => s.probe?.severity === "block");
  const warns = rows.filter((s) => s.probe?.severity === "warn").length;
  const canary = data?.canary;

  const probeAll = async () => {
    setBusy(true);
    try {
      for (const r of rows) {
        try {
          onProbed(await probeSessionNow(r.persona));
        } catch {
          /* per-row errors show on the next reload */
        }
      }
      window.dispatchEvent(new Event(SESSIONS_CHANGED_EVENT));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
        <KeyRound size={15} className="text-muted-foreground" />
        <h2 className="m-0 text-[14px] font-semibold">Test sessions</h2>
        <span className="text-[11.5px] text-muted-foreground">
          {data
            ? `${rows.length} persona${rows.length === 1 ? "" : "s"} · ${blocking.length} need a human · ${warns} to check`
            : "Probing saved logins…"}
          {canary?.enabled
            ? ` · canary every ${canary.everyHours}h${canary.lastRunAt ? `, last ${timeAgo(canary.lastRunAt)}` : ""}`
            : canary
              ? " · canary off"
              : ""}
        </span>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => void probeAll()} disabled={busy || !rows.length} title="Re-probe every persona now (offline)">
          {busy ? <Loader2 size={13} className="cp-spin" /> : <RefreshCw size={13} />} Re-probe all
        </Button>
        <Button variant="ghost" size="sm" onClick={onReload} title="Reload the cached probe results">
          Reload
        </Button>
      </div>
      {blocking.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border-b border-[color-mix(in_srgb,var(--destructive)_35%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-4 py-3 text-[12.5px] text-destructive"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold">
              {blocking.length === 1 ? "1 test session needs a human" : `${blocking.length} test sessions need a human`} — runs
              for {blocking.length === 1 ? "this persona are" : "these personas are"} BLOCKED (SESSION) and do not start until it is
              re-captured.
            </div>
            <div className="mt-0.5 text-[11.5px]">
              {blocking.map((s) => `${s.persona} (${s.probe?.code ?? s.probe?.state})`).join(" · ")}
            </div>
          </div>
        </div>
      )}
      {error && <div className="border-b border-border px-4 py-2.5 text-[12px] text-destructive">Could not load sessions: {error}</div>}
      <div className="divide-y divide-border">
        {!data && !error && (
          <div className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-muted-foreground">
            <Loader2 size={13} className="cp-spin" /> Running each framework's auth:probe…
          </div>
        )}
        {rows.map((s) => (
          <SessionRow key={s.persona} view={s} onProbed={onProbed} />
        ))}
      </div>
    </Card>
  );
}

function SessionRow({ view, onProbed }: { view: SessionView; onProbed: (p: SessionProbe) => void }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"" | "probe" | "live">("");
  const [err, setErr] = useState<string | null>(null);
  const p = view.probe;
  const tone = p ? SEVERITY_TONE[p.severity] : { label: "Not probed", cls: "text-muted-foreground", dot: "bg-surface-3" };
  const cmd = `cd "${view.dir}" && ${view.captureCmd}`;
  const copy = () => {
    void navigator.clipboard?.writeText(cmd).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  };
  const reprobe = async (live: boolean) => {
    setBusy(live ? "live" : "probe");
    setErr(null);
    try {
      onProbed(await probeSessionNow(view.persona, live));
      window.dispatchEvent(new Event(SESSIONS_CHANGED_EVENT));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const found = p ? identityText(p.identity) : "";
  const expected = p ? identityText(p.expected) : "";
  const canLive = !!p && view.env !== "production" && !!p.code && LIVE_CONFIRMABLE.has(p.code);
  return (
    <div className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
        <span className="min-w-[150px] text-[13px] font-medium text-ink-1">{view.frameworkLabel}</span>
        <code className="font-mono text-[11px] text-ink-2">{view.persona}</code>
        <span className={`text-[11.5px] font-semibold ${tone.cls}`}>{tone.label}</span>
        {p && (
          <span className="text-[11.5px] text-muted-foreground">
            {p.state}
            {p.code && p.code !== p.state ? ` · ${p.code}` : ""}
            {p.live ? " · live" : ""}
            {p.source === "fallback" ? " · no auth:probe script" : ""}
            {p.expiresAt ? ` · expires ${fmtWhen(p.expiresAt)}` : ""}
            {p.refreshExpiresAt ? ` · refresh ${fmtWhen(p.refreshExpiresAt)}` : ""}
            {view.probeAgeSec != null ? ` · checked ${view.probeAgeSec < 60 ? "just now" : `${Math.round(view.probeAgeSec / 60)}m ago`}` : ""}
          </span>
        )}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => void reprobe(false)} disabled={!!busy} title="Re-run this persona's auth:probe (offline)">
          {busy === "probe" ? <Loader2 size={12} className="cp-spin" /> : <RefreshCw size={12} />} Re-probe
        </Button>
        {canLive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void reprobe(true)}
            disabled={!!busy}
            title="Confirm the cookie session with ONE read-only GET through the qa-core target guard"
          >
            {busy === "live" ? <Loader2 size={12} className="cp-spin" /> : <Zap size={12} />} Verify live
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={copy} title={`Copy: ${cmd}`}>
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy capture cmd"}
        </Button>
      </div>
      {(found || expected) && (
        <div className="mt-1 pl-5 text-[11.5px] text-muted-foreground">
          {found ? `Saved session: ${found}` : "Saved session: (no identity)"}
          {expected ? ` · expected: ${expected}` : " · no meta.json expectation"}
        </div>
      )}
      {p && p.severity !== "ok" && p.humanAction && (
        <div className="mt-1 pl-5 text-[11.5px] text-ink-2">
          <span className="font-semibold">Human action:</span> {p.humanAction}
        </div>
      )}
      {(err || p?.error) && <div className="mt-1 pl-5 text-[11.5px] text-destructive">{err || p?.error}</div>}
    </div>
  );
}

function FrameworkCard({
  fw,
  active,
  onPick,
  probe,
}: {
  fw: RunnerFramework;
  active: boolean;
  onPick: () => void;
  probe: SessionProbe | null;
}) {
  const brandTone = BRAND_TONE[fw.brand];
  const [commit, setCommit] = useState<RepoCommit | null>(null);
  const [commitErr, setCommitErr] = useState(false);

  // Read-only: show the latest commit on the repo's default branch so QA can see
  // what's currently deployed before running. Never writes to GitHub.
  useEffect(() => {
    if (!fw.repo) return;
    let alive = true;
    fetchLatestCommit(fw.repo)
      .then((r) => {
        if (!alive) return;
        if (r.connected) setCommit(r.commit);
        else setCommitErr(true);
      })
      .catch(() => alive && setCommitErr(true));
    return () => {
      alive = false;
    };
  }, [fw.repo]);

  return (
    <button
      onClick={onPick}
      className={`group cursor-pointer rounded-card border bg-card p-3.5 text-left transition-all duration-150 ${
        active
          ? "border-primary shadow-[0_0_0_1px_var(--primary)]"
          : "border-border hover:-translate-y-0.5 hover:border-[oklch(0.8_0_0)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Colored brand icon tile — leading visual, tinted with the brand token. */}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105"
            style={{ background: brandTone.surface, color: brandTone.color }}
          >
            <FolderGit2 size={17} />
          </span>
          <span className="min-w-0 text-[13.5px] font-semibold leading-tight text-ink-1">
            <span className="line-clamp-2">{fw.label}</span>
          </span>
        </div>
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${fw.healthy ? "bg-success" : "bg-warning"}`}
          title={fw.problem ?? "Ready"}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Chip tone={brandTone}>{fw.brand}</Chip>
        {fw.playwrightVersion && (
          <span className="font-mono text-[10.5px] text-muted-foreground">pw {fw.playwrightVersion}</span>
        )}
        {probe && (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold ${SEVERITY_TONE[probe.severity].cls}`}
            title={`session ${probe.persona}: ${probe.state}${probe.code ? ` (${probe.code})` : ""}`}
          >
            <KeyRound size={10} /> {SEVERITY_TONE[probe.severity].label}
          </span>
        )}
      </div>
      <p className="m-0 mt-2 line-clamp-2 text-[11.5px] leading-[1.45] text-muted-foreground">
        {fw.problem ?? fw.notes}
      </p>
      {fw.repo && (
        <div
          className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-[10.5px] text-muted-foreground"
          title={`${fw.repo} · latest on master`}
        >
          <GitCommitHorizontal size={13} className="shrink-0" />
          {commit ? (
            <span className="min-w-0 truncate">
              <span className="font-mono text-ink-2">{commit.sha.slice(0, 7)}</span> {commit.message}
              {commit.date ? ` · ${timeAgo(commit.date)}` : ""}
            </span>
          ) : commitErr ? (
            <span>latest commit unavailable</span>
          ) : (
            <span className="flex items-center gap-1">
              <Loader2 size={11} className="cp-spin" /> latest commit…
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function SpecTree({
  specs,
  running,
  onRunSpec,
}: {
  specs: RunnerSpec[];
  running: boolean;
  onRunSpec: (spec: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const byFile = useMemo(() => {
    const m = new Map<string, RunnerSpec[]>();
    for (const s of specs) {
      const arr = m.get(s.file);
      if (arr) arr.push(s);
      else m.set(s.file, [s]);
    }
    return [...m.entries()];
  }, [specs]);

  return (
    <div className="max-h-[560px] overflow-y-auto">
      {byFile.map(([file, tests]) => {
        const isOpen = !!open[file];
        const tags = [...new Set(tests.flatMap((t) => t.tags))].slice(0, 4);
        return (
          <div key={file} className="border-b border-border last:border-b-0">
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-surface-1">
              <button
                onClick={() => setOpen((o) => ({ ...o, [file]: !isOpen }))}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
              >
                {isOpen ? (
                  <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                )}
                <span className="truncate font-mono text-[12px] text-ink-1">{file}</span>
                <span className="shrink-0 rounded-full bg-surface-3 px-1.5 text-[10.5px] font-bold text-muted-foreground">
                  {tests.length}
                </span>
                {tags.map((t) => (
                  <span key={t} className="hidden shrink-0 font-mono text-[10px] text-muted-foreground lg:inline">
                    {t}
                  </span>
                ))}
              </button>
              <Button size="sm" variant="outline" disabled={running} onClick={() => onRunSpec(file)} title={`Run ${file}`}>
                <Play size={12} />
              </Button>
            </div>
            {isOpen &&
              tests.map((t) => (
                <div
                  key={`${t.file}:${t.line}:${t.title}`}
                  className="flex items-center gap-2 border-t border-border py-1.5 pl-9 pr-3 hover:bg-surface-1"
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{t.title}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">:{t.line}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={running}
                    onClick={() => onRunSpec(`${t.file}:${t.line}`)}
                    title="Run this test"
                  >
                    <Play size={12} />
                  </Button>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
