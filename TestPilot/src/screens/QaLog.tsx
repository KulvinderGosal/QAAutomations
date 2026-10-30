import { ClipboardCheck, ExternalLink } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Card } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";

// Durable record of every task QA verified & closed. Reads the persisted qaLog
// (localStorage) so it survives reloads — the audit trail the live queue can't
// keep (completed tasks drop off the connector feed).

const ORIGIN_LABEL: Record<string, string> = {
  asana: "Asana",
  github: "GitHub",
  slack: "Slack",
  manual: "Manual",
};

function AsanaBadge({ state }: { state: "completed" | "failed" | "none" }) {
  if (state === "completed")
    return (
      <span className="rounded-chip bg-success-surface px-2 py-0.5 text-[10.5px] font-bold text-success">
        Completed in Asana
      </span>
    );
  if (state === "failed")
    return (
      <span className="rounded-chip bg-destructive-surface px-2 py-0.5 text-[10.5px] font-bold text-destructive">
        Asana write failed
      </span>
    );
  return <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-[10.5px] font-bold text-ink-2">Local only</span>;
}

export function QaLog() {
  const qaLog = useStore((s) => s.qaLog);

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} className="text-primary" />
          <h1 className="m-0 text-[24px] font-bold tracking-tight">QA Log</h1>
        </div>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          A durable record of every task QA verified &amp; closed. Persisted locally — it survives reloads even after a
          task leaves the live queue.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <h2 className="m-0 text-[13.5px] font-semibold">Verified &amp; closed</h2>
          <span className="text-[11.5px] text-muted-foreground">{qaLog.length} recorded</span>
        </div>

        {qaLog.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px] text-muted-foreground">
            Nothing closed yet. When you close a verified task, it's recorded here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-border bg-surface-2">
                <tr>
                  {["Task", "PR", "Source", "Closed by", "When", "Write-back"].map((c) => (
                    <th
                      key={c}
                      className="px-4 py-2 text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qaLog.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-surface-1">
                    <td className="max-w-[420px] px-4 py-2.5 text-[13px] font-medium text-ink-1">
                      <span className="line-clamp-1">{e.title}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12.5px] text-ink-2">{e.pr ? `#${e.pr}` : "—"}</td>
                    <td className="px-4 py-2.5 text-[12.5px] text-ink-2">{ORIGIN_LABEL[e.origin] ?? e.origin}</td>
                    <td className="px-4 py-2.5 text-[12.5px] text-ink-2">{e.closedBy}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-muted-foreground">
                      {timeAgo(e.closedAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <AsanaBadge state={e.asana} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <ExternalLink size={12} /> For Asana-origin tasks, "Completed in Asana" means the task was really marked complete
        in Asana (the durable source of truth).
      </p>
    </div>
  );
}
