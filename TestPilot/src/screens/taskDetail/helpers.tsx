import { Ban, CircleCheckBig, CircleDashed, CircleX, LoaderCircle } from "lucide-react";
import type { Phase, Task, TestCase, TestStatus } from "@/types";

export type PhaseAgg = "empty" | "queued" | "running" | "passed" | "failed" | "blocked";

export function phaseTests(task: Task, phase: Phase): TestCase[] {
  return task.tests.filter((t) => t.phase === phase);
}

export function phaseStatus(task: Task, phase: Phase): PhaseAgg {
  const ts = phaseTests(task, phase);
  if (ts.length === 0) return "empty";
  if (ts.some((t) => t.status === "failed")) return "failed";
  if (task.run.running && ts.some((t) => t.id === task.run.currentTestId)) return "running";
  if (ts.some((t) => t.status === "blocked")) return "blocked";
  if (ts.every((t) => t.status === "passed")) return "passed";
  return "queued";
}

export const PHASE_AGG_LABEL: Record<PhaseAgg, string> = {
  empty: "No tests",
  queued: "Queued",
  running: "Running",
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
};

export const PHASE_AGG_COLOR: Record<PhaseAgg, string> = {
  empty: "var(--muted-foreground)",
  queued: "var(--muted-foreground)",
  running: "var(--emphasis)",
  passed: "var(--success)",
  failed: "var(--destructive)",
  blocked: "var(--warning)",
};

export function PhaseAggIcon({ agg, size = 15 }: { agg: PhaseAgg; size?: number }) {
  const style = { color: PHASE_AGG_COLOR[agg] };
  switch (agg) {
    case "passed":
      return <CircleCheckBig size={size} style={style} />;
    case "failed":
      return <CircleX size={size} style={style} />;
    case "running":
      return <LoaderCircle size={size} className="cp-spin" style={style} />;
    case "blocked":
      return <Ban size={size} style={style} />;
    default:
      return <CircleDashed size={size} style={style} />;
  }
}

export function TestStatusIcon({ status, running, size = 14 }: { status: TestStatus; running?: boolean; size?: number }) {
  if (running) return <LoaderCircle size={size} className="cp-spin" style={{ color: "var(--emphasis)" }} />;
  switch (status) {
    case "passed":
      return <CircleCheckBig size={size} style={{ color: "var(--success)" }} />;
    case "failed":
      return <CircleX size={size} style={{ color: "var(--destructive)" }} />;
    case "blocked":
      return <Ban size={size} style={{ color: "var(--warning)" }} />;
    default:
      return <CircleDashed size={size} style={{ color: "var(--muted-foreground)" }} />;
  }
}

export function passRate(history: ("pass" | "fail")[]): number {
  if (history.length === 0) return 100;
  return Math.round((history.filter((h) => h === "pass").length / history.length) * 100);
}
