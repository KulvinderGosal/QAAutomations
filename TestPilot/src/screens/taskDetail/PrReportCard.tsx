import { CheckCircle2, ExternalLink, FlaskConical } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Card, Chip, EyebrowLabel, StatusBadge } from "@/components/ui/primitives";
import { GithubMark } from "@/components/icons/GithubMark";
import { timeAgo } from "@/lib/utils";
import type { Task } from "@/types";

const GATE_TONE = {
  passed: { label: "Passed", color: "var(--success)", surface: "var(--success-surface)" },
  failed: { label: "Failed", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  skipped: { label: "Skipped", color: "var(--muted-foreground)", surface: "oklch(0.95 0 0)" },
} as const;

export function PrReportCard({ task }: { task: Task }) {
  const report = task.qaPipeline?.prReport;
  const repos = useStore((s) => s.repos);
  if (!report) return null;

  const repo = repos.find((r) => r.id === report.repoId);
  const verified = report.verdict === "verified";
  const ringColor = verified ? "var(--success)" : "var(--destructive)";
  // Real source url — never a fabricated repo. GitHub tasks link the actual
  // issue/PR; other origins link their real PR (if the dev supplied one) or the
  // task source. Empty → no link rendered.
  const prHref =
    task.origin === "github"
      ? task.github?.url ||
        (repo?.owner && repo?.name ? `https://github.com/${repo.owner}/${repo.name}/pull/${report.prNumber}` : "")
      : task.links.pullRequest || task.asana?.url || task.slack?.permalink || "";
  const prLabel =
    task.origin === "github" || task.links.pullRequest ? "View on GitHub" : task.origin === "asana" ? "View in Asana" : "View source";

  return (
    <Card
      className="p-4"
      style={{
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ringColor} 30%, transparent)`,
        background: verified ? "var(--success-surface)" : "var(--destructive-surface)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: verified ? "oklch(0.3 0.06 165)" : "var(--destructive)" }}>
          {verified ? <CheckCircle2 size={16} /> : <GithubMark size={15} />}
          Posted QA status to PR #{report.prNumber}
        </div>
        {prHref && (
          <a
            href={prHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            {prLabel} <ExternalLink size={12} />
          </a>
        )}
      </div>

      <div className="rounded-control bg-card/70 p-3">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <Chip tone={GATE_TONE.passed}>{report.passed} passed</Chip>
          {report.failed > 0 && <Chip tone={GATE_TONE.failed}>{report.failed} failed</Chip>}
          {report.blocked > 0 && (
            <Chip tone={{ color: "var(--warning)", surface: "var(--warning-surface)" }}>{report.blocked} blocked</Chip>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">posted {timeAgo(report.postedAt)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
              <FlaskConical size={12} /> Smoke
            </span>
            <StatusBadge tone={GATE_TONE[report.smoke]}>{GATE_TONE[report.smoke].label}</StatusBadge>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
              <FlaskConical size={12} /> Regression
            </span>
            <StatusBadge tone={GATE_TONE[report.regression]}>{GATE_TONE[report.regression].label}</StatusBadge>
          </div>
        </div>

        {report.issueNumbers.length > 0 && (
          <div className="mt-2.5 border-t border-border pt-2.5">
            <EyebrowLabel className="mb-1.5">Filed issues</EyebrowLabel>
            <div className="flex flex-wrap gap-1.5">
              {report.issueNumbers.map((n) => (
                <span key={n} className="rounded-chip bg-surface-2 px-2 py-0.5 font-mono text-[11.5px] text-ink-2">
                  #{n}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
