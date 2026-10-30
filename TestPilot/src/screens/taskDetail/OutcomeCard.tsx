import { useEffect } from "react";
import { CheckCircle2, ExternalLink, Flag, GitPullRequest, MessageSquare, RefreshCw, ShieldCheck } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card } from "@/components/ui/primitives";
import type { Task } from "@/types";
import { DemoBadge } from "@/components/ui/DemoBadge";

export function OutcomeCard({ task }: { task: Task }) {
  switch (task.status) {
    case "failed":
      return <FailedCard task={task} />;
    case "reported":
      return <ReportedCard task={task} />;
    case "verifying":
      return <VerifyingCard task={task} />;
    case "passed":
    case "verified":
      return <ClearedCard task={task} />;
    case "accepted":
      return <AcceptedCard />;
    default:
      return null;
  }
}

function FailedCard({ task }: { task: Task }) {
  const draft = useStore((s) => s.issueDrafts[task.id]);
  const setDraft = useStore((s) => s.setIssueDraft);
  const fileIssue = useStore((s) => s.fileIssue);
  const acceptKnownIssue = useStore((s) => s.acceptKnownIssue);
  const runTestPlan = useStore((s) => s.runTestPlan);
  const repos = useStore((s) => s.repos);
  const product = useStore((s) => s.products.find((p) => p.id === task.productId));
  const failedTest = task.tests.find((t) => t.status === "failed");

  useEffect(() => {
    if (!draft) {
      setDraft(task.id, {
        title: failedTest ? `${failedTest.name} fails` : `${task.title} — QA failure`,
        body: failedTest
          ? `\`${failedTest.name}\` fails.\n\nSee spec \`${failedTest.file}\`.\n\n${failedTest.error?.message ?? ""}`
          : "",
        repoId: product?.repoId ?? repos[0]?.id ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  if (!draft) return null;

  return (
    <Card className="p-4" style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--destructive) 28%, transparent)" }}>
      <div className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-destructive">
        <Flag size={15} /> Test run failed — file an issue
      </div>
      <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Title</label>
      <input
        value={draft.title}
        onChange={(e) => setDraft(task.id, { title: e.target.value })}
        className="mb-2.5 w-full rounded-control border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary"
      />
      <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Body</label>
      <textarea
        value={draft.body}
        onChange={(e) => setDraft(task.id, { body: e.target.value })}
        rows={4}
        className="mb-2.5 w-full resize-none rounded-control border border-border bg-card px-3 py-2 font-mono text-[12px] outline-none focus:border-primary"
      />
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-chip bg-destructive-surface px-2 py-0.5 text-[11px] font-semibold text-destructive">bug</span>
        <span className="rounded-chip bg-destructive-surface px-2 py-0.5 text-[11px] font-semibold text-destructive">qa-fail</span>
        <span className="ml-auto text-[11.5px] text-muted-foreground">Repo</span>
        <select
          value={draft.repoId}
          onChange={(e) => setDraft(task.id, { repoId: e.target.value })}
          className="rounded-control border border-border bg-card px-2 py-1 text-[12px]"
        >
          {repos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.owner}/{r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" onClick={() => fileIssue(task.id, draft)}>
          <GitPullRequest size={14} /> File issue &amp; assign
        </Button>
        <Button variant="outline" onClick={() => runTestPlan(task.id)}>
          <RefreshCw size={14} /> Re-run <DemoBadge />
        </Button>
        <Button variant="ghost" onClick={() => acceptKnownIssue(task.id)}>
          Accept as known issue
        </Button>
      </div>
    </Card>
  );
}

function ReportedCard({ task }: { task: Task }) {
  const simulateDevFix = useStore((s) => s.simulateDevFix);
  const repos = useStore((s) => s.repos);
  const repo = repos.find((r) => r.id === task.issue?.repoId);
  // Link the REAL source, never a fabricated repo url: the actual GitHub issue
  // for GitHub tasks (falling back to a constructed url only if the repo is
  // known), else the task's Asana/Slack source. Empty → no link (no 404).
  const filedHref =
    task.origin === "github"
      ? task.github?.url ||
        (repo?.owner && repo?.name ? `https://github.com/${repo.owner}/${repo.name}/issues/${task.issue?.number}` : "")
      : task.asana?.url || task.slack?.permalink || task.links.pullRequest || "";
  const filedLabel = task.origin === "asana" ? "View in Asana" : task.origin === "slack" ? "View in Slack" : "View on GitHub";
  return (
    <Card className="p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-1">
          <GitPullRequest size={15} /> Issue #{task.issue?.number} filed
        </div>
        {filedHref && (
          <a
            href={filedHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            {filedLabel} <ExternalLink size={12} />
          </a>
        )}
      </div>
      <div className="rounded-control bg-surface-2 p-3 text-[12.5px] text-muted-foreground">
        Assigned to the dev. Waiting for a comment on the issue — we re-verify the moment they respond.
      </div>
      <Button variant="outline" className="mt-3" onClick={() => simulateDevFix(task.id)}>
        <MessageSquare size={14} /> Simulate dev comment on #{task.issue?.number} <DemoBadge />
      </Button>
    </Card>
  );
}

function VerifyingCard({ task }: { task: Task }) {
  const runTestPlan = useStore((s) => s.runTestPlan);
  return (
    <Card className="p-4">
      <div className="mb-2.5 flex items-center gap-2 text-[13.5px] font-semibold text-ink-1">
        <MessageSquare size={15} /> Dev commented on #{task.issue?.number}
      </div>
      <div className="rounded-control bg-info-surface p-3 text-[12.5px] text-ink-1">
        “Fixed, ready for re-test.”
      </div>
      <Button variant="primary" className="mt-3" onClick={() => runTestPlan(task.id, "verify")}>
        <RefreshCw size={14} /> Re-verify issue #{task.issue?.number} <DemoBadge />
      </Button>
    </Card>
  );
}

function ClearedCard({ task }: { task: Task }) {
  return (
    <Card
      className="flex items-center gap-3 p-4"
      style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--success) 30%, transparent)", background: "var(--success-surface)" }}
    >
      <CheckCircle2 size={20} style={{ color: "var(--success)" }} />
      <div>
        <div className="text-[13.5px] font-semibold text-ink-1">
          {task.status === "verified" ? "Fix verified & issue closed" : "Cleared QA"}
        </div>
        <div className="text-[12px] text-ink-2">Dev notified via Slack.</div>
      </div>
    </Card>
  );
}

function AcceptedCard() {
  return (
    <Card className="flex items-center gap-3 p-4" style={{ background: "var(--caution-surface)" }}>
      <ShieldCheck size={20} style={{ color: "var(--caution)" }} />
      <div className="text-[13.5px] font-semibold" style={{ color: "var(--caution)" }}>
        Accepted as a known issue.
      </div>
    </Card>
  );
}
