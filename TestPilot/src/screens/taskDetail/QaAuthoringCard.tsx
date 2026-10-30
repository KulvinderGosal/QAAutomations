import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card, Chip, EyebrowLabel } from "@/components/ui/primitives";
import { fetchAiStatus } from "@/lib/ai";
import { qaRecordDownloadUrl } from "@/lib/qaPlanner";
import { SCENARIO_TYPE_LABEL, TEST_AREA_LABEL } from "@/types";
import type { Priority, QaAuthoringStatus, Task, TestPlan, TestScenario } from "@/types";

const RUNNING: QaAuthoringStatus[] = ["planning", "scenarios", "cases", "exporting"];

const STAGE_LABEL: Record<QaAuthoringStatus, string> = {
  idle: "Idle",
  planning: "Authoring test plan…",
  scenarios: "Enumerating scenarios…",
  cases: "Writing Playwright cases…",
  exporting: "Exporting Excel record…",
  done: "Authored",
  error: "Failed",
};

const PRIORITY_TONE: Record<Priority, { color: string; surface: string }> = {
  High: { color: "var(--destructive)", surface: "var(--destructive-surface)" },
  Medium: { color: "var(--warning)", surface: "oklch(0.96 0.05 85)" },
  Low: { color: "var(--muted-foreground)", surface: "var(--surface-2)" },
};

const SOURCE_LABEL: Record<string, string> = {
  key: "using ANTHROPIC_API_KEY",
  token: "using ANTHROPIC_AUTH_TOKEN",
  env: "using .env credentials",
  profile: "using ant auth login",
};

