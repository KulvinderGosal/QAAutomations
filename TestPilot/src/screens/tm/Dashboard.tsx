import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bug, CheckCircle2, ClipboardList, Clock, FileText, FlaskConical, GitBranch, Layers, ShieldCheck, Sparkles, Target } from "lucide-react";
import { useTm } from "@/tm/store";
import {
  TM_RUN_STATUS_COLOR,
  TM_RUN_STATUS_LABEL,
  TM_PRIORITY_LABEL,
  TM_PRIORITY_TONE,
  type TmRunStatus,
} from "@/tm/types";
import { Card } from "@/components/ui/primitives";
import { Donut } from "@/components/charts/Donut";
import { timeAgo } from "@/lib/utils";

const ACT_ICON = {
  case: FileText,
  run: FlaskConical,
  plan: ClipboardList,
  defect: Bug,
  copilot: Sparkles,
  suite: Layers,
  requirement: FileText,
  risk: GitBranch,
  release: GitBranch,
} as const;

export function TmDashboard() {
  const cases = useTm((s) => s.cases);
  const plans = useTm((s) => s.plans);
  const executions = useTm((s) => s.executions);
  const defects = useTm((s) => s.defects);
  const suites = useTm((s) => s.suites);
  const requirements = useTm((s) => s.requirements);
  const activity = useTm((s) => s.activity);

  const stats = useMemo(() => {
    const automated = cases.filter((c) => c.automation === "automated").length;
    const executed = cases.filter((c) => c.lastRunStatus !== "unexecuted");
    const passed = cases.filter((c) => c.lastRunStatus === "passed").length;
    const failed = cases.filter((c) => c.lastRunStatus === "failed").length;
    const totalRuns = cases.reduce((a, c) => a + c.runs, 0);
    const passRate = passed + failed > 0 ? Math.round((passed / (passed + failed)) * 100) : null;
    return {
      total: cases.length,
      automated,
      autoPct: cases.length ? Math.round((automated / cases.length) * 100) : 0,
      executions: executions.length + totalRuns,
      passRate,
      openDefects: defects.filter((d) => d.status === "open" || d.status === "in-progress").length,
      activePlans: plans.filter((p) => p.status === "active").length,
      suites: suites.length,
      neverRun: cases.length - executed.length,
      pending: cases.filter((c) => c.review === "pending").length,
    };
  }, [cases, plans, executions, defects, suites]);

  // Cross-cutting QA KPIs (best-practice: coverage, defect density, escape rate,
  // resolution time). All derived from the in-store collections.
  const qa = useMemo(() => {
    const total = cases.length;
    const executed = cases.filter((c) => c.lastRunStatus !== "unexecuted").length;
    const coverage = total ? Math.round((executed / total) * 100) : null;

    const caseById = new Map(cases.map((c) => [c.id, c]));
    const reqTotal = requirements.length;
    const reqCovered = requirements.filter((r) => r.caseIds.some((cid) => caseById.get(cid)?.lastRunStatus === "passed")).length;
    const reqCoverage = reqTotal ? Math.round((reqCovered / reqTotal) * 100) : null;

    const totalDefects = defects.length;
    // Defect density = defects per 100 test cases.
    const density = total ? Math.round((totalDefects / total) * 100) : 0;
    // Escape rate = share of defects that escaped to the real bug tracker (GitHub)
    // or are explicitly flagged as escaped.
    const escaped = defects.filter((d) => d.escaped ?? !!d.github).length;
    const escapeRate = totalDefects ? Math.round((escaped / totalDefects) * 100) : null;
    // Avg resolution time over defects that carry a resolvedAt stamp.
    const resolved = defects.filter((d) => d.resolvedAt);
    const avgResMs = resolved.length
      ? resolved.reduce((a, d) => a + (new Date(d.resolvedAt as string).getTime() - new Date(d.createdAt).getTime()), 0) / resolved.length
      : null;
    const avgRes =
      avgResMs == null
        ? "—"
        : avgResMs < 3_600_000
          ? `${Math.max(1, Math.round(avgResMs / 60_000))}m`
          : avgResMs < 172_800_000
            ? `${Math.round(avgResMs / 3_600_000)}h`
            : `${Math.round(avgResMs / 86_400_000)}d`;
    return { coverage, reqCoverage, density, escapeRate, avgRes };
  }, [cases, requirements, defects]);

  const qaTiles = [
    { label: "Test coverage", value: qa.coverage == null ? "—" : `${qa.coverage}%`, sub: "cases executed", icon: Target, to: "/tests/runs" },
    { label: "Requirement coverage", value: qa.reqCoverage == null ? "—" : `${qa.reqCoverage}%`, sub: "reqs with a passing case", icon: ShieldCheck, to: "/tests/traceability" },
    { label: "Defect density", value: `${qa.density}`, sub: "per 100 cases", icon: Bug, to: "/tests/defects" },
    { label: "Escape rate", value: qa.escapeRate == null ? "—" : `${qa.escapeRate}%`, sub: "defects reaching GitHub", icon: AlertTriangle, to: "/tests/defects" },
    { label: "Avg resolution", value: qa.avgRes, sub: "time to fix", icon: Clock, to: "/tests/defects" },
  ];

  const statusSlices = useMemo(() => {
    const order: TmRunStatus[] = ["passed", "failed", "skipped", "blocked", "unexecuted"];
    return order
      .map((st) => ({
        label: TM_RUN_STATUS_LABEL[st],
        value: cases.filter((c) => c.lastRunStatus === st).length,
        color: st === "unexecuted" ? "oklch(0.85 0 0)" : TM_RUN_STATUS_COLOR[st as Exclude<TmRunStatus, "unexecuted">],
      }))
      .filter((s) => s.value > 0);
  }, [cases]);

  const prioritySlices = useMemo(() => {
    return (["critical", "high", "normal", "low"] as const)
      .map((p) => ({
        label: TM_PRIORITY_LABEL[p],
        value: cases.filter((c) => c.priority === p).length,
        color: TM_PRIORITY_TONE[p].color,
      }))
      .filter((s) => s.value > 0);
  }, [cases]);

  const tiles = [
    { label: "Test Cases", value: stats.total, icon: FileText, to: "/tests" },
    { label: "Automated", value: `${stats.automated}`, sub: `${stats.autoPct}% of cases`, icon: FlaskConical, to: "/tests" },
    { label: "Executions", value: stats.executions, icon: CheckCircle2, to: "/tests/runs" },
    { label: "Pass rate", value: stats.passRate == null ? "—" : `${stats.passRate}%`, icon: CheckCircle2, to: "/tests/runs" },
    { label: "Open defects", value: stats.openDefects, icon: Bug, to: "/tests/defects" },
    { label: "Active plans", value: stats.activePlans, icon: ClipboardList, to: "/tests/plans" },
    { label: "Suites", value: stats.suites, icon: Layers, to: "/tests" },
    { label: "Review pending", value: stats.pending, icon: Sparkles, to: "/tests" },
  ];

  return (
    <div>
      <div className="mb-[18px]">
        <h1 className="m-0 text-[24px] font-bold tracking-tight">Project Dashboard</h1>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          Test-management overview — cases, execution results, and coverage across the QA suites.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.label} to={t.to}>
              <Card className="cp-card-hover flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[22px] font-bold leading-none tracking-tight text-ink-1">{t.value}</span>
                  <span className="mt-1 block truncate text-[12px] text-muted-foreground">{t.sub ?? t.label}</span>
                  {t.sub && <span className="block truncate text-[11px] text-muted-foreground">{t.label}</span>}
                </span>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mb-2 mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Quality metrics
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {qaTiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.label} to={t.to}>
              <Card className="cp-card-hover p-4">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Icon size={15} />
                  <span className="truncate text-[11.5px] font-semibold uppercase tracking-[0.04em]">{t.label}</span>
                </span>
                <span className="mt-2 block text-[24px] font-bold leading-none tracking-tight text-ink-1">{t.value}</span>
                <span className="mt-1.5 block truncate text-[11.5px] text-muted-foreground">{t.sub}</span>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 text-[13px] font-semibold text-ink-1">Test case status</div>
          {statusSlices.length ? (
            <Donut slices={statusSlices} unit="cases" />
          ) : (
            <div className="py-6 text-center text-[13px] text-muted-foreground">No cases yet.</div>
          )}
        </Card>
        <Card className="p-5">
          <div className="mb-3 text-[13px] font-semibold text-ink-1">Cases by priority</div>
          {prioritySlices.length ? (
            <Donut slices={prioritySlices} unit="cases" />
          ) : (
            <div className="py-6 text-center text-[13px] text-muted-foreground">No cases yet.</div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 text-[13px] font-semibold text-ink-1">Recent activity</div>
        {activity.length === 0 ? (
          <div className="py-4 text-center text-[13px] text-muted-foreground">Nothing yet.</div>
        ) : (
          <div className="flex flex-col">
            {activity.slice(0, 12).map((a) => {
              const Icon = ACT_ICON[a.icon] ?? FileText;
              return (
                <div key={a.id} className="flex items-start gap-2.5 border-b border-border py-2.5 last:border-0">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-2">
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] leading-[1.4] text-ink-1" dangerouslySetInnerHTML={{ __html: a.html }} />
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {a.by} · {timeAgo(a.at)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
