import { useEffect } from "react";
import { CheckCircle2, FileWarning, GitMerge, RefreshCw, ShieldCheck, WandSparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { Toast } from "@/types";

const ICON: Record<Toast["icon"], typeof CheckCircle2> = {
  check: CheckCircle2,
  issue: FileWarning,
  verify: ShieldCheck,
  generate: WandSparkles,
  merge: GitMerge,
  sync: RefreshCw,
};

const TONE: Record<Toast["icon"], string> = {
  check: "var(--success)",
  issue: "var(--destructive)",
  verify: "var(--success)",
  generate: "var(--magic)",
  merge: "var(--primary)",
  sync: "var(--info)",
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useStore((s) => s.dismissToast);
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), 5200);
    return () => clearTimeout(t);
  }, [toast.id, dismiss]);

  const Icon = ICON[toast.icon];
  return (
    <div className="cp-toast-in flex w-[320px] items-start gap-3 rounded-card border border-border bg-card p-3.5 shadow-[0_10px_20px_-6px_rgba(15,23,42,0.15),0_4px_8px_-2px_rgba(15,23,42,0.08)]">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ color: TONE[toast.icon], background: `color-mix(in srgb, ${TONE[toast.icon]} 12%, transparent)` }}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink-1">{toast.title}</div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{toast.subtitle}</div>
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
