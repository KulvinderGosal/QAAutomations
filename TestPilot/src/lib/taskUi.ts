import type { Task } from "@/types";
import { TASK_STATUS_TONE, type Tone } from "@/lib/tone";

export const ATTENTION_STATUSES: Task["status"][] = [
  "failed",
  "reported",
  "verifying",
  "assigned",
  "tests-missing",
  "ready",
  "running",
];

const URGENCY_ORDER: Task["status"][] = [
  "failed",
  "reported",
  "verifying",
  "assigned",
  "tests-missing",
  "ready",
  "running",
  "passed",
  "verified",
  "accepted",
];

export function urgencyRank(t: Task): number {
  return URGENCY_ORDER.indexOf(t.status);
}

export function reasonFor(t: Task): { label: string; tone: Tone } {
  switch (t.status) {
    case "failed":
      return { label: "Failed — needs report", tone: TASK_STATUS_TONE.failed };
    case "reported":
      return { label: "Awaiting dev fix", tone: TASK_STATUS_TONE.reported };
    case "verifying":
      return { label: "Awaiting re-test", tone: TASK_STATUS_TONE.verifying };
    case "assigned":
      return { label: "New — awaiting QA", tone: TASK_STATUS_TONE.assigned };
    case "tests-missing":
      return { label: "Needs tests authored", tone: TASK_STATUS_TONE["tests-missing"] };
    case "ready":
      return { label: "Ready to run", tone: TASK_STATUS_TONE.ready };
    case "running":
      return { label: "Test run in progress", tone: TASK_STATUS_TONE.running };
    case "passed":
      return { label: "Cleared QA", tone: TASK_STATUS_TONE.passed };
    case "verified":
      return { label: "Verified — ready to close", tone: TASK_STATUS_TONE.verified };
    case "closed":
      return { label: "Verified & closed", tone: TASK_STATUS_TONE.closed };
    case "accepted":
      return { label: "Accepted as known issue", tone: TASK_STATUS_TONE.accepted };
  }
}

const DAY_MS = 86_400_000;

/** Whole days the task has spent in QA — freezes once clearedAt is set. */
export function daysInQA(t: Task): number {
  const end = t.clearedAt ? new Date(t.clearedAt).getTime() : Date.now();
  const start = new Date(t.createdAt).getTime();
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

export function daysInQALabel(t: Task): string {
  const d = daysInQA(t);
  if (d === 0) return "Day 1 in QA";
  return `Day ${d + 1}${t.clearedAt ? ` (cleared)` : ""} in QA`;
}

export type TaskAction = {
  label: string;
  kind: "run" | "verify" | "author" | "view" | "report" | "none";
};

export function actionFor(t: Task): TaskAction {
  switch (t.status) {
    case "tests-missing":
      return { label: "Author tests", kind: "author" };
    case "assigned":
    case "ready":
      // With no authored tests, runTestPlan is a no-op — send the user to author
      // them instead of offering a dead "Run tests" button.
      return t.tests.length === 0
        ? { label: "Author tests", kind: "author" }
        : { label: "Run tests", kind: "run" };
    case "running":
      return { label: "View run", kind: "view" };
    case "failed":
      return { label: "Report issue", kind: "report" };
    case "reported":
      return { label: "Awaiting dev fix", kind: "none" };
    case "verifying":
      return { label: "Re-run & verify", kind: "verify" };
    default:
      return { label: "View task", kind: "view" };
  }
}
