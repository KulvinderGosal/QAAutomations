import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bug,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileBarChart2,
  History,
  Loader2,
  Play,
  RefreshCw,
  Repeat2,
  SlidersHorizontal,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card } from "@/components/ui/primitives";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { timeAgo } from "@/lib/utils";
import { verdictNote } from "@/lib/runner";
import {
  fetchRunHistory,
  fetchSmokeReportFile,
  fetchSmokeReports,
  type RunHistoryEntry,
  type SmokeReport,
} from "@/lib/reports";
import { fetchFlaky, diagnoseFlaky, rerunToConfirm, type FlakyTest, type DiagnoseResult } from "@/lib/flaky";
import type { Task } from "@/types";

function statusColor(s: string): string {
  return s === "passed"
    ? "var(--success)"
    : s === "failed" || s === "error"
      ? "var(--destructive)"
      : s === "cancelled"
        ? "var(--caution)"
        : "var(--emphasis)";
}

function taskSourceUrl(t: Task | undefined): string | null {
  if (!t) return null;
  return t.github?.url ?? t.asana?.url ?? t.slack?.permalink ?? t.links?.pullRequest ?? null;
}

/** One-line "what was tested" from a matched live task, if we still have it. */
function whatTested(t: Task | undefined): string {
  if (!t) return "—";
  const bits: string[] = [];
  if (t.tests?.length) bits.push(`${t.tests.length} test${t.tests.length === 1 ? "" : "s"}`);
  const a = t.qaAuthoring;
  if (a?.scenarios?.length) bits.push(`${a.scenarios.length} scenarios`);
  if (a?.specs?.length) bits.push(`${a.specs.length} spec${a.specs.length === 1 ? "" : "s"}`);
  return bits.length ? bits.join(" · ") : "authored";
}

