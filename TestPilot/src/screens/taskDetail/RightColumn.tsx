import {
  ExternalLink,
  FileText,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  MessageSquare,
  Palette,
  Rocket,
  UserCheck,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Avatar, Card, EyebrowLabel } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";
import type { ActivityEvent, Task } from "@/types";
import { GithubMark } from "@/components/icons/GithubMark";

const ACTIVITY_ICON: Record<ActivityEvent["icon"], typeof GitPullRequest> = {
  assign: GitPullRequest,
  run: GitCommitHorizontal,
  comment: MessageSquare,
  issue: FileText,
  check: GitPullRequest,
  merge: GitPullRequest,
  flag: FileText,
  claim: UserCheck,
};

export function RightColumn({ task }: { task: Task }) {
  const dev = useStore((s) => s.devs.find((d) => d.id === task.devId));

  // Primary "source" link is origin-aware and always a REAL url (the GitHub
  // issue/PR, the Asana task, or the Slack message) — never a fabricated repo.
  const source =
    task.origin === "github" && task.github?.url
      ? { label: "GitHub issue / PR", icon: GithubMark, href: task.github.url }
      : task.origin === "asana" && task.asana?.url
        ? { label: "Asana task", icon: ExternalLink, href: task.asana.url }
        : task.origin === "slack" && task.slack?.permalink
          ? { label: "Slack message", icon: MessageSquare, href: task.slack.permalink }
          : null;

  // Everything else only renders when it has a real, non-empty href; duplicates
  // of an already-listed url are dropped (e.g. a GitHub issue url == the source).
  const seen = new Set<string>();
  const links = [
    source,
    task.links.pitchDoc && { label: "Pitch doc", icon: FileText, href: task.links.pitchDoc },
    task.links.slackThread && { label: "Slack thread", icon: MessageSquare, href: task.links.slackThread },
    task.links.pullRequest && { label: "Pull request", icon: GitPullRequest, href: task.links.pullRequest },
    task.links.repository && { label: "Repository", icon: GithubMark, href: task.links.repository },
    task.links.branchUrl && { label: "Branch", icon: GitBranch, href: task.links.branchUrl },
    task.links.monorepoPath && task.links.repository && { label: "Monorepo path", icon: GitCommitHorizontal, href: task.links.repository },
    task.links.design && { label: "Design", icon: Palette, href: task.links.design },
    task.links.staging && { label: "Staging", icon: Rocket, href: task.links.staging },
  ]
    .filter((l): l is { label: string; icon: typeof GithubMark; href: string } => Boolean(l && l.href))
    .filter((l) => {
      if (seen.has(l.href)) return false;
      seen.add(l.href);
      return true;
    });

  return (
    <div className="flex flex-col gap-[18px]">
      <Card className="p-4">
        <EyebrowLabel className="mb-2.5">Assigned by</EyebrowLabel>
        <div className="flex items-center gap-3">
          <Avatar name={dev?.name ?? ""} size={36} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">{dev?.name ?? "Unassigned"}</div>
            {dev?.role && <div className="text-[12px] text-muted-foreground">{dev.role}</div>}
          </div>
        </div>
        {/* Only show the Slack affordance when we actually have a handle — the empty
            button (blank label, workspace-root link) was misleading. */}
        {dev?.slackHandle && (
          <a
            href={`https://pushengage.slack.com/`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-control border border-border py-2 text-[12.5px] font-semibold text-ink-2 hover:bg-surface-2"
          >
            <MessageSquare size={13} /> Message {dev.slackHandle}
          </a>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="m-0 text-[14px] font-semibold">Links</h2>
        </div>
        <div className="flex flex-col">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 text-[12.5px] text-ink-2 last:border-b-0 hover:bg-surface-1"
            >
              <l.icon size={14} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{l.label}</span>
              <ExternalLink size={12} className="shrink-0 text-muted-foreground" />
            </a>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="m-0 text-[14px] font-semibold">Activity</h2>
        </div>
        <div className="px-4 py-2">
          {task.activity
            .slice()
            .reverse()
            .map((a, i) => {
              const Icon = ACTIVITY_ICON[a.icon];
              return (
                <div key={a.id} className="flex gap-3 py-2.5">
                  <div className="flex flex-shrink-0 flex-col items-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-ink-2">
                      <Icon size={12} />
                    </span>
                    {i < task.activity.length - 1 && <span className="mt-1 min-h-[14px] w-[1.5px] flex-1 bg-surface-3" />}
                  </div>
                  <div className="flex-1 pb-1">
                    <div
                      className="text-[12.5px] leading-[1.45] text-ink-2"
                      dangerouslySetInnerHTML={{ __html: a.html }}
                    />
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(a.at)}</div>
                  </div>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}
