import { ExternalLink } from "lucide-react";
import { AsanaLogo } from "@/components/icons/AsanaLogo";
import { Avatar, Card } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";
import type { Task } from "@/types";
import { DemoBadge } from "@/components/ui/DemoBadge";

const ASANA_CORAL = "#F06A6A";

// The simulated comment QA posts back to the source Asana task once the pipeline
// verifies & validates. Styled as an Asana comment thread.
export function AsanaCommentCard({ task }: { task: Task }) {
  const comment = task.qaPipeline?.asanaComment;
  if (!comment || !task.asana) return null;

  return (
    <Card className="overflow-hidden" style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ASANA_CORAL} 28%, transparent)` }}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-1">
          <AsanaLogo size={15} /> Commented on Asana task
          <DemoBadge title="Simulated — this comment was NOT posted to Asana (the real write is the confirm-gated comment/Close task route)" />
        </div>
        <a
          href={task.asana.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
        >
          Open in Asana <ExternalLink size={12} />
        </a>
      </div>
      <div className="px-4 py-3.5">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            {task.asana.project} · task {task.asana.gid}
          </span>
          {task.asana.completed && (
            <span className="inline-flex items-center gap-1 rounded-chip bg-success-surface px-1.5 py-0.5 text-[10px] font-semibold text-success">
              ✓ Completed in Asana
            </span>
          )}
        </div>
        <div className="flex gap-2.5">
          <Avatar name="Kulvinder Singh" size={28} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-ink-1">Kulvinder Singh</span>
              <span className="rounded-chip bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">QA</span>
              <span className="text-[11px] text-muted-foreground">commented {timeAgo(comment.postedAt)}</span>
            </div>
            <p className="m-0 mt-1.5 rounded-control bg-surface-1 p-3 text-[13px] leading-[1.5] text-ink-2">
              {comment.body}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
