import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, GitBranch, Layers } from "lucide-react";
import { useTm } from "@/tm/store";
import { TM_RUN_STATUS_LABEL, TM_RUN_STATUS_TONE, type TmCase } from "@/tm/types";
import { Card, ProgressBar, StatusBadge } from "@/components/ui/primitives";

type ReqRow = {
  id: string;
  key: string;
  title: string;
  cases: TmCase[];
  total: number;
  passed: number;
  passPct: number | null;
};

type SuiteRow = {
  id: string;
  name: string;
  total: number;
  automated: number;
  passed: number;
  passPct: number | null;
};

function passRate(cases: TmCase[]): number | null {
  const passed = cases.filter((c) => c.lastRunStatus === "passed").length;
  const failed = cases.filter((c) => c.lastRunStatus === "failed").length;
  return passed + failed > 0 ? Math.round((passed / (passed + failed)) * 100) : null;
}

export function Traceability() {
  const requirements = useTm((s) => s.requirements);
  const cases = useTm((s) => s.cases);
  const suites = useTm((s) => s.suites);

  const caseById = useMemo(() => {
    const m = new Map<string, TmCase>();
    for (const c of cases) m.set(c.id, c);
    return m;
  }, [cases]);

  const reqRows = useMemo<ReqRow[]>(() => {
    return requirements.map((r) => {
      const linked = r.caseIds.map((id) => caseById.get(id)).filter((c): c is TmCase => Boolean(c));
      const passed = linked.filter((c) => c.lastRunStatus === "passed").length;
      return {
        id: r.id,
        key: r.key,
        title: r.title,
        cases: linked,
        total: linked.length,
        passed,
        passPct: passRate(linked),
      };
    });
  }, [requirements, caseById]);

  const suiteRows = useMemo<SuiteRow[]>(() => {
    return suites
      .map((su) => {
        const inSuite = cases.filter((c) => c.suiteId === su.id);
        return {
          id: su.id,
          name: su.name,
          total: inSuite.length,
          automated: inSuite.filter((c) => c.automation === "automated").length,
          passed: inSuite.filter((c) => c.lastRunStatus === "passed").length,
          passPct: passRate(inSuite),
        };
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [cases, suites]);

  const summary = useMemo(() => {
    const covered = reqRows.filter((r) => r.total > 0).length;
    const uncovered = reqRows.length - covered;
    return { total: reqRows.length, covered, uncovered };
  }, [reqRows]);

  if (requirements.length === 0) {
    return (
      <div>
        <div className="mb-[18px]">
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Traceability Matrix</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Map requirements to the test cases that verify them, and spot gaps in coverage.
          </p>
        </div>
        <Card className="p-10 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-ink-2">
            <GitBranch size={20} />
          </span>
          <div className="text-[14px] font-semibold text-ink-1">No requirements yet</div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] leading-[1.55] text-muted-foreground">
            Add requirements and link test cases to them to build the traceability matrix. Start on the{" "}
            <Link to="/tests/requirements" className="font-semibold text-primary hover:underline">
              Requirements
            </Link>{" "}
            screen.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-[18px]">
        <h1 className="m-0 text-[24px] font-bold tracking-tight">Traceability Matrix</h1>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          Each requirement mapped to its linked test cases and their latest run result — {summary.covered} of{" "}
          {summary.total} requirements covered
          {summary.uncovered > 0 ? `, ${summary.uncovered} with no coverage` : ""}.
        </p>
      </div>

      {/* Requirement → cases matrix */}
      <Card className="mb-4 min-w-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[92px_1fr_150px_90px] items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
              <span>Req</span>
              <span>Requirement &amp; linked cases</span>
              <span>Coverage</span>
              <span className="text-right">Pass %</span>
            </div>
            {reqRows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[92px_1fr_150px_90px] items-start gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <span className="mt-0.5 font-mono text-[12px] font-semibold text-ink-2">{r.key}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink-1">{r.title}</span>
                  {r.total === 0 ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-[4px] bg-warning-surface px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.04em] text-warning">
                      <AlertTriangle size={10} /> No coverage
                    </span>
                  ) : (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {r.cases.map((c) => (
                        <span
                          key={c.id}
                          title={`${c.key} · ${c.title} — ${TM_RUN_STATUS_LABEL[c.lastRunStatus]}`}
                          className="inline-flex items-center gap-1.5 rounded-[5px] border border-border bg-surface-1 px-1.5 py-0.5 text-[11px] font-medium text-ink-2"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: TM_RUN_STATUS_TONE[c.lastRunStatus].color }}
                          />
                          <span className="font-mono">{c.key}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="pt-0.5">
                  {r.total === 0 ? (
                    <span className="text-[12.5px] text-muted-foreground">0 cases</span>
                  ) : (
                    <span className="block">
                      <span className="mb-1 block text-[12px] text-muted-foreground">
                        {r.passed}/{r.total} passed
                      </span>
                      <ProgressBar
                        value={r.total ? Math.round((r.passed / r.total) * 100) : 0}
                        tone="var(--success)"
                      />
                    </span>
                  )}
                </span>
                <span className="pt-0.5 text-right">
                  {r.passPct == null ? (
                    <span className="text-[12.5px] text-muted-foreground">—</span>
                  ) : (
                    <span className="text-[13px] font-semibold tabular-nums text-ink-1">{r.passPct}%</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Coverage by suite */}
      <Card className="min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
          <Layers size={14} className="text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Coverage by suite</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[1fr_90px_110px_90px_140px] items-center gap-3 border-b border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
              <span>Suite</span>
              <span className="text-right">Cases</span>
              <span className="text-right">Automated</span>
              <span className="text-right">Passed</span>
              <span className="text-right">Pass %</span>
            </div>
            {suiteRows.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[1fr_90px_110px_90px_140px] items-center gap-3 border-b border-border px-4 py-2.5 text-[13px] last:border-0"
              >
                <span className="truncate font-medium text-ink-1">{s.name}</span>
                <span className="text-right tabular-nums text-ink-2">{s.total}</span>
                <span className="text-right tabular-nums text-ink-2">{s.automated}</span>
                <span className="text-right tabular-nums text-ink-2">{s.passed}</span>
                <span className="flex items-center justify-end gap-2">
                  {s.passPct == null ? (
                    <StatusBadge tone={TM_RUN_STATUS_TONE.unexecuted}>Unexecuted</StatusBadge>
                  ) : (
                    <>
                      <span className="w-16">
                        <ProgressBar value={s.passPct} tone="var(--success)" />
                      </span>
                      <span className="w-9 text-right font-semibold tabular-nums text-ink-1">{s.passPct}%</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
