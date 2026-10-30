import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ListTree, Loader2, Play, Square, XCircle } from "lucide-react";
import { useStore } from "@/store/useStore";
import { verdictNote } from "@/lib/runner";
import { Button, Card, EyebrowLabel } from "@/components/ui/primitives";

// Chrome/Firefox block navigating a top frame to a data: URL, so to "open full
// size" we convert the data URL to a blob: URL (exempt) and open that.
function openDataUrlInNewTab(dataUrl: string) {
  try {
    const [meta, b64] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/png";
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    /* ignore */
  }
}

// Live run panel shared by the Test Runner and the Manual Test page. Reads the
// single active run from the store (only one run happens at a time).
export function RunPanel() {
  const run = useStore((s) => s.runnerRun);
  const output = useStore((s) => s.runnerOutput);
  const frameworks = useStore((s) => s.runnerFrameworks);
  const cancelPlaywrightRun = useStore((s) => s.cancelPlaywrightRun);
  const clearRunnerRun = useStore((s) => s.clearRunnerRun);
  const outRef = useRef<HTMLPreElement>(null);
  // Whether the user is pinned to the tail. Tracked from their scroll position
  // (not recomputed after output appends, which would already be "far from bottom").
  const pinnedRef = useRef(true);
  const [, setTick] = useState(0);

  const running = run?.status === "running";

  // Auto-follow the tail only while the user is pinned near the bottom, so they
  // can scroll up to read an earlier assertion/stack trace without being yanked
  // back down on every ~1s poll.
  useEffect(() => {
    if (pinnedRef.current && outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [output]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!run) {
    return (
      <Card className="p-6 text-center text-[13px] text-muted-foreground">
        No run yet. Start one with a <Play size={12} className="inline" /> button.
      </Card>
    );
  }

  const fw = frameworks?.find((f) => f.id === run.framework);
  const label = fw?.label ?? (run.framework === "adhoc" ? "Ad-hoc URL test" : run.framework);
  const modeLabel =
    run.mode === "adhoc"
      ? "ad-hoc"
      : run.mode === "command"
        ? `npm run ${run.args[2] ?? ""}`.trim()
        : run.mode === "spec"
          ? "single spec"
          : run.mode === "smoke"
            ? "smoke"
            : "full regression";
  const elapsed = Math.max(
    0,
    Math.round(((run.finishedAt ? +new Date(run.finishedAt) : Date.now()) - +new Date(run.startedAt)) / 1000),
  );
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  const statusUi =
    run.status === "running"
      ? { icon: <Loader2 size={14} className="cp-spin" />, label: "Running", color: "var(--emphasis)" }
      : run.status === "passed"
        ? {
            icon: <CheckCircle2 size={14} />,
            label: run.verdict?.state === "PASS_WITH_GAPS" ? "Passed with gaps" : "Passed",
            color: run.verdict?.state === "PASS_WITH_GAPS" ? "var(--caution)" : "var(--success)",
          }
        : run.status === "blocked"
          ? { icon: <AlertTriangle size={14} />, label: `Blocked${run.verdict?.cls ? ` · ${run.verdict.cls}` : ""}`, color: "var(--emphasis)" }
          : run.status === "cancelled"
          ? { icon: <Square size={14} />, label: "Cancelled", color: "var(--caution)" }
          : { icon: <XCircle size={14} />, label: run.status === "error" ? "Error" : "Failed", color: "var(--destructive)" };

  return (
    <Card className="sticky top-2 overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: statusUi.color }}>
          {statusUi.icon} {statusUi.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
          {label} · {modeLabel}
          {Object.entries(run.env).map(([k, v]) => ` · ${k}=${v}`)}
        </span>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {mm}:{ss}
        </span>
        {running ? (
          <Button size="sm" variant="destructive" disabled={run.cancelRequested} onClick={() => void cancelPlaywrightRun()}>
            {run.cancelRequested ? <Loader2 size={12} className="cp-spin" /> : <Square size={12} />}
            {run.cancelRequested ? "Cancelling…" : "Cancel"}
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Link
              to={`/runs/${run.id}`}
              className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[12px] font-medium text-primary hover:bg-primary/10"
              title="View the full run story — what happened, step by step"
            >
              <ListTree size={13} /> View story
            </Link>
            <Button size="sm" variant="ghost" onClick={clearRunnerRun}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* V1 honest verdict: why a run is blocked / has gaps, and the one human action. */}
      {run.verdict && (run.verdict.state === "BLOCKED" || run.verdict.state === "PASS_WITH_GAPS") && (
        <div
          className="border-b border-border px-4 py-2.5 text-[12px] leading-[1.45]"
          style={{ color: run.verdict.state === "BLOCKED" ? "var(--emphasis)" : "var(--caution)" }}
        >
          <div className="font-semibold">{verdictNote(run.verdict)}</div>
          {run.verdict.state === "BLOCKED" && (
            <div className="mt-0.5 text-muted-foreground">
              {run.verdict.reason}
              {run.verdict.attempts && run.verdict.attempts > 1 ? " · auto-retried once" : ""}
            </div>
          )}
        </div>
      )}

      {run.summary && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 text-[12px] font-medium">
          <span className="text-success">✓ {run.summary.expected} passed</span>
          {run.summary.unexpected > 0 && <span className="text-destructive">✗ {run.summary.unexpected} failed</span>}
          {run.summary.flaky > 0 && <span className="text-caution">⚡ {run.summary.flaky} flaky</span>}
          {run.summary.skipped > 0 && <span className="text-muted-foreground">− {run.summary.skipped} skipped</span>}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {(run.summary.durationMs / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      {run.summary && run.summary.failures.length > 0 && (
        <div className="max-h-[150px] overflow-y-auto border-b border-border px-4 py-2">
          <EyebrowLabel className="mb-1.5">Failures</EyebrowLabel>
          {run.summary.failures.map((f, i) => (
            <div key={i} className="py-1 text-[11.5px] leading-[1.4]">
              <div className="font-medium text-destructive">{f.title}</div>
              <div className="truncate font-mono text-[10.5px] text-muted-foreground">
                {f.file} — {f.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {run.screenshot && (
        <div className="border-b border-border p-3">
          <EyebrowLabel className="mb-1.5">Screenshot</EyebrowLabel>
          {/* Open full-size via a blob URL — browsers block top-frame navigation
              to a data: URL, so an <a href="data:…"> would be a dead link. */}
          <button
            type="button"
            onClick={() => openDataUrlInNewTab(run.screenshot!)}
            className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
            title="Open full size"
          >
            <img src={run.screenshot} alt="Page screenshot" className="w-full rounded-control border border-border" />
          </button>
        </div>
      )}

      <pre
        ref={outRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="m-0 max-h-[420px] min-h-[160px] overflow-y-auto whitespace-pre-wrap break-words bg-[oklch(0.16_0_0)] px-3.5 py-3 font-mono text-[11px] leading-[1.5] text-[oklch(0.85_0_0)]"
      >
        {output || "…"}
      </pre>
    </Card>
  );
}
