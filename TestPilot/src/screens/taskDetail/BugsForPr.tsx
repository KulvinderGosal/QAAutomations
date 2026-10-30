import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, ExternalLink, Loader2, MessageSquare, Sparkles, X } from "lucide-react";
import { Card, EyebrowLabel } from "@/components/ui/primitives";
import { Donut, type Slice } from "@/components/charts/Donut";
import { useStore } from "@/store/useStore";
import { closeRepoIssue, fetchRepoIssues, type RepoIssue } from "@/lib/github";
import type { Task } from "@/types";

// Generic labels that don't define a "feature/work" scope. Everything else on
// the PR issue (e.g. "shopify revamp", "Next Release(…)") is treated as the
// scope for "bugs reported for this PR".
const GENERIC = new Set([
  "bug",
  "improvement",
  "enhancement",
  "question",
  "documentation",
  "duplicate",
  "wontfix",
  "invalid",
  "help wanted",
  "good first issue",
]);

const IMPROVEMENT_HINTS = ["improvement", "enhancement", "feature", "next release"];

function isImprovement(labels: string[]): boolean {
  return labels.some((l) => IMPROVEMENT_HINTS.some((k) => l.toLowerCase().includes(k)));
}

type Category = "bug" | "improvement" | "addressed";
function categorize(i: RepoIssue): Category {
  if (i.state === "closed") return "addressed";
  return isImprovement(i.labels) ? "improvement" : "bug";
}

function LabelChips({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {labels.slice(0, 4).map((l) => (
        <span key={l} className="rounded-chip bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-ink-2">
          {l}
        </span>
      ))}
    </span>
  );
}