export function Reports() {
  const navigate = useNavigate();
  const qaLog = useStore((s) => s.qaLog);
  const tasks = useStore((s) => s.tasks);
  const frameworks = useStore((s) => s.runnerFrameworks);
  const loadRunnerFrameworks = useStore((s) => s.loadRunnerFrameworks);
  const startPlaywrightRun = useStore((s) => s.startPlaywrightRun);
  const run = useStore((s) => s.runnerRun);
  const pushToast = useStore((s) => s.pushToast);

  const [history, setHistory] = useState<RunHistoryEntry[]>([]);
  const [reports, setReports] = useState<SmokeReport[]>([]);
  const [viewer, setViewer] = useState<{ name: string; html: string } | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(false);
  const [odFw, setOdFw] = useState("");
  const [odRef, setOdRef] = useState("");
  const [histResult, setHistResult] = useState<string[]>([]);
  const [histFw, setHistFw] = useState<string[]>([]);
  // Flaky diagnostics
  const [flaky, setFlaky] = useState<FlakyTest[]>([]);
  const [flakyAiReady, setFlakyAiReady] = useState(false);
  const [diag, setDiag] = useState<Record<string, DiagnoseResult>>({});
  const [diagBusy, setDiagBusy] = useState<string | null>(null);
  const [diagErr, setDiagErr] = useState<Record<string, string>>({});
  const [rerun, setRerun] = useState<Record<string, { running: boolean; passed: number; done: number; total: number }>>({});

  useEffect(() => {
    if (!frameworks) void loadRunnerFrameworks();
  }, [frameworks, loadRunnerFrameworks]);

  const refresh = () => {
    void fetchRunHistory().then((r) => setHistory(r.history)).catch(() => {});
    void fetchSmokeReports().then((r) => setReports(r.reports)).catch(() => {});
    void fetchFlaky().then((r) => { setFlaky(r.flaky); setFlakyAiReady(r.aiReady); }).catch(() => {});
  };
  useEffect(() => {
    refresh();
  }, []);
  // While a run is active, poll so new history/report rows land automatically.
  useEffect(() => {
    if (run?.status !== "running") {
      refresh();
      return;
    }
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [run?.status]);

  const running = run?.status === "running";
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const fwLabel = (id: string) => frameworks?.find((f) => f.id === id)?.label ?? id;

  const historyFws = [...new Set(history.map((h) => h.framework))];
  const shownHistory = history.filter(
    (h) => (histResult.length === 0 || histResult.includes(h.status)) && (histFw.length === 0 || histFw.includes(h.framework)),
  );
  const RESULT_DOT: Record<string, string> = {
    passed: "var(--success)",
    failed: "var(--destructive)",
    error: "var(--destructive)",
    cancelled: "var(--caution)",
    running: "var(--emphasis)",
  };

  const runOnDemand = () => {
    if (!odFw || running) return;
    const ref = odRef.trim();
    const taskRef = ref ? (/^#?\d+$/.test(ref) ? { pr: Number(ref.replace("#", "")), label: `PR #${ref.replace("#", "")}` } : { label: ref }) : null;
    // Generate a full report (custom reporter) tagged to the PR/task — it lands
    // in "Generated smoke reports" below + a tagged run in the history.
    void startPlaywrightRun({ framework: odFw, mode: "command", script: "test:smoke:report", taskRef });
    pushToast({ icon: "generate", title: "Generating report", subtitle: taskRef ? `${fwLabel(odFw)} · tagged ${taskRef.label}` : fwLabel(odFw) });
  };

  const openReport = (rep: SmokeReport) => {
    setLoadingViewer(true);
    fetchSmokeReportFile(rep.file)
      .then(setViewer)
      .catch((e) => pushToast({ icon: "issue", title: "Couldn't open report", subtitle: (e as Error).message }))
      .finally(() => setLoadingViewer(false));
  };

  const anyRerun = Object.values(rerun).some((r) => r.running);
  const runDiagnose = (f: FlakyTest) => {
    if (!f.lastRunId) {
      pushToast({ icon: "issue", title: "No run story to diagnose", subtitle: "This test's last run predates the story trace." });
      return;
    }
    setDiagBusy(f.key);
    setDiagErr((e) => {
      const n = { ...e };
      delete n[f.key];
      return n;
    });
    diagnoseFlaky({ runId: f.lastRunId, spec: f.spec, title: f.title })
      .then((r) => setDiag((d) => ({ ...d, [f.key]: r })))
      .catch((e: Error) => setDiagErr((x) => ({ ...x, [f.key]: e.message })))
      .finally(() => setDiagBusy((b) => (b === f.key ? null : b)));
  };
  const runRerun = (f: FlakyTest) => {
    if (!f.spec || running || anyRerun) {
      pushToast({
        icon: "issue",
        title: !f.spec ? "No bound spec" : "Runner busy",
        subtitle: !f.spec ? "Re-run needs a file:line spec." : "Wait for the current run to finish.",
      });
      return;
    }
    setRerun((r) => ({ ...r, [f.key]: { running: true, passed: 0, done: 0, total: 5 } }));
    void rerunToConfirm(f.framework, f.spec, 5, (p) =>
      setRerun((r) => ({ ...r, [f.key]: { running: p.done < p.total, passed: p.passed, done: p.done, total: p.total } })),
    )
      .then((p) => {
        setRerun((r) => ({ ...r, [f.key]: { running: false, passed: p.passed, done: p.done, total: p.total } }));
        pushToast({ icon: p.failed ? "issue" : "check", title: `Re-run: ${p.passed}/${p.total} passed`, subtitle: fwLabel(f.framework) });
        refresh();
      })
      .catch((e: Error) => {
        setRerun((r) => {
          const n = { ...r };
          delete n[f.key];
          return n;
        });
        pushToast({ icon: "issue", title: "Re-run failed", subtitle: e.message });
      });
  };

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <FileBarChart2 size={20} className="text-primary" />
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Reports</h1>
        </div>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          What was tested, and against which PR or task. Traces QA sign-offs and every automation run back to the PR/task
          it verified, indexes the generated smoke reports, and lets you run a fresh tagged report on demand.
        </p>
      </div>

      {/* 1 — QA verification log ↔ PR / task */}
      <Card className="mb-[18px] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <ClipboardCheck size={15} className="text-muted-foreground" />
          <h2 className="m-0 text-[13.5px] font-semibold">Verified &amp; closed — what was tested per PR / task</h2>
          <span className="text-[11.5px] text-muted-foreground">{qaLog.length}</span>
        </div>
        {qaLog.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            Nothing closed yet. When QA verifies &amp; closes a task, it's traced here with its PR/task and what was tested.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-border bg-surface-2">
                <tr>
                  {["Task", "PR / task", "What was tested", "Source", "Closed by", "When", "Write-back"].map((c) => (
                    <th key={c} className="px-4 py-2 text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qaLog.map((e) => {
                  const t = taskById.get(e.taskId);
                  const url = taskSourceUrl(t);
                  return (
                    <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-surface-1">
                      <td className="max-w-[360px] px-4 py-2.5 text-[13px] font-medium text-ink-1">
                        <span className="line-clamp-1">{e.title}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ink-2">{e.pr ? `#${e.pr}` : e.taskId}</td>
                      <td className="px-4 py-2.5 text-[12px] text-ink-2">{whatTested(t)}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ink-2">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            {e.origin} <ExternalLink size={11} />
                          </a>
                        ) : (
                          e.origin
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ink-2">{e.closedBy}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-muted-foreground">{timeAgo(e.closedAt)}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className="rounded-chip px-2 py-0.5 text-[10.5px] font-bold"
                          style={{
                            color: e.asana === "completed" ? "var(--success)" : e.asana === "failed" ? "var(--destructive)" : "var(--ink-2)",
                            background: e.asana === "completed" ? "var(--success-surface)" : e.asana === "failed" ? "var(--destructive-surface)" : "var(--surface-3)",
                          }}
                        >
                          {e.asana === "completed" ? "Completed in Asana" : e.asana === "failed" ? "Asana write failed" : "Local only"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 2 — On-demand tagged report + run history */}
      <Card className="mb-[18px] overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-2.5">
          <History size={15} className="text-muted-foreground" />
          <h2 className="m-0 text-[13.5px] font-semibold">Automation run history</h2>
          <span className="text-[11.5px] text-muted-foreground">{shownHistory.length}</span>
          <span className="flex-1" />
          <FilterMenu
            label="Filter"
            icon={<SlidersHorizontal size={13} />}
            align="end"
            activeCount={histResult.length + histFw.length}
            groups={[
              {
                key: "result",
                label: "Result",
                type: "checkbox",
                values: histResult,
                onChange: setHistResult,
                options: ["passed", "failed", "cancelled", "error"].map((s) => ({
                  value: s,
                  label: s,
                  dot: RESULT_DOT[s],
                  count: history.filter((h) => h.status === s).length,
                })),
              },
              {
                key: "product",
                label: "Product",
                type: "checkbox",
                values: histFw,
                onChange: setHistFw,
                options: historyFws.map((id) => ({ value: id, label: fwLabel(id), count: history.filter((h) => h.framework === id).length })),
              },
            ]}
          />
          <Button size="sm" variant="ghost" onClick={refresh} title="Refresh">
            <RefreshCw size={13} />
          </Button>
        </div>

        {/* on-demand builder */}
        <div className="flex flex-wrap items-end gap-2.5 border-b border-border bg-surface-1 px-4 py-3">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            Product
            <select
              value={odFw}
              onChange={(e) => setOdFw(e.target.value)}
              className="rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1 outline-none"
            >
              <option value="">Pick a framework…</option>
              {(frameworks ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            PR / task tag (optional)
            <input
              value={odRef}
              onChange={(e) => setOdRef(e.target.value)}
              placeholder="e.g. 965 or shopify-revamp"
              className="w-52 rounded-control border border-border bg-card px-2.5 py-1 text-[12px] text-ink-1 outline-none focus:border-primary"
            />
          </label>
          <Button size="sm" variant="primary" disabled={!odFw || running} onClick={runOnDemand} title="Run smoke and generate a full report tagged to this PR/task">
            <Play size={12} /> Generate tagged report
          </Button>
          {running && <span className="flex items-center gap-1.5 text-[11.5px] text-emphasis"><Loader2 size={12} className="cp-spin" /> a run is in progress…</span>}
        </div>

        {shownHistory.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            {history.length === 0
              ? "No runs yet. Runs from the Test Runner, Scheduler, or the builder above are recorded here — tagged with their PR/task."
              : "No runs match this filter."}
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 border-b border-border bg-surface-2">
                <tr>
                  {["", "Product", "Ran", "Result", "PR / task", "When", ""].map((c, i) => (
                    <th key={i} className="px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownHistory.map((h) => (
                  <tr
                    key={h.id}
                    onClick={() => h.status !== "running" && navigate(`/runs/${h.id}`)}
                    className={`border-b border-border last:border-b-0 hover:bg-surface-1 ${h.status !== "running" ? "cursor-pointer" : ""}`}
                    title={h.status !== "running" ? "View the run story — what happened, step by step" : undefined}
                  >
                    <td className="pl-3 pr-1 py-2">
                      {h.status === "passed" ? (
                        <CheckCircle2 size={14} style={{ color: statusColor(h.status) }} />
                      ) : h.status === "running" ? (
                        <Loader2 size={14} className="cp-spin" style={{ color: statusColor(h.status) }} />
                      ) : (
                        <XCircle size={14} style={{ color: statusColor(h.status) }} />
                      )}
                    </td>
                    <td className="px-3 py-2 text-[12.5px] text-ink-1">{fwLabel(h.framework)}</td>
                    <td className="px-3 py-2 font-mono text-[11.5px] text-ink-2">{h.label}</td>
                    <td
                      className="px-3 py-2 text-[12px]"
                      style={{ color: statusColor(h.status) }}
                      title={h.verdict ? verdictNote(h.verdict) : undefined}
                    >
                      {h.status === "blocked" && h.verdict?.cls ? `blocked · ${h.verdict.cls}` : h.status}
                      {h.summary ? (
                        <span className="ml-1.5 text-muted-foreground">
                          ({h.summary.expected}✓{h.summary.unexpected ? ` / ${h.summary.unexpected}✗` : ""})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-ink-2">{h.taskRef?.label ?? (h.taskRef?.pr ? `#${h.taskRef.pr}` : "—")}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[12px] text-muted-foreground">{timeAgo(h.finishedAt ?? h.startedAt)}</td>
                    <td className="pr-3 py-2 text-right">
                      {h.status !== "running" && <ChevronRight size={14} className="text-muted-foreground" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Flaky tests — detection + AI diagnose + re-run to confirm */}
      <Card className="mb-[18px] overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-2.5">
          <Bug size={15} className="text-muted-foreground" />
          <h2 className="m-0 text-[13.5px] font-semibold">Flaky tests</h2>
          <span className="text-[11.5px] text-muted-foreground">{flaky.length}</span>
          <span className="flex-1" />
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            flagged when a test both passed &amp; failed, or recovered on a retry
          </span>
          <Button size="sm" variant="ghost" onClick={refresh} title="Refresh">
            <RefreshCw size={13} />
          </Button>
        </div>
        {flaky.length === 0 ? (
          <div className="px-4 py-6 text-[13px] text-muted-foreground">
            No flaky tests across recent runs. This populates as runs accumulate story traces (spec / smoke / full runs — command-mode
            scheduled runs don't carry a per-test trace yet).
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-border p-0">
            {flaky.map((f) => {
              const d = diag[f.key];
              const rr = rerun[f.key];
              const pct = Math.round(f.passRate * 100);
              return (
                <li key={f.key} className="px-4 py-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink-1">{f.title}</div>
                      <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                        {fwLabel(f.framework)}
                        {f.spec ? ` · ${f.spec}` : ""}
                      </div>
                      {f.lastError && (
                        <div className="mt-1 line-clamp-2 rounded-control bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink-2">
                          {f.lastError}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span
                          className="text-[11.5px] font-semibold"
                          style={{ color: pct >= 80 ? "var(--caution)" : "var(--destructive)" }}
                        >
                          {pct}% pass
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ({f.passed}/{f.passed + f.failed}
                          {f.retryRecoveries ? ` · ${f.retryRecoveries} retry-recovered` : ""})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={diagBusy === f.key || !flakyAiReady || !f.lastRunId}
                          title={
                            !flakyAiReady
                              ? "Needs Anthropic credits"
                              : !f.lastRunId
                                ? "No story trace on the last run"
                                : "Diagnose the root cause with AI"
                          }
                          onClick={() => runDiagnose(f)}
                        >
                          {diagBusy === f.key ? <Loader2 size={12} className="cp-spin" /> : <Sparkles size={12} />} Diagnose
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!f.spec || running || anyRerun}
                          title={!f.spec ? "No file:line spec bound" : "Re-run 5× to confirm the pass rate"}
                          onClick={() => runRerun(f)}
                        >
                          {rr?.running ? <Loader2 size={12} className="cp-spin" /> : <Repeat2 size={12} />} Re-run 5×
                        </Button>
                        {f.lastRunId && (
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/runs/${f.lastRunId}`)} title="Open the last run's story">
                            <ChevronRight size={13} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {rr && (
                    <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                      Re-run: {rr.running ? `running ${rr.done}/${rr.total}…` : `${rr.passed}/${rr.total} passed`}
                    </div>
                  )}
                  {diagErr[f.key] && (
                    <div
                      className="mt-2 rounded-control px-2.5 py-1.5 text-[12px]"
                      style={{ background: "var(--destructive-surface)", color: "var(--destructive)" }}
                    >
                      {diagErr[f.key]}
                    </div>
                  )}
                  {d && (
                    <div className="mt-2 rounded-card border border-border bg-surface-2 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-chip bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-primary">
                          {d.diagnosis.category}
                        </span>
                        <span className="text-[11px] text-muted-foreground">confidence: {d.diagnosis.confidence}</span>
                        {d.diagnosis.matchedPitfall && (
                          <span className="text-[11px] text-muted-foreground">· {d.diagnosis.matchedPitfall}</span>
                        )}
                      </div>
                      <p className="mb-0 mt-1.5 text-[12.5px] text-ink-1">
                        <b>Root cause:</b> {d.diagnosis.rootCause}
                      </p>
                      <p className="mb-0 mt-1 text-[12px] text-ink-2">
                        <b>Evidence:</b> {d.diagnosis.evidence}
                      </p>
                      <p className="mb-0 mt-1 text-[12.5px] text-ink-1">
                        <b>Suggested fix:</b> {d.diagnosis.suggestedFix}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* 3 — Generated smoke reports */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <FileBarChart2 size={15} className="text-muted-foreground" />
          <h2 className="m-0 text-[13.5px] font-semibold">Generated smoke reports</h2>
          <span className="text-[11.5px] text-muted-foreground">{reports.length}</span>
        </div>
        {reports.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            No smoke reports yet. Use <b>Generate tagged report</b> above (or run{" "}
            <span className="font-mono">test:smoke:report</span> for any framework) — it writes a full HTML report,
            grouped by critical functionality, that shows up here.
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            {reports.map((rep) => (
              <div key={rep.file} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-1">
                <span
                  className="rounded-chip px-2 py-0.5 text-[10.5px] font-bold"
                  style={{
                    color: rep.verdict === "PASSED" ? "var(--success)" : rep.verdict === "FAILED" ? "var(--destructive)" : "var(--ink-2)",
                    background: rep.verdict === "PASSED" ? "var(--success-surface)" : rep.verdict === "FAILED" ? "var(--destructive-surface)" : "var(--surface-3)",
                  }}
                >
                  {rep.verdict ?? "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-medium text-ink-1">{rep.frameworkLabel}</span>
                    {rep.taskRef && (
                      <span className="shrink-0 rounded-chip bg-primary/12 px-1.5 py-0.5 text-[10px] font-bold text-primary">{rep.taskRef}</span>
                    )}
                  </div>
                  <div className="truncate font-mono text-[10.5px] text-muted-foreground">
                    {rep.env ? `${rep.env} · ` : ""}
                    {rep.name} · {rep.sizeKb}KB
                  </div>
                </div>
                <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">{timeAgo(rep.mtime)}</span>
                <Button size="sm" variant="outline" onClick={() => openReport(rep)} disabled={loadingViewer}>
                  Open
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Report viewer modal */}
      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setViewer(null)}>
          <div className="flex h-full max-h-[90vh] w-full max-w-[960px] flex-col overflow-hidden rounded-card border border-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <FileBarChart2 size={15} className="text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-1">{viewer.name}</span>
              <Button size="sm" variant="ghost" onClick={() => setViewer(null)}>
                <X size={14} />
              </Button>
            </div>
            <iframe title={viewer.name} srcDoc={viewer.html} className="min-h-0 flex-1 border-0 bg-white" sandbox="" />
          </div>
        </div>
      )}
    </div>
  );
}
