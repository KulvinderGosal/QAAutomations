import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Clock,
  FlagTriangleRight,
  Image as ImageIcon,
  Loader2,
  MinusCircle,
  Terminal,
  XCircle,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Card } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";
import { fetchRunDetail, type RunDetail, type StoryStep, type StoryTest } from "@/lib/runStory";
import { verdictNote } from "@/lib/runner";

function fmtMs(ms: number): string {
  if (!ms) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

const STATUS_COLOR: Record<string, string> = {
  passed: "var(--success)",
  expected: "var(--success)",
  failed: "var(--destructive)",
  unexpected: "var(--destructive)",
  error: "var(--destructive)",
  timedOut: "var(--destructive)",
  cancelled: "var(--caution)",
  blocked: "var(--emphasis)",
  skipped: "var(--ink-3)",
  running: "var(--emphasis)",
};

function StatusIcon({ status, size = 15 }: { status: string; size?: number }) {
  const color = STATUS_COLOR[status] ?? "var(--ink-3)";
  if (status === "passed" || status === "expected") return <CheckCircle2 size={size} style={{ color }} />;
  if (status === "skipped") return <MinusCircle size={size} style={{ color }} />;
  if (status === "running") return <Loader2 size={size} className="cp-spin" style={{ color }} />;
  return <XCircle size={size} style={{ color }} />;
}

/** A verdict pill (passed / failed / …). */
function Verdict({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "var(--ink-2)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[12px] font-bold"
      style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <StatusIcon status={status} size={13} /> {status}
    </span>
  );
}

/** One step in the action timeline. Category drives the icon + accent. */
function StepRow({ step }: { step: StoryStep }) {
  const failed = !!step.error;
  const icon =
    step.category === "test.step" ? (
      <FlagTriangleRight size={13} className="text-emphasis" />
    ) : step.category === "expect" ? (
      <CheckCircle2 size={13} style={{ color: failed ? "var(--destructive)" : "var(--success)" }} />
    ) : (
      <ArrowRight size={13} className="text-muted-foreground" />
    );
  return (
    <div className="flex items-start gap-2 py-[3px]" style={{ paddingLeft: 8 + step.depth * 16 }}>
      <span className="mt-[2px] shrink-0">{failed ? <XCircle size={13} style={{ color: "var(--destructive)" }} /> : icon}</span>
      <span className={`min-w-0 flex-1 text-[12.5px] ${step.category === "test.step" ? "font-semibold text-ink-1" : "text-ink-2"}`}>
        {step.title}
        {step.error && <span className="mt-0.5 block font-mono text-[11px] text-[var(--destructive)]">{step.error}</span>}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{fmtMs(step.duration)}</span>
    </div>
  );
}

/** One test's full replay: verdict + narrative + step timeline + error + shots. */
function TestStory({ t }: { t: StoryTest }) {
  const narrative = t.stdout.filter((l) => l.trim().length > 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-2.5">
        <StatusIcon status={t.status} />
        <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink-1">{t.title}</span>
        {t.project && <span className="rounded-chip bg-surface-3 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-2">{t.project}</span>}
        {t.retry > 0 && <span className="rounded-chip bg-[var(--caution-surface)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--caution)]">retry {t.retry}</span>}
        <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
          <Clock size={11} /> {fmtMs(t.durationMs)}
        </span>
      </div>
      {t.file && (
        <div className="border-b border-border bg-surface-1 px-4 py-1.5 font-mono text-[11px] text-muted-foreground">
          {t.file}
          {t.line ? `:${t.line}` : ""}
        </div>
      )}

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {/* What it reported — the printed narrative */}
        <div>
          <h3 className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">What it reported</h3>
          {narrative.length ? (
            <div className="rounded-control border border-border bg-surface-1 p-2.5">
              {narrative.map((line, i) => (
                <div key={i} className="flex items-start gap-1.5 py-[2px] font-mono text-[11.5px] text-ink-2">
                  <CircleDot size={9} className="mt-[4px] shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words">{line}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-[12px] text-muted-foreground">The test printed no narrative — see the step timeline.</p>
          )}
        </div>

        {/* What it did — the step timeline */}
        <div>
          <h3 className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            What it did <span className="text-ink-3">· {t.steps.length} steps</span>
          </h3>
          {t.steps.length ? (
            <div className="max-h-[420px] overflow-y-auto rounded-control border border-border bg-surface-1 py-1.5">
              {t.steps.map((s, i) => (
                <StepRow key={i} step={s} />
              ))}
            </div>
          ) : (
            <p className="m-0 text-[12px] text-muted-foreground">No step trace captured for this test.</p>
          )}
        </div>
      </div>

      {t.error && (
        <div className="border-t border-border px-4 py-3">
          <h3 className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--destructive)]">Failure</h3>
          <pre className="m-0 max-h-[280px] overflow-auto whitespace-pre-wrap rounded-control border border-[var(--destructive)]/30 bg-[var(--destructive-surface)] p-2.5 font-mono text-[11.5px] leading-relaxed text-ink-1">
            {t.error}
          </pre>
        </div>
      )}

      {t.attachments.some((a) => a.dataUrl) && (
        <div className="border-t border-border px-4 py-3">
          <h3 className="m-0 mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            <ImageIcon size={12} /> Screenshots
          </h3>
          <div className="flex flex-wrap gap-3">
            {t.attachments
              .filter((a) => a.dataUrl)
              .map((a, i) => (
                <a key={i} href={a.dataUrl} target="_blank" rel="noreferrer" className="block">
                  <img src={a.dataUrl} alt={a.name} className="max-h-48 rounded-control border border-border" />
                  <span className="mt-1 block max-w-48 truncate text-[10.5px] text-muted-foreground">{a.name}</span>
                </a>
              ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function RunStory() {
  const { id = "" } = useParams();
  const frameworks = useStore((s) => s.runnerFrameworks);
  const loadRunnerFrameworks = useStore((s) => s.loadRunnerFrameworks);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);

  useEffect(() => {
    if (!frameworks) void loadRunnerFrameworks();
  }, [frameworks, loadRunnerFrameworks]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRunDetail(id)
      .then(setDetail)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const fwLabel = (fwId: string) => frameworks?.find((f) => f.id === fwId)?.label ?? fwId;

  return (
    <div>
      <Link to="/reports" className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-ink-1">
        <ChevronLeft size={14} /> Back to Reports
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-[13px] text-muted-foreground">
          <Loader2 size={15} className="cp-spin" /> Loading the run story…
        </div>
      ) : error ? (
        <Card className="px-4 py-10 text-center">
          <p className="m-0 text-[13.5px] font-medium text-ink-1">Story unavailable</p>
          <p className="m-0 mt-1.5 text-[12.5px] text-muted-foreground">{error}</p>
        </Card>
      ) : detail ? (
        <>
          {/* Header — the run at a glance */}
          <Card className="mb-[18px] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Verdict status={detail.status} />
              <h1 className="m-0 text-[20px] font-bold tracking-tight">{fwLabel(detail.framework)}</h1>
              <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">{detail.mode}</span>
              <span className="flex-1" />
              <span className="text-[12px] text-muted-foreground">{timeAgo(detail.finishedAt ?? detail.startedAt)}</span>
            </div>
            {detail.verdict && detail.verdict.state !== "PASS" && (
              <p className="m-0 mt-2 text-[12.5px] font-medium" style={{ color: STATUS_COLOR[detail.status] ?? "var(--ink-2)" }}>
                {verdictNote(detail.verdict)}
                {detail.verdict.state === "BLOCKED" && <span className="ml-1.5 font-normal text-muted-foreground">— {detail.verdict.reason}</span>}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[12.5px]">
              <span className="text-ink-2">
                <span className="text-muted-foreground">Ran </span>
                <span className="font-mono">{detail.label}</span>
              </span>
              {detail.project && (
                <span className="text-ink-2">
                  <span className="text-muted-foreground">Browser </span>
                  {detail.project}
                </span>
              )}
              {Object.entries(detail.env).map(([k, v]) => (
                <span key={k} className="text-ink-2">
                  <span className="text-muted-foreground">{k} </span>
                  <span className="font-mono">{v}</span>
                </span>
              ))}
              {detail.taskRef && (
                <span className="text-ink-2">
                  <span className="text-muted-foreground">PR / task </span>
                  {detail.taskRef.label ?? (detail.taskRef.pr ? `#${detail.taskRef.pr}` : detail.taskRef.taskId)}
                </span>
              )}
              {detail.summary && (
                <span className="text-ink-2">
                  <span className="text-muted-foreground">Result </span>
                  {detail.summary.expected}✓
                  {detail.summary.unexpected ? ` · ${detail.summary.unexpected}✗` : ""}
                  {detail.summary.skipped ? ` · ${detail.summary.skipped} skipped` : ""}
                  {detail.summary.flaky ? ` · ${detail.summary.flaky} flaky` : ""}
                </span>
              )}
            </div>
          </Card>

          {/* Ad-hoc page screenshot */}
          {detail.screenshot && (
            <Card className="mb-[18px] overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <ImageIcon size={14} className="text-muted-foreground" />
                <h2 className="m-0 text-[13px] font-semibold">Page screenshot</h2>
              </div>
              <a href={detail.screenshot} target="_blank" rel="noreferrer">
                <img src={detail.screenshot} alt="page" className="max-h-[420px] w-full object-contain bg-surface-1" />
              </a>
            </Card>
          )}

          {/* Per-test stories */}
          {detail.tests.length > 0 ? (
            <div className="flex flex-col gap-[18px]">
              {detail.tests.map((t, i) => (
                <TestStory key={i} t={t} />
              ))}
            </div>
          ) : (
            <Card className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              No per-test trace for this run{detail.mode === "command" ? " (command-mode runs use the framework's own reporters)" : ""}. The
              terminal output below is the full record.
            </Card>
          )}

          {/* Raw terminal output (fallback / full detail) */}
          {detail.outputTail.trim() && (
            <Card className="mt-[18px] overflow-hidden">
              <button
                onClick={() => setShowTerminal((v) => !v)}
                className="flex w-full items-center gap-2 border-b border-border px-4 py-2.5 text-left hover:bg-surface-1"
              >
                <Terminal size={14} className="text-muted-foreground" />
                <h2 className="m-0 flex-1 text-[13px] font-semibold">Terminal output</h2>
                <span className="text-[11.5px] text-muted-foreground">{showTerminal ? "hide" : "show"}</span>
              </button>
              {showTerminal && (
                <pre
                  className="m-0 max-h-[460px] overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed"
                  style={{ background: "oklch(0.17 0.01 260)", color: "oklch(0.85 0.02 260)" }}
                >
                  {detail.outputTail}
                </pre>
              )}
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
