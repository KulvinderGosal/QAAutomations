import type { CSSProperties } from "react";
import type { IssueState, Ownership, Priority, QaStageStatus, TaskStatus } from "@/types";

export type Tone = {
  label: string;
  color: string; // css var reference, e.g. var(--warning)
  surface: string;
};

export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  assigned: { label: "Assigned", color: "var(--info)", surface: "var(--info-surface)" },
  "tests-missing": { label: "Tests missing", color: "var(--warning)", surface: "var(--warning-surface)" },
  ready: { label: "Ready", color: "var(--info)", surface: "var(--info-surface)" },
  running: { label: "Running", color: "var(--emphasis)", surface: "var(--emphasis-surface)" },
  passed: { label: "Cleared QA", color: "var(--success)", surface: "var(--success-surface)" },
  verified: { label: "Verified", color: "var(--success)", surface: "var(--success-surface)" },
  failed: { label: "Failed", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  reported: { label: "Reported", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  verifying: { label: "Verifying", color: "var(--caution)", surface: "var(--caution-surface)" },
  accepted: { label: "Accepted", color: "var(--caution)", surface: "var(--caution-surface)" },
  closed: { label: "Verified & closed", color: "var(--success)", surface: "var(--success-surface)" },
};

export const PRIORITY_TONE: Record<Priority, Tone> = {
  High: { label: "High", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  Medium: { label: "Medium", color: "var(--caution)", surface: "var(--caution-surface)" },
  Low: { label: "Low", color: "var(--muted-foreground)", surface: "oklch(0.96 0 0)" },
};

export const ISSUE_STATE_TONE: Record<IssueState, Tone> = {
  open: { label: "Open", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  "dev-responded": { label: "Dev responded", color: "var(--info)", surface: "var(--info-surface)" },
  verifying: { label: "Verifying", color: "var(--caution)", surface: "var(--caution-surface)" },
  closed: { label: "Verified & closed", color: "var(--success)", surface: "var(--success-surface)" },
};

export const QA_STAGE_TONE: Record<QaStageStatus, Tone> = {
  idle: { label: "Idle", color: "var(--muted-foreground)", surface: "oklch(0.95 0 0)" },
  active: { label: "Running", color: "var(--emphasis)", surface: "var(--emphasis-surface)" },
  done: { label: "Done", color: "var(--success)", surface: "var(--success-surface)" },
  failed: { label: "Failed", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  skipped: { label: "Skipped", color: "var(--muted-foreground)", surface: "oklch(0.95 0 0)" },
  paused: { label: "Paused", color: "var(--caution)", surface: "var(--caution-surface)" },
};

export const OWNERSHIP_TONE: Record<Ownership, Tone> = {
  unclaimed: { label: "Unclaimed", color: "var(--muted-foreground)", surface: "oklch(0.95 0 0)" },
  human: { label: "You", color: "var(--primary)", surface: "oklch(0.95 0.01 179)" },
  ai: { label: "AI automation", color: "var(--magic)", surface: "var(--magic-surface)" },
};

export const BRAND_TONE = {
  PushEngage: { color: "var(--brand-pushengage)", surface: "var(--brand-pushengage-surface)" },
  LedgerPort: { color: "var(--brand-ledgerport)", surface: "var(--brand-ledgerport-surface)" },
} as const;

export function toneStyle(t: Tone): CSSProperties {
  return { color: t.color, background: t.surface };
}