export function BugsForPr({ task }: { task: Task }) {
  const gh = task.github;
  const pushToast = useStore((s) => s.pushToast);

  const [issues, setIssues] = useState<RepoIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"related" | "all">("related");
  const [closing, setClosing] = useState<number | null>(null);
  const [locallyClosed, setLocallyClosed] = useState<Set<number>>(new Set());
  const [showClosed, setShowClosed] = useState(false);

  const repo = gh?.repo;
  useEffect(() => {
    if (!repo) return;
    let alive = true;
    setIssues(null);
    setError(null);
    fetchRepoIssues(repo)
      .then((r) => {
        if (!alive) return;
        if ("issues" in r) setIssues(r.issues);
        else setError(r.error || r.reason || "Couldn't load issues");
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [repo]);

  const featureLabels = useMemo(() => (gh?.labels ?? []).filter((l) => !GENERIC.has(l.toLowerCase())), [gh?.labels]);

  const all = useMemo(
    () => (issues ?? []).map((i) => (locallyClosed.has(i.number) ? { ...i, state: "closed", closedAt: new Date().toISOString() } : i)),
    [issues, locallyClosed],
  );

  // "Related to this PR" = the PR issue itself + issues sharing a feature label.
  const related = useMemo(() => {
    if (!featureLabels.length) return all;
    return all.filter((i) => i.number === gh?.number || i.labels.some((l) => featureLabels.includes(l)));
  }, [all, featureLabels, gh?.number]);

  const shown = scope === "related" && featureLabels.length ? related : all;

  const openBugs = shown.filter((i) => categorize(i) === "bug");
  const improvements = shown.filter((i) => categorize(i) === "improvement");
  const addressed = shown.filter((i) => categorize(i) === "addressed");
  const openItems = [...openBugs, ...improvements].sort((a, b) => b.number - a.number);

  const slices: Slice[] = [
    { label: "Open bugs", value: openBugs.length, color: "var(--destructive)" },
    { label: "Addressed", value: addressed.length, color: "var(--success)" },
    { label: "Future improvements", value: improvements.length, color: "var(--info)" },
  ].filter((s) => s.value > 0);

  const doClose = async (num: number) => {
    if (!repo) return;
    if (!window.confirm(`Close issue #${num} on GitHub?\n\nThis updates the real ${repo} repository.`)) return;
    setClosing(num);
    try {
      const r = await closeRepoIssue(repo, num);
      if (r.issue) {
        setLocallyClosed((prev) => new Set(prev).add(num));
        pushToast({ icon: "check", title: `Closed #${num}`, subtitle: repo });
      } else {
        pushToast({ icon: "issue", title: `Couldn't close #${num}`, subtitle: r.error || "GitHub error (token may be read-only)" });
      }
    } catch (e) {
      pushToast({ icon: "issue", title: `Couldn't close #${num}`, subtitle: (e as Error).message });
    } finally {
      setClosing(null);
    }
  };

  if (!gh) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Bug size={16} className="text-primary" />
        <h2 className="m-0 text-[15px] font-semibold">Bugs &amp; issues for this PR</h2>
        <span className="text-[12px] text-muted-foreground">{gh.repo}</span>
        {featureLabels.length > 0 && (
          <div className="ml-auto flex items-center gap-1 rounded-control border border-border p-0.5 text-[11.5px]">
            <button
              onClick={() => setScope("related")}
              className={scope === "related" ? "rounded-[6px] bg-primary px-2 py-0.5 font-semibold text-primary-foreground" : "px-2 py-0.5 text-ink-2"}
            >
              {featureLabels.join(" · ")}
            </button>
            <button
              onClick={() => setScope("all")}
              className={scope === "all" ? "rounded-[6px] bg-primary px-2 py-0.5 font-semibold text-primary-foreground" : "px-2 py-0.5 text-ink-2"}
            >
              All repo issues
            </button>
          </div>
        )}
      </div>

      <div className="p-4">
        {error && (
          <div className="flex items-center gap-2 rounded-control border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] px-3 py-2.5 text-[13px] text-warning">
            <AlertTriangle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {!issues && !error && (
          <div className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground">
            <Loader2 size={15} className="cp-spin" /> Loading issues from GitHub…
          </div>
        )}

        {issues && !error && (
          <>
            {/* Summary: pie + stat tiles */}
            <div className="mb-5 flex flex-wrap items-center gap-6 rounded-card border border-border bg-surface-1 p-4">
              {slices.length > 0 ? (
                <Donut slices={slices} size={132} unit="issues" />
              ) : (
                <div className="text-[13px] text-muted-foreground">No issues in this scope.</div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Reported" value={shown.length} tone="var(--ink-2)" />
                <Stat label="Open bugs" value={openBugs.length} tone="var(--destructive)" />
                <Stat label="Addressed" value={addressed.length} tone="var(--success)" />
                <Stat label="Improvements" value={improvements.length} tone="var(--info)" />
              </div>
            </div>

            {/* Open / actionable issues */}
            <EyebrowLabel className="mb-2">Open — pick, test &amp; close ({openItems.length})</EyebrowLabel>
            {openItems.length === 0 ? (
              <div className="rounded-control border border-border bg-surface-1 px-3 py-4 text-center text-[13px] text-muted-foreground">
                <CheckCircle2 size={16} className="mx-auto mb-1 text-success" /> Nothing open — all addressed.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {openItems.map((i) => (
                  <div key={i.number} className="flex items-start gap-3 rounded-control border border-border p-3 hover:bg-surface-1">
                    <span
                      className="mt-0.5 shrink-0 rounded-chip px-1.5 py-0.5 text-[10px] font-bold"
                      style={
                        categorize(i) === "improvement"
                          ? { background: "var(--info-surface)", color: "var(--info)" }
                          : { background: "var(--destructive-surface)", color: "var(--destructive)" }
                      }
                    >
                      {categorize(i) === "improvement" ? <Sparkles size={11} /> : <Bug size={11} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-1">
                        <span className="text-muted-foreground">#{i.number}</span>
                        <span className="truncate">{i.title}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <LabelChips labels={i.labels} />
                        {i.comments > 0 && (
                          <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                            <MessageSquare size={11} /> {i.comments}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex shrink-0 items-center gap-1 rounded-control border border-border px-2 py-1 text-[11.5px] font-medium text-ink-2 hover:bg-surface-2"
                      title="Open on GitHub to test"
                    >
                      <ExternalLink size={12} /> View
                    </a>
                    <button
                      onClick={() => doClose(i.number)}
                      disabled={closing === i.number}
                      className="flex shrink-0 items-center gap-1 rounded-control border border-[color-mix(in_srgb,var(--success)_45%,transparent)] px-2 py-1 text-[11.5px] font-medium text-success hover:bg-success-surface disabled:opacity-50"
                      title="Close this issue on GitHub"
                    >
                      {closing === i.number ? <Loader2 size={12} className="cp-spin" /> : <CheckCircle2 size={12} />} Close
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Addressed / closed */}
            {addressed.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowClosed((v) => !v)}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-ink-2"
                >
                  <CheckCircle2 size={13} className="text-success" /> Addressed / closed ({addressed.length}) {showClosed ? "▾" : "▸"}
                </button>
                {showClosed && (
                  <div className="mt-2 max-h-[280px] overflow-y-auto rounded-control border border-border">
                    {addressed
                      .sort((a, b) => b.number - a.number)
                      .map((i) => (
                        <a
                          key={i.number}
                          href={i.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12.5px] last:border-b-0 hover:bg-surface-1"
                        >
                          <X size={12} className="shrink-0 text-muted-foreground" />
                          <span className="shrink-0 text-muted-foreground">#{i.number}</span>
                          <span className="min-w-0 flex-1 truncate text-ink-2">{i.title}</span>
                          <ExternalLink size={11} className="shrink-0 text-muted-foreground" />
                        </a>
                      ))}
                  </div>
                )}
              </div>
            )}

            <p className="mt-3 text-[11px] text-muted-foreground">
              "Close" performs a real close on {gh.repo} via the GitHub API (needs a token with write access). Data is
              live from GitHub.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-control border border-border bg-card px-3 py-2">
      <div className="text-[20px] font-bold leading-none" style={{ color: tone }}>
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}