export function QaAuthoringCard({ task }: { task: Task }) {
  const authorQaPlan = useStore((s) => s.authorQaPlan);
  const exportQaRecord = useStore((s) => s.exportQaRecord);

  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [aiSource, setAiSource] = useState<string | undefined>(undefined);
  useEffect(() => {
    let ok = true;
    fetchAiStatus()
      .then((s) => ok && (setAiReady(s.ready), setAiSource(s.source)))
      .catch(() => ok && setAiReady(false));
    return () => {
      ok = false;
    };
  }, []);

  const a = task.qaAuthoring;
  const running = !!a && RUNNING.includes(a.status);
  const done = a?.status === "done";
  const errored = a?.status === "error";
  const notReady = aiReady === false;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-3.5">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-magic" />
          <h2 className="m-0 text-[15px] font-semibold">AI QA authoring</h2>
          {running && (
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Loader2 size={12} className="cp-spin" /> {STAGE_LABEL[a.status]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {done && a.recordPath && (
            <a
              href={qaRecordDownloadUrl(a.recordPath)}
              className="flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:bg-surface-2"
            >
              <Download size={13} /> Excel
            </a>
          )}
          <Button
            variant="magic"
            size="sm"
            disabled={running || notReady}
            onClick={() => void authorQaPlan(task.id)}
          >
            {running ? <Loader2 size={13} className="cp-spin" /> : <WandSparkles size={13} />}
            {done || errored ? "Re-author" : "Author QA plan"}
          </Button>
        </div>
      </div>

      {/* Not-configured hint — mirrors the Manual Test AI prompt. */}
      {notReady && !a && (
        <div className="px-[18px] py-3 text-[12.5px] text-muted-foreground">
          Claude isn't configured. Add <span className="font-mono">ANTHROPIC_API_KEY</span> to{" "}
          <span className="font-mono">.env</span> or run <span className="font-mono">ant auth login</span>, then restart the
          dev server.
        </div>
      )}

      {aiReady && !a && (
        <div className="px-[18px] py-4 text-[13px] leading-[1.55] text-ink-2">
          TestPilot will read this task and author a <b>test plan</b> (which areas to test + environment), enumerate{" "}
          <b>corner-case scenarios</b>, generate real <b>Playwright specs</b> into the framework's{" "}
          <span className="font-mono">ai-generated/</span> folder, and export an <b>Excel record</b> you can keep.
          {aiSource && (
            <span className="ml-1 text-[11.5px] text-muted-foreground">({SOURCE_LABEL[aiSource] ?? "ready"})</span>
          )}
        </div>
      )}

      {a && (
        <div className="border-b border-border px-[18px] py-3">
          <StageStrip status={a.status} hasPlan={!!a.plan} hasScenarios={!!a.scenarios} hasCases={!!a.specs?.length} hasRecord={!!a.recordPath} />
        </div>
      )}

      {errored && (
        <div className="mx-[18px] my-3 flex items-start gap-2 rounded-control border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[12.5px] text-destructive">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{a?.error ?? "Authoring failed."}</span>
        </div>
      )}

      {a?.plan && <PlanPanel plan={a.plan} />}
      {a?.scenarios && a.scenarios.length > 0 && <ScenariosPanel scenarios={a.scenarios} />}
      {a?.specs && a.specs.length > 0 && (
        <div className="border-t border-border px-[18px] py-3.5">
          <EyebrowLabel className="mb-2">Generated Playwright cases</EyebrowLabel>
          {a.specs.map((sp) => (
            <div key={sp.filename} className="font-mono text-[11.5px] text-ink-2">
              {sp.savedPath ?? sp.filename}
            </div>
          ))}
        </div>
      )}

      {done && a.recordPath && (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-[18px] py-3">
          <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
            <FileSpreadsheet size={14} className="text-success" />
            <span className="font-mono text-[11.5px]">{a.recordPath}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void exportQaRecord(task.id)}>
            Re-export
          </Button>
        </div>
      )}
    </Card>
  );
}

function StageStrip({
  status,
  hasPlan,
  hasScenarios,
  hasCases,
  hasRecord,
}: {
  status: QaAuthoringStatus;
  hasPlan: boolean;
  hasScenarios: boolean;
  hasCases: boolean;
  hasRecord: boolean;
}) {
  const steps: { label: string; done: boolean; active: boolean }[] = [
    { label: "Plan", done: hasPlan, active: status === "planning" },
    { label: "Scenarios", done: hasScenarios, active: status === "scenarios" },
    { label: "Cases", done: hasCases, active: status === "cases" },
    { label: "Excel", done: hasRecord, active: status === "exporting" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${
              s.done
                ? "bg-success-surface text-success"
                : s.active
                  ? "bg-magic/15 text-magic"
                  : "bg-surface-2 text-muted-foreground"
            }`}
          >
            {s.done ? <Check size={11} /> : s.active ? <Loader2 size={11} className="cp-spin" /> : null}
            {s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight size={13} className="text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

function PlanPanel({ plan }: { plan: TestPlan }) {
  return (
    <div className="border-t border-border px-[18px] py-3.5">
      <EyebrowLabel className="mb-2">Test plan</EyebrowLabel>
      <p className="m-0 mb-3 text-[13px] leading-[1.55] text-ink-2">{plan.summary}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip tone={{ color: "var(--info)", surface: "var(--info-surface)" }}>Env: {plan.environment}</Chip>
        <Chip tone={{ color: "var(--primary)", surface: "var(--surface-2)" }}>{plan.frameworkId}</Chip>
        {plan.browsers.map((b) => (
          <Chip key={b} tone={{ color: "var(--muted-foreground)", surface: "var(--surface-2)" }}>
            {b}
          </Chip>
        ))}
        {plan.viewports.map((v) => (
          <Chip key={v} tone={{ color: "var(--muted-foreground)", surface: "var(--surface-2)" }}>
            {v}
          </Chip>
        ))}
      </div>
      <div className="grid gap-1.5">
        {plan.areas.map((area) => (
          <div
            key={area.area}
            className={`flex items-start gap-2.5 rounded-control border px-3 py-2 text-[12.5px] ${
              area.inScope ? "border-border bg-card" : "border-dashed border-border bg-surface-2/50 opacity-70"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                area.inScope ? "border-transparent bg-success text-white" : "border-[oklch(0.75_0_0)]"
              }`}
            >
              {area.inScope && <Check size={11} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink-1">{TEST_AREA_LABEL[area.area]}</span>
                <Chip tone={PRIORITY_TONE[area.priority]}>{area.priority}</Chip>
                {!area.inScope && <span className="text-[11px] text-muted-foreground">out of scope</span>}
              </div>
              <div className="mt-0.5 text-ink-2">{area.rationale}</div>
            </div>
          </div>
        ))}
      </div>
      {plan.risks.length > 0 && (
        <div className="mt-3 rounded-control bg-surface-2 px-3.5 py-3">
          <EyebrowLabel className="mb-1.5">Risks</EyebrowLabel>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-[12.5px] text-ink-2">
            {plan.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScenariosPanel({ scenarios }: { scenarios: TestScenario[] }) {
  return (
    <div className="border-t border-border px-[18px] py-3.5">
      <EyebrowLabel className="mb-2">Test scenarios ({scenarios.length})</EyebrowLabel>
      <div className="flex flex-col gap-1.5">
        {scenarios.map((sc) => (
          <ScenarioRow key={sc.id} sc={sc} />
        ))}
      </div>
    </div>
  );
}

function ScenarioRow({ sc }: { sc: TestScenario }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-control border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px]"
      >
        {open ? (
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
        )}
        <span className="font-mono text-[11px] text-muted-foreground">{sc.id}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-ink-1">{sc.title}</span>
        <Chip tone={{ color: "var(--muted-foreground)", surface: "var(--surface-2)" }}>{TEST_AREA_LABEL[sc.area]}</Chip>
        <Chip tone={{ color: "var(--emphasis)", surface: "oklch(0.95 0.03 255)" }}>{SCENARIO_TYPE_LABEL[sc.type]}</Chip>
        <Chip tone={PRIORITY_TONE[sc.priority]}>{sc.priority}</Chip>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2.5 text-[12.5px]">
          <ol className="m-0 mb-2 flex list-decimal flex-col gap-1 pl-4 text-ink-2">
            {sc.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <div className="rounded-control bg-surface-2 px-3 py-2">
            <EyebrowLabel className="mb-0.5">Expected</EyebrowLabel>
            <span className="text-ink-2">{sc.expected}</span>
          </div>
        </div>
      )}
    </div>
  );
}
