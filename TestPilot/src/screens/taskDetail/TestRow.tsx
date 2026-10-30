import { ChevronRight, Clapperboard, Columns2, Image as ImageIcon, Route } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import type { Task, TestCase } from "@/types";
import { TestStatusIcon, passRate } from "@/screens/taskDetail/helpers";

export function TestRow({ task, test }: { task: Task; test: TestCase }) {
  const expanded = useStore((s) => s.expandedTests[test.id]);
  const toggle = useStore((s) => s.toggleExpandTest);
  const openArtifact = useStore((s) => s.openArtifact);
  const running = task.run.running && task.run.currentTestId === test.id;
  const rate = passRate(test.history);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => toggle(test.id)}
        className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left hover:bg-surface-1"
      >
        <ChevronRight size={13} className={cn("shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        <TestStatusIcon status={test.status} running={running} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-1">{test.name}</span>
        {test.flaky && (
          <span className="shrink-0 rounded-chip bg-caution-surface px-1.5 py-0.5 text-[10px] font-bold text-caution">Flaky</span>
        )}
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{test.file}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3.5 pl-[29px]">
          <div className="flex items-center gap-3 py-1.5">
            <div className="flex items-end gap-[3px]">
              {test.history.map((h, i) => (
                <span
                  key={i}
                  className="h-4 w-1.5 rounded-[1px]"
                  style={{ background: h === "pass" ? "var(--success)" : "var(--destructive)" }}
                />
              ))}
            </div>
            <span className="text-[11.5px] font-medium text-muted-foreground">{rate}% pass rate · last {test.history.length} runs</span>
            {(test.retries ?? 0) > 0 && <span className="text-[11.5px] text-caution">retried {test.retries}×</span>}
          </div>

          {test.error && (
            <div className="mt-2 rounded-[10px] bg-[oklch(0.18_0_0)] p-3 font-mono text-[11.5px] leading-[1.6] text-[oklch(0.85_0_0)]">
              <div className="text-[oklch(0.65_0.18_45)]">Error: {test.error.matcher}</div>
              <div className="mt-1 text-[oklch(0.8_0_0)]">{test.error.message}</div>
              <div className="mt-1.5 text-muted-foreground">locator: {test.error.locator}</div>
              <div className="text-[var(--success)]">+ expected: {test.error.expected}</div>
              <div className="text-[var(--destructive)]">- received: {test.error.received}</div>
              <div className="mt-1.5 whitespace-pre-wrap text-muted-foreground">{test.error.stack}</div>
            </div>
          )}

          {test.status === "failed" && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <ArtifactButton icon={ImageIcon} label="Screenshot" onClick={() => openArtifact(test.id, "screenshot")} />
              <ArtifactButton icon={Route} label="Trace" onClick={() => openArtifact(test.id, "trace")} />
              <ArtifactButton icon={Clapperboard} label="Video" onClick={() => openArtifact(test.id, "video")} />
              <ArtifactButton icon={Columns2} label="Visual diff" onClick={() => openArtifact(test.id, "diff")} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArtifactButton({ icon: Icon, label, onClick }: { icon: typeof ImageIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-control border border-border bg-card px-2.5 py-1.5 text-[11.5px] font-medium text-ink-2 hover:bg-surface-2"
    >
      <Icon size={13} /> {label}
    </button>
  );
}
