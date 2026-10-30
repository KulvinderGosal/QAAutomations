import { useEffect } from "react";
import { FlaskConical, Play, Loader2, AlertTriangle } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card, Chip } from "@/components/ui/primitives";
import { RunPanel } from "@/screens/runner/RunPanel";
import { defaultFrameworkFor } from "@/lib/qaPlanner";
import type { Task } from "@/types";

/**
 * Real per-task verification: resolves the task's product → Playwright framework
 * and runs the ACTUAL suite (Smoke or Full) via the shared runner
 * (`startPlaywrightRun` → server/runner.ts), streaming live output through the
 * shared RunPanel. This is the real thing — not the cosmetic per-task animation.
 * One run at a time globally (the server enforces it), so the buttons disable
 * while any run is in flight.
 */
export function TaskRunnerCard({ task }: { task: Task }) {
  const products = useStore((s) => s.products);
  const frameworks = useStore((s) => s.runnerFrameworks);
  const loadRunnerFrameworks = useStore((s) => s.loadRunnerFrameworks);
  const startPlaywrightRun = useStore((s) => s.startPlaywrightRun);
  const runnerRun = useStore((s) => s.runnerRun);

  useEffect(() => {
    if (!frameworks) void loadRunnerFrameworks();
  }, [frameworks, loadRunnerFrameworks]);

  const product = products.find((p) => p.id === task.productId);
  const fwId = defaultFrameworkFor(task.productId, product?.brand);
  const fw = frameworks?.find((f) => f.id === fwId);
  const running = runnerRun?.status === "running";
  const unhealthy = fw && !fw.healthy;

  const run = (mode: "smoke" | "full") => void startPlaywrightRun({ framework: fwId, mode });

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <FlaskConical size={16} className="text-primary" />
        <h2 className="m-0 text-[14px] font-semibold text-ink-1">Verify with Playwright</h2>
        <Chip tone={{ color: "var(--muted-foreground)", surface: "var(--surface-2)" }}>
          {fw?.label ?? fwId}
        </Chip>
        <span className="flex-1" />
        <Button size="sm" variant="outline" disabled={running || !!unhealthy} onClick={() => run("smoke")}>
          {running ? <Loader2 size={13} className="cp-spin" /> : <Play size={13} />} Run smoke
        </Button>
        <Button size="sm" variant="primary" disabled={running || !!unhealthy} onClick={() => run("full")}>
          {running ? <Loader2 size={13} className="cp-spin" /> : <FlaskConical size={13} />} Run full
        </Button>
      </div>

      <p className="mt-2 mb-0 text-[12px] text-muted-foreground">
        Runs the real <b>{fw?.label ?? fwId}</b> suite in its own folder and reports actual pass/fail — the
        same as <code>npm run test:smoke</code> from the terminal. Use the result to verify this task.
      </p>

      {unhealthy && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-warning">
          <AlertTriangle size={13} /> {fw?.problem ?? "Framework not runnable"} — fix in the folder, then retry.
        </div>
      )}

      {/* Live output for whatever run is active (shared, one run at a time). */}
      {runnerRun && (
        <div className="mt-3">
          <RunPanel />
        </div>
      )}
    </Card>
  );
}
