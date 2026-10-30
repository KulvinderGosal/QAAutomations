import { AlertTriangle, Play } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Modal } from "@/components/ui/Modal";

const TITLES: Record<string, string> = {
  screenshot: "Screenshot",
  trace: "Trace",
  video: "Video",
  diff: "Visual diff",
};

export function ArtifactViewerModal() {
  const modal = useStore((s) => s.artifactModal);
  const close = useStore((s) => s.closeArtifact);
  const tasks = useStore((s) => s.tasks);

  const test = modal ? tasks.flatMap((t) => t.tests).find((t) => t.id === modal.testId) : null;

  return (
    <Modal open={!!modal} onOpenChange={(o) => !o && close()} title={test ? `${TITLES[modal!.kind]} — ${test.name}` : ""} width={680}>
      {modal?.kind === "screenshot" && (
        <div className="overflow-hidden rounded-[10px] border border-border">
          <div className="flex items-center gap-1.5 border-b border-border bg-surface-3 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.75_0.15_25)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.8_0.12_85)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.75_0.12_145)]" />
          </div>
          <div className="relative flex h-[300px] items-center justify-center bg-surface-1">
            <div className="absolute inset-x-8 top-10 h-16 rounded-[8px]" style={{ boxShadow: "0 0 0 2px var(--destructive)" }} />
            <AlertTriangle size={28} className="text-destructive" />
          </div>
        </div>
      )}

      {modal?.kind === "trace" && (
        <div className="flex flex-col gap-2">
          {["goto", "click", "fill", "expect.toBeVisible"].map((step, i) => (
            <div key={step} className="flex items-center gap-3 rounded-control border border-border px-3 py-2">
              <span className="font-mono text-[11px] text-muted-foreground">{(i * 340).toString().padStart(4, "0")}ms</span>
              <span className="flex-1 font-mono text-[12px]">{step}</span>
              {i === 3 && <span className="text-[11px] font-semibold text-destructive">failed</span>}
            </div>
          ))}
        </div>
      )}

      {modal?.kind === "video" && (
        <div className="flex h-[300px] flex-col items-center justify-center gap-3 rounded-[10px] bg-[oklch(0.15_0_0)]">
          <Play size={36} className="text-white/70" />
          <div className="h-1.5 w-2/3 rounded-full bg-card/20">
            <div className="h-full w-3/4 rounded-full bg-destructive" />
          </div>
        </div>
      )}

      {modal?.kind === "diff" && (
        <div className="grid grid-cols-3 gap-2">
          {["Baseline", "Current", "Diff"].map((label) => (
            <div key={label}>
              <div className="mb-1.5 text-center text-[11px] font-semibold text-muted-foreground">{label}</div>
              <div className="flex h-[180px] items-center justify-center rounded-control bg-surface-3 text-[11px] text-muted-foreground">
                {label === "Diff" ? <span className="rounded-chip bg-destructive-surface px-2 py-1 font-semibold text-destructive">4.2% changed</span> : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
