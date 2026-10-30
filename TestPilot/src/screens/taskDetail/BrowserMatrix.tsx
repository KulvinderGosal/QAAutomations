import { Circle, Compass, Flame, Globe, Loader2, Smartphone, Tablet } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { Task } from "@/types";
import { Card, EyebrowLabel } from "@/components/ui/primitives";

type MatrixState = "idle" | "running" | "pass" | "fail";

const PROJECT_ICON: Record<string, typeof Globe> = {
  Chromium: Globe,
  Firefox: Flame,
  WebKit: Compass,
  "Mobile Safari": Smartphone,
  "Pixel 5": Smartphone,
  iOS: Smartphone,
  Android: Tablet,
};

const STATE_COLOR: Record<MatrixState, string> = {
  idle: "var(--muted-foreground)",
  running: "var(--emphasis)",
  pass: "var(--success)",
  fail: "var(--destructive)",
};

export function BrowserMatrix({ task }: { task: Task }) {
  const product = useStore((s) => s.products.find((p) => p.id === task.productId));
  if (!product) return null;

  const states: MatrixState[] = product.projects.map((_, i) => {
    if (task.run.running) return "running";
    if (task.status === "passed" || task.status === "verified") return "pass";
    if (["failed", "reported", "verifying"].includes(task.status)) return i === 0 ? "fail" : "pass";
    return "idle";
  });

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-[18px] py-3.5">
        <h2 className="m-0 text-[15px] font-semibold">Browser &amp; device matrix</h2>
      </div>
      <div className="grid grid-cols-3 gap-2.5 p-4">
        {product.projects.map((proj, i) => {
          const Icon = PROJECT_ICON[proj] ?? Circle;
          const state = states[i];
          return (
            <div key={proj} className="flex flex-col items-center gap-1.5 rounded-control border border-border py-3">
              <Icon size={18} style={{ color: STATE_COLOR[state] }} />
              <span className="text-[11.5px] font-medium text-ink-2">{proj}</span>
              <EyebrowLabel style={{ color: STATE_COLOR[state] }}>
                {state === "running" ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 size={10} className="cp-spin" /> running
                  </span>
                ) : (
                  state
                )}
              </EyebrowLabel>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
