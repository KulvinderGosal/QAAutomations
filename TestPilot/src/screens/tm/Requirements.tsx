import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Link2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useTm } from "@/tm/store";
import { useStore } from "@/store/useStore";
import { aiCoverageGap, type CoverageGap } from "@/lib/qaPlanner";
import type { ApiError } from "@/lib/runner";
import {
  TM_RUN_STATUS_LABEL,
  TM_RUN_STATUS_TONE,
  type TmCase,
  type TmRequirement,
  type TmSuite,
} from "@/tm/types";
import { Button, Card, Chip, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";

const INPUT =
  "w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";
const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground";

// Share of linked cases whose latest run passed, as a 0-100 percentage.
function coverageFor(caseIds: string[], cases: TmCase[]): { pct: number; passed: number; total: number } {
  const linked = cases.filter((c) => caseIds.includes(c.id));
  const passed = linked.filter((c) => c.lastRunStatus === "passed").length;
  const total = linked.length;
  return { pct: total ? Math.round((passed / total) * 100) : 0, passed, total };
}

function coverageTone(pct: number): string {
  if (pct >= 80) return "var(--success)";
  if (pct >= 40) return "var(--caution)";
  return "var(--destructive)";
}

export function Requirements() {
  const requirements = useTm((s) => s.requirements);
  const cases = useTm((s) => s.cases);
  const suites = useTm((s) => s.suites);
  const deleteRequirement = useTm((s) => s.deleteRequirement);
  const aiUnfunded = useStore((s) => s.aiUnfunded);

  const [editing, setEditing] = useState<TmRequirement | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, { loading: boolean; error?: string; gap?: CoverageGap }>>({});

  const suiteName = (id: string) => suites.find((s) => s.id === id)?.name ?? "—";

  const analyze = async (r: TmRequirement) => {
    setAnalysis((a) => ({ ...a, [r.id]: { loading: true } }));
    const linked = cases.filter((c) => r.caseIds.includes(c.id));
    try {
      const { gap } = await aiCoverageGap(
        { key: r.key, title: r.title, description: r.description },
        linked.map((c) => ({ key: c.key, title: c.title, steps: c.steps.map((s) => `${s.step} → ${s.expected}`) })),
      );
      setAnalysis((a) => ({ ...a, [r.id]: { loading: false, gap } }));
    } catch (e) {
      const err = e as ApiError;
      const msg =
        err.status === 402
          ? "AI coverage analysis needs Anthropic credits — fund the key to enable it."
          : err.message || "Coverage analysis failed.";
      setAnalysis((a) => ({ ...a, [r.id]: { loading: false, error: msg } }));
    }
  };

  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Requirements</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Trace requirements to the test cases that verify them — coverage is the share of linked cases whose latest
            run passed.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus size={14} /> Add requirement
        </Button>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="grid grid-cols-[26px_92px_1fr_120px_180px_56px] items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <span />
          <span>Key</span>
          <span>Requirement</span>
          <span>Linked</span>
          <span>Coverage</span>
          <span className="text-right">Edit</span>
        </div>

        {requirements.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-muted-foreground">
            No requirements yet. Add one and link the test cases that verify it.
          </div>
        ) : (
          requirements.map((r) => {
            const open = openId === r.id;
            const cov = coverageFor(r.caseIds, cases);
            const linked = cases.filter((c) => r.caseIds.includes(c.id));
            return (
              <div key={r.id}>
                <div
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="grid cursor-pointer grid-cols-[26px_92px_1fr_120px_180px_56px] items-center gap-2 border-b border-border px-4 py-3 hover:bg-surface-1"
                >
                  <span className="text-muted-foreground">
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </span>
                  <span className="font-mono text-[12px] font-semibold text-ink-2">{r.key}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink-1">{r.title}</span>
                    {r.description && (
                      <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{r.description}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
                    <Link2 size={12} /> {cov.total} case{cov.total === 1 ? "" : "s"}
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                    {cov.total === 0 ? (
                      <span className="text-[12px] text-muted-foreground">No linked cases</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="flex-1">
                          <ProgressBar value={cov.pct} tone={coverageTone(cov.pct)} />
                        </span>
                        <span className="w-[64px] shrink-0 text-right text-[12px] tabular-nums text-ink-2">
                          {cov.pct}% ({cov.passed}/{cov.total})
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                  </span>
                </div>

                {open && (
                  <div className="border-b border-border bg-surface-1 px-4 py-3">
                    {linked.length === 0 ? (
                      <div className="py-2 text-center text-[12.5px] text-muted-foreground">
                        No test cases linked yet — edit this requirement to link some.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {linked.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-3 rounded-control bg-card px-3 py-2 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]"
                          >
                            <span className="font-mono text-[12px] font-semibold text-ink-2">{c.key}</span>
                            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-1">{c.title}</span>
                            <span className="shrink-0 text-[11.5px] text-muted-foreground">{suiteName(c.suiteId)}</span>
                            <StatusBadge tone={TM_RUN_STATUS_TONE[c.lastRunStatus]}>
                              {TM_RUN_STATUS_LABEL[c.lastRunStatus]}
                            </StatusBadge>
                          </div>
                        ))}
                      </div>
                    )}

                    <CoverageAnalysis
                      state={analysis[r.id]}
                      unfunded={aiUnfunded}
                      onAnalyze={() => analyze(r)}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>

      {editing && (
        <RequirementEditor
          initial={editing === "new" ? null : editing}
          cases={cases}
          suites={suites}
          onClose={() => setEditing(null)}
          onDeleted={() => {
            if (editing !== "new" && openId === editing.id) setOpenId(null);
          }}
          deleteRequirement={deleteRequirement}
        />
      )}
    </div>
  );
}

function RequirementEditor({
  initial,
  cases,
  suites,
  onClose,
  onDeleted,
  deleteRequirement,
}: {
  initial: TmRequirement | null;
  cases: TmCase[];
  suites: TmSuite[];
  onClose: () => void;
  onDeleted: () => void;
  deleteRequirement: (id: string) => void;
}) {
  const addRequirement = useTm((s) => s.addRequirement);
  const updateRequirement = useTm((s) => s.updateRequirement);
  const pushToast = useStore((s) => s.pushToast);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [linked, setLinked] = useState<Set<string>>(new Set(initial?.caseIds ?? []));

  // Group the case checklist by suite name (only suites that hold cases).
  const groups = useMemo(() => {
    const suiteName = (id: string) => suites.find((s) => s.id === id)?.name ?? "Unassigned";
    const bySuite = new Map<string, TmCase[]>();
    for (const c of cases) {
      const name = suiteName(c.suiteId);
      const arr = bySuite.get(name) ?? [];
      arr.push(c);
      bySuite.set(name, arr);
    }
    return [...bySuite.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cases, suites]);

  const toggle = (id: string) =>
    setLinked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = () => {
    if (!title.trim()) return;
    const caseIds = [...linked];
    if (initial) {
      updateRequirement(initial.id, { title: title.trim(), description: description.trim(), caseIds });
    } else {
      addRequirement(title.trim(), description.trim(), caseIds);
    }
    pushToast({
      icon: "generate",
      title: initial ? "Requirement updated" : "Requirement added",
      subtitle: `${caseIds.length} case${caseIds.length === 1 ? "" : "s"} linked`,
    });
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={initial ? `Edit ${initial.key}` : "Add requirement"}
      width={620}
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={INPUT}
            placeholder="What must the product do?"
          />
        </div>
        <div>
          <label className={LABEL}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} rows={3} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={LABEL}>Linked test cases</label>
            <span className="text-[11px] font-medium text-muted-foreground">{linked.size} selected</span>
          </div>
          <div className="max-h-[320px] overflow-y-auto rounded-card border border-border">
            {groups.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted-foreground">No test cases to link yet.</div>
            ) : (
              groups.map(([name, list]) => (
                <div key={name}>
                  <div className="sticky top-0 border-b border-border bg-surface-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                    {name}
                  </div>
                  {list.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2 last:border-0 hover:bg-surface-1"
                    >
                      <input
                        type="checkbox"
                        checked={linked.has(c.id)}
                        onChange={() => toggle(c.id)}
                        className="h-[15px] w-[15px] cursor-pointer accent-[var(--primary)]"
                      />
                      <span className="font-mono text-[11.5px] font-semibold text-ink-2">{c.key}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-1">{c.title}</span>
                      <Chip tone={TM_RUN_STATUS_TONE[c.lastRunStatus]}>{TM_RUN_STATUS_LABEL[c.lastRunStatus]}</Chip>
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        {initial ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              deleteRequirement(initial.id);
              onDeleted();
              onClose();
            }}
          >
            <Trash2 size={13} /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={!title.trim()} onClick={save}>
            {initial ? "Save changes" : "Add requirement"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const VERDICT_TONE = {
  "well-covered": { label: "Well covered", color: "var(--success)", surface: "var(--success-surface)" },
  partial: { label: "Partial", color: "var(--caution)", surface: "var(--caution-surface)" },
  gap: { label: "Coverage gap", color: "var(--destructive)", surface: "var(--destructive-surface)" },
} as const;

// AI coverage-gap panel shown inside an expanded requirement row.
function CoverageAnalysis({
  state,
  unfunded,
  onAnalyze,
}: {
  state?: { loading: boolean; error?: string; gap?: CoverageGap };
  unfunded: boolean;
  onAnalyze: () => void;
}) {
  const gap = state?.gap;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <Sparkles size={13} /> AI coverage analysis
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={state?.loading || unfunded}
          title={unfunded ? "Needs Anthropic credits" : undefined}
          onClick={onAnalyze}
        >
          <Sparkles size={13} /> {state?.loading ? "Analyzing…" : gap ? "Re-analyze" : "Analyze coverage"}
        </Button>
      </div>

      {state?.error && <div className="mt-2 text-[12.5px] text-[var(--destructive)]">{state.error}</div>}

      {gap && !state?.loading && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <Chip tone={VERDICT_TONE[gap.verdict]}>{VERDICT_TONE[gap.verdict].label}</Chip>
            <span className="text-[12.5px] text-ink-2">{gap.summary}</span>
          </div>
          {gap.untested.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Untested</div>
              <ul className="ml-4 list-disc space-y-0.5 text-[12.5px] text-ink-2">
                {gap.untested.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          {gap.suggestedCases.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Suggested cases</div>
              <div className="space-y-1">
                {gap.suggestedCases.map((s, i) => (
                  <div key={i} className="rounded-control bg-card px-3 py-1.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                    <div className="text-[12.5px] font-semibold text-ink-1">{s.title}</div>
                    <div className="text-[11.5px] text-muted-foreground">{s.rationale}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
