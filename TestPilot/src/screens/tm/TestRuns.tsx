import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ClipboardList, Loader2, Play } from "lucide-react";
import { useTm } from "@/tm/store";
import { useStore } from "@/store/useStore";
import {
  TM_FRAMEWORKS,
  TM_PLAN_STATUS_LABEL,
  TM_PRIORITY_LABEL,
  TM_PRIORITY_TONE,
  TM_RUN_STATUS_LABEL,
  TM_RUN_STATUS_TONE,
  type TmCase,
  type TmPlan,
  type TmRunStatus,
} from "@/tm/types";
import { Button, Card, Chip, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";

const INPUT =
  "w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";

const RECORD_ORDER: TmRunStatus[] = ["passed", "failed", "blocked", "skipped"];

export function TestRuns() {
  const plans = useTm((s) => s.plans);
  const cases = useTm((s) => s.cases);
  const runningCaseIds = useTm((s) => s.runningCaseIds);
  const recordExecution = useTm((s) => s.recordExecution);
  const runCase = useTm((s) => s.runCase);
  const updatePlan = useTm((s) => s.updatePlan);
  const pushToast = useStore((s) => s.pushToast);

  const [searchParams] = useSearchParams();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(() => searchParams.get("plan"));
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Effective plan: honor the (possibly stale) selection, else fall back to the first.
  const plan = useMemo<TmPlan | null>(() => {
    return plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;
  }, [plans, selectedPlanId]);

  // The plan's cases, in the plan's declared order.
  const planCases = useMemo<TmCase[]>(() => {
    if (!plan) return [];
    return plan.caseIds.map((id) => cases.find((c) => c.id === id)).filter((c): c is TmCase => Boolean(c));
  }, [plan, cases]);

  const summary = useMemo(() => {
    const counts: Record<TmRunStatus, number> = {
      unexecuted: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      blocked: 0,
    };
    for (const c of planCases) counts[c.lastRunStatus] += 1;
    const total = planCases.length;
    const executed = total - counts.unexecuted;
    return { counts, total, executed, pct: total ? Math.round((executed / total) * 100) : 0 };
  }, [planCases]);

  const allExecuted = summary.total > 0 && summary.executed === summary.total;

  const markCompleted = () => {
    if (!plan) return;
    updatePlan(plan.id, { status: "completed" });
    pushToast({ icon: "generate", title: `${plan.key} marked completed`, subtitle: plan.title });
  };

  if (plans.length === 0) {
    return (
      <div>
        <div className="mb-[18px]">
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Test Runs</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Execute a test plan — record each case as passed, failed, blocked or skipped, or run automated cases live.
          </p>
        </div>
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-control bg-primary/10 text-primary">
            <ClipboardList size={22} />
          </span>
          <div className="text-[15px] font-semibold text-ink-1">No test plans yet</div>
          <p className="m-0 max-w-[380px] text-[13px] leading-[1.55] text-muted-foreground">
            Test runs execute a plan. Head over to Test Cases, select the cases you want to cover, and create a plan from
            them.
          </p>
          <Link to="/tests">
            <Button variant="primary" size="sm">
              Go to Test Cases
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-[18px]">
        <h1 className="m-0 text-[24px] font-bold tracking-tight">Test Runs</h1>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          Execute a test plan — record each case as passed, failed, blocked or skipped, or run automated cases live.
        </p>
      </div>

      <div className="flex gap-4">
        {/* Plan picker */}
        <Card className="w-[260px] shrink-0 self-start p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Test Plans</div>
          {plans.map((p) => {
            const active = plan?.id === p.id;
            const count = p.caseIds.length;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={`mb-0.5 flex w-full flex-col gap-0.5 rounded-control px-2 py-2 text-left ${
                  active ? "bg-primary/10 text-primary" : "text-ink-2 hover:bg-surface-2"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-semibold">{p.key}</span>
                  <span className="ml-auto rounded-full bg-surface-3 px-1.5 text-[10.5px] font-bold text-ink-2">
                    {count}
                  </span>
                </span>
                <span className="truncate text-[13px] font-medium">{p.title}</span>
                <span className="text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground">
                  {TM_PLAN_STATUS_LABEL[p.status]}
                </span>
              </button>
            );
          })}
        </Card>

        {/* Execution checklist */}
        <Card className="min-w-0 flex-1 overflow-hidden">
          {plan && (
            <>
              <div className="border-b border-border bg-surface-2 px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] font-semibold text-ink-2">{plan.key}</span>
                  <span className="text-[15px] font-semibold text-ink-1">{plan.title}</span>
                  <Chip tone={TM_PRIORITY_TONE[plan.priority]}>{TM_PRIORITY_LABEL[plan.priority]}</Chip>
                  <StatusBadge tone={TM_RUN_STATUS_TONE[plan.status === "completed" ? "passed" : "unexecuted"]}>
                    {TM_PLAN_STATUS_LABEL[plan.status]}
                  </StatusBadge>
                  <span className="flex-1" />
                  {allExecuted && plan.status !== "completed" && (
                    <Button variant="primary" size="sm" onClick={markCompleted}>
                      <CheckCircle2 size={13} /> Mark plan completed
                    </Button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {RECORD_ORDER.map((st) => (
                    <span key={st} className="text-[12px] text-muted-foreground">
                      <b className="tabular-nums text-ink-1">{summary.counts[st]}</b> {TM_RUN_STATUS_LABEL[st]}
                    </span>
                  ))}
                  {summary.counts.unexecuted > 0 && (
                    <span className="text-[12px] text-muted-foreground">
                      <b className="tabular-nums text-ink-1">{summary.counts.unexecuted}</b> Unexecuted
                    </span>
                  )}
                  <span className="ml-auto text-[12px] font-semibold text-ink-2">
                    {summary.executed}/{summary.total} executed
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={summary.pct} tone={allExecuted ? "var(--success)" : "var(--primary)"} />
                </div>
              </div>

              {planCases.length === 0 ? (
                <div className="p-10 text-center text-[13.5px] text-muted-foreground">
                  This plan has no cases. Add cases to it from Test Cases.
                </div>
              ) : (
                planCases.map((c) => {
                  const running = runningCaseIds.includes(c.id);
                  const canRun = c.automation === "automated" && Boolean(c.frameworkId);
                  return (
                    <div key={c.id} className="border-b border-border px-4 py-3 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[12px] font-semibold text-ink-2">{c.key}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-ink-1">{c.title}</span>
                          {canRun && (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {TM_FRAMEWORKS.find((f) => f.id === c.frameworkId)?.label ?? c.frameworkId}
                              {c.specFile ? ` · ${c.specFile}` : " · smoke"}
                              {c.lastRunAt ? ` · ${timeAgo(c.lastRunAt)}` : ""}
                            </span>
                          )}
                        </span>
                        {running ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emphasis">
                            <Loader2 size={13} className="cp-spin" /> Running
                          </span>
                        ) : (
                          <StatusBadge tone={TM_RUN_STATUS_TONE[c.lastRunStatus]}>
                            {TM_RUN_STATUS_LABEL[c.lastRunStatus]}
                          </StatusBadge>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {RECORD_ORDER.map((st) => (
                          <Button
                            key={st}
                            size="sm"
                            variant={c.lastRunStatus === st ? "primary" : "outline"}
                            onClick={() => recordExecution(plan.id, c.id, st, notes[c.id]?.trim() || undefined)}
                          >
                            {TM_RUN_STATUS_LABEL[st]}
                          </Button>
                        ))}
                        {canRun && (
                          <Button size="sm" variant="outline" disabled={running} onClick={() => void runCase(c.id)}>
                            {running ? <Loader2 size={12} className="cp-spin" /> : <Play size={12} />} Run
                          </Button>
                        )}
                        <input
                          value={notes[c.id] ?? ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          placeholder="Note (optional)…"
                          className={`${INPUT} ml-auto max-w-[240px]`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
