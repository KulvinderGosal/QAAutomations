import { useMemo, useState } from "react";
import { Circle, Crosshair, Play, Save, Video } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { DemoBadge } from "@/components/ui/DemoBadge";

function specSource(fileName: string, testNames: string[]) {
  return `import { test, expect } from "@playwright/test";

test.describe("${fileName}", () => {
${testNames
    .map(
      (n) => `  test("${n}", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "${n}" })).toBeVisible();
  });
`,
    )
    .join("\n")}});
`;
}

export function SpecEditorModal() {
  const taskId = useStore((s) => s.editorTaskId);
  const close = useStore((s) => s.closeEditor);
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));
  const runTestPlan = useStore((s) => s.runTestPlan);
  const pushToast = useStore((s) => s.pushToast);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const files = useMemo(() => Array.from(new Set(task?.tests.map((t) => t.file) ?? [])), [task]);
  const currentFile = activeFile ?? files[0];
  const testsInFile = task?.tests.filter((t) => t.file === currentFile) ?? [];
  const source = currentFile ? specSource(currentFile, testsInFile.map((t) => t.name)) : "";

  if (!task) return null;

  return (
    <Modal open={!!taskId} onOpenChange={(o) => !o && close()} title="Spec editor" width={720}>
      <div className="flex items-center gap-1 border-b border-border pb-2">
        {files.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFile(f)}
            className={cn(
              "cursor-pointer rounded-control px-2.5 py-1.5 font-mono text-[11.5px]",
              f === currentFile ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-2",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="inline-flex gap-0.5 rounded-control border border-border bg-surface-2 p-0.5">
          {(["preview", "edit"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-[7px] px-3 py-1 text-[12px] font-semibold capitalize",
                mode === m ? "bg-card shadow-[inset_0_0_0_1px_rgba(15,23,42,0.09)]" : "text-muted-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm">
            <Video size={13} /> Record
          </Button>
          <Button variant="outline" size="sm">
            <Crosshair size={13} /> Pick selector
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {mode === "preview" ? (
          <pre className="max-h-[320px] overflow-auto rounded-[10px] bg-[oklch(0.18_0_0)] p-3.5 font-mono text-[12px] leading-[1.6] text-[oklch(0.85_0_0)]">
            {source}
          </pre>
        ) : (
          <textarea
            defaultValue={source}
            rows={16}
            className="w-full resize-none rounded-[10px] border border-border bg-card p-3.5 font-mono text-[12px] leading-[1.6] outline-none focus:border-primary"
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {testsInFile.map((t) => (
          <button
            key={t.id}
            onClick={() => pushToast({ icon: "check", title: "Test run started", subtitle: t.name })}
            className="flex items-center gap-1.5 rounded-chip border border-border bg-card px-2.5 py-1 text-[11.5px] font-medium text-ink-2 hover:bg-surface-2"
          >
            <Circle size={9} fill="currentColor" /> {t.name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            pushToast({ icon: "check", title: "Spec saved", subtitle: currentFile ?? "" });
          }}
        >
          <Save size={14} /> Save
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            pushToast({ icon: "check", title: "Spec saved", subtitle: currentFile ?? "" });
            runTestPlan(task.id);
            close();
          }}
        >
          <Play size={14} /> Save &amp; run <DemoBadge />
        </Button>
      </div>
    </Modal>
  );
}
