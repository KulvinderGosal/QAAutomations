import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  DownloadCloud,
  FlaskConical,
  FolderInput,
  FolderPlus,
  Images,
  Loader2,
  Pencil,
  Play,
  Plus,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { useTm } from "@/tm/store";
import { useStore } from "@/store/useStore";
import {
  TM_FRAMEWORKS,
  TM_PRIORITY_LABEL,
  TM_CASE_TYPE_LABEL,
  TM_CASE_TYPE_TONE,
  TM_PRIORITY_TONE,
  TM_REVIEW_LABEL,
  TM_RUN_STATUS_LABEL,
  TM_RUN_STATUS_TONE,
  type TmAutomation,
  type TmCase,
  type TmPriority,
  type TmCaseType,
  type TmStep,
  type TmSuite,
} from "@/tm/types";
import { Button, Card, Chip, StatusBadge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { timeAgo } from "@/lib/utils";
import { listDeviceReports, fetchDeviceReport, type DeviceRun } from "@/lib/deviceReports";
import { AsanaImportModal } from "./AsanaImportModal";

const INPUT =
  "w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";
const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground";

// V1 honest verdict: the note the runner verdict left on the case's latest run —
// "Blocked by <cls>: <human action>" (blocked) or "Passed with gaps: …" (passed).
function runVerdictNote(c: TmCase): string | null {
  const note = c.history[0]?.note;
  if (!note || c.history[0]?.status !== c.lastRunStatus) return null;
  if (c.lastRunStatus === "blocked" || (c.lastRunStatus === "passed" && note.startsWith("Passed with gaps"))) return note;
  return null;
}

export function TestCases() {
  const navigate = useNavigate();
  const suites = useTm((s) => s.suites);
  const cases = useTm((s) => s.cases);
  const hydrated = useTm((s) => s.hydrated);
  const runningCaseIds = useTm((s) => s.runningCaseIds);
  const runQueue = useTm((s) => s.runQueue);
  const selectedSuiteId = useTm((s) => s.selectedSuiteId);
  const setSelectedSuite = useTm((s) => s.setSelectedSuite);
  const addSuite = useTm((s) => s.addSuite);
  const renameSuite = useTm((s) => s.renameSuite);
  const deleteSuite = useTm((s) => s.deleteSuite);
  const moveCases = useTm((s) => s.moveCases);
  const runCase = useTm((s) => s.runCase);
  const runCases = useTm((s) => s.runCases);
  const runCaseOnDevice = useTm((s) => s.runCaseOnDevice);
  const runCasesOnDevice = useTm((s) => s.runCasesOnDevice);
  const setCaseStatus = useTm((s) => s.setCaseStatus);
  const runEnv = useTm((s) => s.runEnv);
  const setRunEnv = useTm((s) => s.setRunEnv);
  const stopBulkRun = useTm((s) => s.stopBulkRun);
  const createPlan = useTm((s) => s.createPlan);

  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TmCase | "new" | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [asanaOpen, setAsanaOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resultFor, setResultFor] = useState<string | null>(null);
  // Suite management: add-subsuite / rename modal, and the clone ("reusable
  // suite") modal.
  const [suiteModal, setSuiteModal] = useState<{ mode: "add" | "rename"; suite?: TmSuite; parentId: string | null } | null>(null);
  const [cloneSuiteTarget, setCloneSuiteTarget] = useState<TmSuite | null>(null);
  const [moveTo, setMoveTo] = useState("");
  // Suite-tree expand/collapse. `expanded` holds the suite ids whose sub-suites are
  // shown; default collapsed (only top-level suites visible) so the tree stays
  // scannable with 100+ suites and every suite name is legible.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Parent-suite ids that actually have sub-suites — used to show a toggle only where
  // there's something to expand, and to drive Expand/Collapse all.
  const parentsWithChildren = useMemo(() => {
    const set = new Set<string>();
    for (const s of suites) if (s.parentId) set.add(s.parentId);
    return set;
  }, [suites]);
  const allExpanded = parentsWithChildren.size > 0 && expanded.size >= parentsWithChildren.size;
  // Rollup case counts: each suite's badge should show the total across the suite AND
  // all its sub-suites. Imported cases live in per-folder sub-suites, so a top-level
  // product suite has 0 *direct* cases but hundreds in its subtree — show the total.
  const rollupCount = useMemo(() => {
    const direct = new Map<string, number>();
    for (const c of cases) direct.set(c.suiteId, (direct.get(c.suiteId) ?? 0) + 1);
    const childrenOf = new Map<string, string[]>();
    for (const s of suites) {
      if (!s.parentId) continue;
      const arr = childrenOf.get(s.parentId) ?? [];
      arr.push(s.id);
      childrenOf.set(s.parentId, arr);
    }
    const memo = new Map<string, number>();
    const compute = (id: string): number => {
      const cached = memo.get(id);
      if (cached !== undefined) return cached;
      let total = direct.get(id) ?? 0;
      for (const child of childrenOf.get(id) ?? []) total += compute(child);
      memo.set(id, total);
      return total;
    };
    for (const s of suites) compute(s.id);
    return memo;
  }, [suites, cases]);

  const suiteName = (id: string) => suites.find((s) => s.id === id)?.name ?? "—";

  // Cases in the selected suite (and its descendants), or all when none selected.
  const descendantIds = useMemo(() => {
    if (!selectedSuiteId) return null;
    const ids = new Set<string>([selectedSuiteId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of suites) {
        if (s.parentId && ids.has(s.parentId) && !ids.has(s.id)) {
          ids.add(s.id);
          grew = true;
        }
      }
    }
    return ids;
  }, [selectedSuiteId, suites]);

  const visible = useMemo(
    () => (descendantIds ? cases.filter((c) => descendantIds.has(c.suiteId)) : cases),
    [cases, descendantIds],
  );

  const openCase = cases.find((c) => c.id === openCaseId) ?? null;

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Select-all / deselect-all, scoped to the currently-visible cases (respects
  // the active suite filter). Indeterminate when only some visible are selected.
  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.id));
  const someVisibleSelected = visible.some((c) => selected.has(c.id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) visible.forEach((c) => n.delete(c.id));
      else visible.forEach((c) => n.add(c.id));
      return n;
    });

  // Of the selected cases, how many can actually run on the Playwright runner
  // (automated + a bound framework + a bound spec). "Run selected" acts on these;
  // manual / spec-less cases in the selection are skipped by the store.
  const runnableSelected = useMemo(
    () => [...selected].filter((id) => {
      const c = cases.find((x) => x.id === id);
      return !!c && c.automation === "automated" && !!c.frameworkId && !!c.specFile;
    }),
    [selected, cases],
  );

  // Of the selected cases, the ones runnable ON DEVICE: Android Maestro (tag
  // "maestro" + a flow in specFile) or iOS Simulator (tag "ios-sim"). "Run on
  // device" acts only on these, so it targets just the IAM device cases even if
  // the selection contains other (manual) cases.
  const deviceRunnableSelected = useMemo(
    () => [...selected].filter((id) => {
      const c = cases.find((x) => x.id === id);
      return !!c && ((c.tags.includes("maestro") && !!c.specFile) || c.tags.includes("ios-sim"));
    }),
    [selected, cases],
  );

  const createPlanFromSelection = () => {
    const ids = [...selected];
    if (!ids.length) return;
    const plan = createPlan(`Plan · ${ids.length} cases`, ids);
    setSelected(new Set());
    navigate(`/tests/plans?focus=${plan.id}`);
  };

  const deleteSuiteConfirmed = (s: TmSuite) => {
    if (window.confirm(`Delete suite "${s.name}"? This removes its sub-suites and their cases.`)) {
      deleteSuite(s.id);
      if (selectedSuiteId === s.id) setSelectedSuite(null);
    }
  };

  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Test Cases</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Organize cases into suites, generate them with QA Copilot, and run automated cases on the real frameworks.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus size={14} /> Add Test Case
        </Button>
        <Button variant="magic" size="sm" onClick={() => setCopilotOpen(true)}>
          <Sparkles size={14} /> Create with QA Copilot
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <DownloadCloud size={14} /> Import from frameworks
        </Button>
        <Button variant="outline" size="sm" title="Import an Asana task's subtasks as test cases (preview first)" onClick={() => setAsanaOpen(true)}>
          <DownloadCloud size={14} /> Import from Asana
        </Button>
        <Button variant="outline" size="sm" title="On-device run reports with screenshots" onClick={() => setReportsOpen(true)}>
          <Images size={14} /> Run reports
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={selected.size === 0}
          title={selected.size === 0 ? "Select cases first" : "Create a test plan from the selected cases"}
          onClick={createPlanFromSelection}
        >
          <FlaskConical size={14} /> Create Test Plan{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>

        {/* Target environment for runner-backed case runs (Run / Run selected). */}
        <div className="ml-auto flex items-center gap-2">
          {runEnv === "production" && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle size={13} /> Runs hit the LIVE production store
            </span>
          )}
          <div
            className="flex items-center gap-1 rounded-control border border-border bg-surface-2 p-1"
            title="Environment for Run / Run selected — passed to the framework's env (e.g. SHOPIFY_ENV picks the staging vs production store/app). Resets to Staging each reload."
          >
            <span className="px-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              Run env
            </span>
            {(["staging", "production"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setRunEnv(e)}
                aria-pressed={runEnv === e}
                className={`cursor-pointer rounded-control px-2.5 py-1 text-[12px] font-semibold capitalize transition-colors ${
                  runEnv === e
                    ? e === "production"
                      ? "bg-amber-500 text-white"
                      : "bg-primary text-white"
                    : "text-ink-2 hover:bg-surface-3"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Suite tree */}
        <Card className="w-[320px] shrink-0 self-start p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Suites</span>
            <div className="flex items-center gap-1">
              {parentsWithChildren.size > 0 && (
                <button
                  onClick={() => setExpanded(allExpanded ? new Set() : new Set(parentsWithChildren))}
                  title={allExpanded ? "Collapse all suites" : "Expand all suites"}
                  className="flex h-6 cursor-pointer items-center gap-0.5 rounded-control border border-border px-1.5 text-[10.5px] font-semibold text-muted-foreground hover:bg-surface-2"
                >
                  {allExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {allExpanded ? "Collapse" : "Expand"}
                </button>
              )}
              <button
                onClick={() => setSuiteModal({ mode: "add", parentId: null })}
                title="Add top-level suite"
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-control border border-border text-muted-foreground hover:bg-surface-2"
              >
                <FolderPlus size={13} />
              </button>
            </div>
          </div>
          <button
            onClick={() => setSelectedSuite(null)}
            className={`mb-0.5 flex w-full items-center gap-1.5 rounded-control px-2 py-1.5 text-left text-[13px] font-medium ${
              selectedSuiteId === null ? "bg-primary/10 text-primary" : "text-ink-2 hover:bg-surface-2"
            }`}
          >
            All cases
            <span className="ml-auto rounded-full bg-surface-3 px-1.5 text-[10.5px] font-bold text-ink-2">{cases.length}</span>
          </button>
          <SuiteTree
            suites={suites}
            parentId={null}
            depth={0}
            cases={cases}
            rollupCount={rollupCount}
            selectedSuiteId={selectedSuiteId}
            expanded={expanded}
            hasChildren={parentsWithChildren}
            onToggle={toggleExpand}
            onSelect={setSelectedSuite}
            onAddSub={(s) => setSuiteModal({ mode: "add", parentId: s.id })}
            onRename={(s) => setSuiteModal({ mode: "rename", suite: s, parentId: s.parentId })}
            onClone={(s) => setCloneSuiteTarget(s)}
            onDelete={deleteSuiteConfirmed}
          />
        </Card>

        {/* Case list */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {(selected.size > 0 || runQueue) && (
            <div className="flex flex-wrap items-center gap-2 rounded-card bg-primary/5 px-3.5 py-2.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_30%,transparent)]">
              {selected.size > 0 && (
                <span className="text-[13px] font-semibold text-primary">{selected.size} selected</span>
              )}
              <span className="flex-1" />
              {runQueue ? (
                // A bulk run is in flight — show progress + a stop control (kept
                // reachable even if the user clears the selection).
                <>
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-emphasis">
                    <Loader2 size={13} className="cp-spin" /> Running {runQueue.done}/{runQueue.total}
                  </span>
                  <Button size="sm" variant="destructive" onClick={() => stopBulkRun()}>
                    <Square size={11} /> Stop
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={runnableSelected.length === 0}
                    title={
                      runnableSelected.length === 0
                        ? deviceRunnableSelected.length > 0
                          ? 'These are on-device (Maestro) cases — use "Run on device". This button runs Playwright specs.'
                          : "None of the selected cases are runnable on the Playwright runner — select automated cases with a bound spec"
                        : `Run ${runnableSelected.length} automated case${runnableSelected.length === 1 ? "" : "s"} on the real Playwright runner, one at a time`
                    }
                    onClick={() => void runCases([...selected])}
                  >
                    <Play size={12} /> Run{runnableSelected.length > 0 ? ` ${runnableSelected.length}` : " selected"}
                  </Button>
                  {deviceRunnableSelected.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      title={`Run ${deviceRunnableSelected.length} Maestro-covered case${deviceRunnableSelected.length === 1 ? "" : "s"} on the local emulator/device, one at a time`}
                      onClick={() => void runCasesOnDevice([...selected])}
                    >
                      <Smartphone size={12} /> Run {deviceRunnableSelected.length} on device
                    </Button>
                  )}
                  <FolderInput size={14} className="text-muted-foreground" />
                  <select
                    value={moveTo}
                    onChange={(e) => {
                      const target = e.target.value;
                      if (target) {
                        moveCases([...selected], target);
                        setSelected(new Set());
                        setMoveTo("");
                      }
                    }}
                    className="rounded-control border border-border bg-card px-2 py-1.5 text-[12.5px] text-ink-1 outline-none"
                  >
                    <option value="">Move to suite…</option>
                    {suites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={createPlanFromSelection}>
                    <FlaskConical size={13} /> Create plan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </>
              )}
            </div>
          )}
          <Card className="min-w-0 flex-1 overflow-x-auto">
          <div className="grid grid-cols-[26px_84px_minmax(200px,1fr)_120px_90px_110px_44px] items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            <input
              type="checkbox"
              aria-label={allVisibleSelected ? "Deselect all" : "Select all"}
              title={allVisibleSelected ? "Deselect all tests" : "Select all tests"}
              ref={(el) => {
                if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
              }}
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              disabled={visible.length === 0}
              className="h-[15px] w-[15px] cursor-pointer accent-[var(--primary)]"
            />
            <span>Case</span>
            <span>Title</span>
            <span>Suite</span>
            <span>Priority</span>
            <span>Last Run</span>
            <span className="text-right">Runs</span>
          </div>
          {!hydrated ? (
            <div className="p-10 text-center text-[13.5px] text-muted-foreground">
              Loading test cases from the server…
            </div>
          ) : visible.length === 0 ? (
            <div className="p-10 text-center text-[13.5px] text-muted-foreground">
              No test cases here yet. Add one, or generate a batch with QA Copilot.
            </div>
          ) : (
            visible.map((c) => {
              const running = runningCaseIds.includes(c.id);
              return (
                <div key={c.id} className="border-b border-border last:border-b-0">
                <div
                  onClick={() => setOpenCaseId(c.id)}
                  className="grid cursor-pointer grid-cols-[26px_84px_minmax(200px,1fr)_120px_90px_110px_44px] items-center gap-2 px-4 py-3 hover:bg-surface-1"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSel(c.id)}
                    className="h-[15px] w-[15px] cursor-pointer accent-[var(--primary)]"
                  />
                  <span className="font-mono text-[12px] font-semibold text-ink-2">{c.key}</span>
                  <span className="min-w-0">
                    <span className="block break-words text-[13.5px] font-semibold text-ink-1">{c.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {c.automation === "automated" ? (
                        <span className="inline-flex items-center gap-1 rounded-[4px] bg-success-surface px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.04em] text-success">
                          <Play size={9} /> Automated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-[4px] bg-surface-3 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.04em] text-ink-2">
                          Manual
                        </span>
                      )}
                      {c.review === "pending" && (
                        <span className="rounded-[4px] bg-warning-surface px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.04em] text-warning">
                          Review
                        </span>
                      )}
                    </span>
                    {runVerdictNote(c) && (
                      <span
                        className={`mt-0.5 block truncate text-[11.5px] font-medium ${c.lastRunStatus === "blocked" ? "text-emphasis" : "text-caution"}`}
                        title={runVerdictNote(c) ?? undefined}
                      >
                        {runVerdictNote(c)}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-[12.5px] text-muted-foreground">{suiteName(c.suiteId)}</span>
                  <span>
                    <Chip tone={TM_PRIORITY_TONE[c.priority]}>{TM_PRIORITY_LABEL[c.priority]}</Chip>
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                    {running ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emphasis">
                        <Loader2 size={13} className="cp-spin" /> Running
                      </span>
                    ) : c.automation === "automated" ? (
                      <span className="inline-flex items-center gap-1.5">
                        {c.lastRunStatus !== "unexecuted" && (
                          <StatusBadge tone={TM_RUN_STATUS_TONE[c.lastRunStatus]}>{TM_RUN_STATUS_LABEL[c.lastRunStatus]}</StatusBadge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => void runCase(c.id)}>
                          <Play size={12} /> Run
                        </Button>
                      </span>
                    ) : (c.tags.includes("maestro") && c.specFile) || c.tags.includes("ios-sim") ? (
                      <span className="inline-flex items-center gap-1.5">
                        {c.lastRunStatus !== "unexecuted" && (
                          <StatusBadge tone={TM_RUN_STATUS_TONE[c.lastRunStatus]}>{TM_RUN_STATUS_LABEL[c.lastRunStatus]}</StatusBadge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          title={c.tags.includes("ios-sim") ? "Run this IAM case on the iOS Simulator" : "Run this Maestro flow on the local emulator/device"}
                          onClick={() => void runCaseOnDevice(c.id)}
                        >
                          <Smartphone size={12} /> Run
                        </Button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-end gap-1.5">
                        {c.lastRunStatus !== "unexecuted" && (
                          <StatusBadge tone={TM_RUN_STATUS_TONE[c.lastRunStatus]}>{TM_RUN_STATUS_LABEL[c.lastRunStatus]}</StatusBadge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          title="Manual case — test it by hand / in the dashboard, then record the result below"
                          onClick={() => setResultFor(resultFor === c.id ? null : c.id)}
                        >
                          <Play size={12} /> Run
                        </Button>
                      </span>
                    )}
                  </span>
                  <span className="text-right text-[12.5px] tabular-nums text-muted-foreground">{c.runs}</span>
                </div>
                {resultFor === c.id &&
                  !running &&
                  c.automation !== "automated" &&
                  !((c.tags.includes("maestro") && c.specFile) || c.tags.includes("ios-sim")) && (
                    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3" onClick={(e) => e.stopPropagation()}>
                      <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Record result:</span>
                      {(["passed", "failed", "blocked", "skipped"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => {
                            setCaseStatus(c.id, st);
                            setResultFor(null);
                          }}
                          className="rounded-[4px] border border-border px-2 py-0.5 text-[11.5px] font-semibold hover:bg-surface-2"
                          style={{ color: TM_RUN_STATUS_TONE[st].color }}
                        >
                          {TM_RUN_STATUS_LABEL[st]}
                        </button>
                      ))}
                      <button
                        onClick={() => setResultFor(null)}
                        className="rounded-[4px] border border-border px-2 py-0.5 text-[11.5px] text-muted-foreground hover:bg-surface-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          </Card>
        </div>
      </div>

      {openCase && (
        <CaseDetail
          key={openCase.id}
          c={openCase}
          suiteName={suiteName(openCase.suiteId)}
          running={runningCaseIds.includes(openCase.id)}
          onClose={() => setOpenCaseId(null)}
          onEdit={() => {
            setEditing(openCase);
            setOpenCaseId(null);
          }}
        />
      )}

      {editing && <CaseEditor initial={editing === "new" ? null : editing} suites={suites} onClose={() => setEditing(null)} />}

      {copilotOpen && <CopilotModal suites={suites} defaultSuiteId={selectedSuiteId} onClose={() => setCopilotOpen(false)} />}

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      {asanaOpen && <AsanaImportModal onClose={() => setAsanaOpen(false)} />}
      {reportsOpen && <DeviceRunReports onClose={() => setReportsOpen(false)} />}

      {suiteModal && (
        <SuiteModal
          mode={suiteModal.mode}
          suite={suiteModal.suite}
          onSave={(name) => {
            if (suiteModal.mode === "rename" && suiteModal.suite) renameSuite(suiteModal.suite.id, name);
            else addSuite(name, suiteModal.parentId);
            setSuiteModal(null);
          }}
          onClose={() => setSuiteModal(null)}
        />
      )}

      {cloneSuiteTarget && <CloneSuiteModal suite={cloneSuiteTarget} suites={suites} onClose={() => setCloneSuiteTarget(null)} />}
    </div>
  );
}

function SuiteModal({
  mode,
  suite,
  onSave,
  onClose,
}: {
  mode: "add" | "rename";
  suite?: TmSuite;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(mode === "rename" ? suite?.name ?? "" : "");
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={mode === "rename" ? "Rename suite" : "Add suite"} width={420}>
      <label className={LABEL}>Suite name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && onSave(name.trim())}
        className={INPUT}
        placeholder="e.g. Onboarding flow"
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
          {mode === "rename" ? "Rename" : "Add suite"}
        </Button>
      </div>
    </Modal>
  );
}

function CloneSuiteModal({ suite, suites, onClose }: { suite: TmSuite; suites: TmSuite[]; onClose: () => void }) {
  const cloneSuite = useTm((s) => s.cloneSuite);
  const setSelectedSuite = useTm((s) => s.setSelectedSuite);
  const pushToast = useStoreToast();
  const [targetParentId, setTargetParentId] = useState<string>("");
  const [withCases, setWithCases] = useState(true);

  // Can't clone into the suite's own subtree.
  const banned = useMemo(() => {
    const ids = new Set<string>([suite.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of suites) {
        if (s.parentId && ids.has(s.parentId) && !ids.has(s.id)) {
          ids.add(s.id);
          grew = true;
        }
      }
    }
    return ids;
  }, [suite.id, suites]);

  const go = () => {
    const created = cloneSuite(suite.id, { targetParentId: targetParentId || null, withCases });
    if (created) {
      setSelectedSuite(created.id);
      pushToast({ icon: "generate", title: "Suite cloned", subtitle: created.name });
    }
    onClose();
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Clone / reuse "${suite.name}"`} width={480}>
      <p className="text-[13px] leading-[1.55] text-ink-2">
        Duplicate this suite (and its sub-suites) under another location — the single-project equivalent of TestCollab's
        <b> Reusable Suites</b>. Optionally copy its test cases too (copies reset run history).
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className={LABEL}>Clone under</label>
          <select value={targetParentId} onChange={(e) => setTargetParentId(e.target.value)} className={INPUT}>
            <option value="">Top level</option>
            {suites
              .filter((s) => !banned.has(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-1">
          <input type="checkbox" checked={withCases} onChange={(e) => setWithCases(e.target.checked)} className="h-[15px] w-[15px] accent-[var(--primary)]" />
          Copy the {suite.name}'s test cases too
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={go}>
          <Copy size={13} /> Clone suite
        </Button>
      </div>
    </Modal>
  );
}

type SuiteActions = {
  onAddSub: (s: TmSuite) => void;
  onRename: (s: TmSuite) => void;
  onClone: (s: TmSuite) => void;
  onDelete: (s: TmSuite) => void;
};

function SuiteTree({
  suites,
  parentId,
  depth,
  cases,
  rollupCount,
  selectedSuiteId,
  expanded,
  hasChildren,
  onToggle,
  onSelect,
  onAddSub,
  onRename,
  onClone,
  onDelete,
}: {
  suites: TmSuite[];
  parentId: string | null;
  depth: number;
  cases: TmCase[];
  rollupCount: Map<string, number>;
  selectedSuiteId: string | null;
  expanded: Set<string>;
  hasChildren: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
} & SuiteActions) {
  const children = suites.filter((s) => s.parentId === parentId).sort((a, b) => a.order - b.order);
  const act = (e: MouseEvent, fn: () => void) => {
    e.stopPropagation();
    fn();
  };
  return (
    <>
      {children.map((s) => {
        const count = rollupCount.get(s.id) ?? 0;
        const active = selectedSuiteId === s.id;
        const canExpand = hasChildren.has(s.id);
        const isOpen = expanded.has(s.id);
        return (
          <div key={s.id}>
            <div
              onClick={() => onSelect(s.id)}
              style={{ paddingLeft: 8 + depth * 14 }}
              className={`group mb-0.5 flex cursor-pointer items-center gap-1.5 rounded-control py-1.5 pr-1.5 text-left text-[13px] font-medium ${
                active ? "bg-primary/10 text-primary" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              {canExpand ? (
                <button
                  onClick={(e) => act(e, () => onToggle(s.id))}
                  title={isOpen ? "Collapse sub-suites" : "Expand sub-suites"}
                  className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-surface-3"
                >
                  {isOpen ? (
                    <ChevronDown size={13} className="opacity-70" />
                  ) : (
                    <ChevronRight size={13} className="opacity-70" />
                  )}
                </button>
              ) : (
                <span className="h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate" title={s.name}>
                {s.name}
              </span>
              <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <SuiteAction title="Add sub-suite" onClick={(e) => act(e, () => onAddSub(s))}>
                  <FolderPlus size={12} />
                </SuiteAction>
                <SuiteAction title="Rename" onClick={(e) => act(e, () => onRename(s))}>
                  <Pencil size={12} />
                </SuiteAction>
                <SuiteAction title="Clone / reuse suite" onClick={(e) => act(e, () => onClone(s))}>
                  <Copy size={12} />
                </SuiteAction>
                <SuiteAction title="Delete" danger onClick={(e) => act(e, () => onDelete(s))}>
                  <Trash2 size={12} />
                </SuiteAction>
              </span>
              <span className="shrink-0 rounded-full bg-surface-3 px-1.5 text-[10.5px] font-bold text-ink-2 group-hover:hidden">
                {count}
              </span>
            </div>
            {isOpen && (
              <SuiteTree
                suites={suites}
                parentId={s.id}
                depth={depth + 1}
                cases={cases}
                rollupCount={rollupCount}
                selectedSuiteId={selectedSuiteId}
                expanded={expanded}
                hasChildren={hasChildren}
                onToggle={onToggle}
                onSelect={onSelect}
                onAddSub={onAddSub}
                onRename={onRename}
                onClone={onClone}
                onDelete={onDelete}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function SuiteAction({
  title,
  danger,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-5 w-5 items-center justify-center rounded-[5px] text-muted-foreground hover:bg-surface-3 ${
        danger ? "hover:text-destructive" : "hover:text-ink-1"
      }`}
    >
      {children}
    </button>
  );
}

function CaseDetail({
  c,
  suiteName,
  running,
  onClose,
  onEdit,
}: {
  c: TmCase;
  suiteName: string;
  running: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const runCase = useTm((s) => s.runCase);
  const setCaseReview = useTm((s) => s.setCaseReview);
  const addCaseComment = useTm((s) => s.addCaseComment);
  const setCaseStatus = useTm((s) => s.setCaseStatus);
  const [comment, setComment] = useState("");
  const [tab, setTab] = useState<"comments" | "history">("comments");

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`${c.key} · ${c.title}`} width={720}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={TM_PRIORITY_TONE[c.priority]}>{TM_PRIORITY_LABEL[c.priority]} priority</Chip>
        {c.caseType && <Chip tone={TM_CASE_TYPE_TONE[c.caseType]}>{TM_CASE_TYPE_LABEL[c.caseType]}</Chip>}
        <Chip
          tone={
            c.automation === "automated"
              ? { color: "var(--success)", surface: "var(--success-surface)" }
              : { color: "var(--ink-2)", surface: "oklch(0.95 0 0)" }
          }
        >
          {c.automation === "automated" ? "Automated" : "Manual"}
        </Chip>
        <StatusBadge tone={TM_RUN_STATUS_TONE[c.lastRunStatus]}>{TM_RUN_STATUS_LABEL[c.lastRunStatus]}</StatusBadge>
        <span className="text-[12px] text-muted-foreground">
          {suiteName} · {TM_REVIEW_LABEL[c.review]} · {c.runs} runs
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        {c.automation === "automated" && c.frameworkId && (
          <Button size="sm" variant="primary" disabled={running} onClick={() => void runCase(c.id)}>
            {running ? <Loader2 size={13} className="cp-spin" /> : <Play size={12} />} Run
          </Button>
        )}
      </div>
      {runVerdictNote(c) && (
        <div
          className={`mt-2 rounded-control px-3 py-2 text-[12.5px] font-medium ${
            c.lastRunStatus === "blocked" ? "bg-emphasis-surface text-emphasis" : "bg-caution-surface text-caution"
          }`}
        >
          {runVerdictNote(c)}
        </div>
      )}

      {c.description && <p className="mt-3 text-[13px] leading-[1.55] text-ink-2">{c.description}</p>}

      {c.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <span key={t} className="rounded-[5px] bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
              {t}
            </span>
          ))}
        </div>
      )}

      {c.automation === "automated" && c.frameworkId && (
        <div className="mt-3 rounded-control border border-border bg-surface-1 px-3 py-2 text-[12px] text-muted-foreground">
          Runs on <b className="text-ink-2">{TM_FRAMEWORKS.find((f) => f.id === c.frameworkId)?.label ?? c.frameworkId}</b>
          {c.specFile ? ` · ${c.specFile}` : " · smoke"}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-card border border-border">
        <div className="grid grid-cols-[40px_1fr_1fr] bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <span>#</span>
          <span>Step</span>
          <span>Expected Result</span>
        </div>
        {c.steps.map((s, i) => (
          <div key={i} className="grid grid-cols-[40px_1fr_1fr] gap-2 border-t border-border px-3 py-2 text-[13px]">
            <span className="text-muted-foreground">{i + 1}</span>
            <span className="text-ink-1">{s.step || "—"}</span>
            <span className="text-ink-2">{s.expected || "—"}</span>
          </div>
        ))}
      </div>

      {/* Manual quick-record */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Record result:</span>
        {(["passed", "failed", "blocked", "skipped"] as const).map((st) => (
          <Button key={st} size="sm" variant="outline" onClick={() => setCaseStatus(c.id, st)}>
            {TM_RUN_STATUS_LABEL[st]}
          </Button>
        ))}
        {c.review !== "approved" && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setCaseReview(c.id, "approved")}>
            Approve
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-4 border-b border-border">
        {(["comments", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-1 pb-2 text-[13px] font-semibold capitalize ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {t === "comments" ? `Comments (${c.comments.length})` : `Run History (${c.history.length})`}
          </button>
        ))}
      </div>

      {tab === "comments" ? (
        <div className="mt-3">
          {c.comments.map((m) => (
            <div key={m.id} className="mb-2 rounded-control bg-surface-1 px-3 py-2">
              <div className="text-[11px] font-semibold text-ink-2">
                {m.author} · {timeAgo(m.at)}
              </div>
              <div className="text-[13px] text-ink-1">{m.body}</div>
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              className={INPUT}
              onKeyDown={(e) => {
                if (e.key === "Enter" && comment.trim()) {
                  addCaseComment(c.id, comment.trim());
                  setComment("");
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!comment.trim()}
              onClick={() => {
                addCaseComment(c.id, comment.trim());
                setComment("");
              }}
            >
              Post
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {c.history.length === 0 ? (
            <div className="py-4 text-center text-[12.5px] text-muted-foreground">No runs recorded yet.</div>
          ) : (
            c.history.map((h) => (
              <div key={h.id} className="border-b border-border py-2 text-[12.5px]">
                <div className="flex items-center gap-2">
                  <StatusBadge tone={TM_RUN_STATUS_TONE[h.status]}>{TM_RUN_STATUS_LABEL[h.status]}</StatusBadge>
                  <span className="text-muted-foreground">
                    {h.by} · {timeAgo(h.at)}
                    {h.note ? ` · ${h.note}` : ""}
                  </span>
                </div>
                {h.screenshot && (
                  <a href={h.screenshot} target="_blank" rel="noreferrer" title="Open full screenshot">
                    <img
                      src={h.screenshot}
                      alt="run screenshot"
                      className="mt-2 max-h-72 rounded border border-border object-contain"
                    />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}

function CaseEditor({ initial, suites, onClose }: { initial: TmCase | null; suites: TmSuite[]; onClose: () => void }) {
  const addCase = useTm((s) => s.addCase);
  const updateCase = useTm((s) => s.updateCase);
  const deleteCase = useTm((s) => s.deleteCase);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [suiteId, setSuiteId] = useState(initial?.suiteId ?? suites[0]?.id ?? "");
  const [priority, setPriority] = useState<TmPriority>(initial?.priority ?? "normal");
  const [caseType, setCaseType] = useState<TmCaseType | "">(initial?.caseType ?? "");
  const [automation, setAutomation] = useState<TmAutomation>(initial?.automation ?? "manual");
  const [frameworkId, setFrameworkId] = useState<string>(initial?.frameworkId ?? "");
  const [specFile, setSpecFile] = useState(initial?.specFile ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [steps, setSteps] = useState<TmStep[]>(initial?.steps?.length ? initial.steps : [{ step: "", expected: "" }]);

  const save = () => {
    if (!title.trim() || !suiteId) return;
    const payload = {
      title: title.trim(),
      suiteId,
      priority,
      caseType: caseType || undefined,
      automation,
      frameworkId: automation === "automated" ? frameworkId || null : null,
      specFile: automation === "automated" && specFile.trim() ? specFile.trim() : null,
      description: description.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      steps: steps.filter((s) => s.step.trim() || s.expected.trim()),
    };
    if (initial) updateCase(initial.id, payload);
    else addCase(payload);
    onClose();
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={initial ? `Edit ${initial.key}` : "Add Test Case"} width={680}>
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} placeholder="What does this case verify?" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Suite</label>
            <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)} className={INPUT}>
              {suites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TmPriority)} className={INPUT}>
              {(["low", "normal", "high", "critical"] as const).map((p) => (
                <option key={p} value={p}>
                  {TM_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Scenario type</label>
            <select value={caseType} onChange={(e) => setCaseType(e.target.value as TmCaseType | "")} className={INPUT}>
              <option value="">Unspecified</option>
              {(["positive", "negative", "edge", "boundary"] as const).map((t) => (
                <option key={t} value={t}>
                  {TM_CASE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Automation</label>
            <select value={automation} onChange={(e) => setAutomation(e.target.value as TmAutomation)} className={INPUT}>
              <option value="manual">Manual</option>
              <option value="automated">Automated</option>
            </select>
          </div>
          {automation === "automated" && (
            <div>
              <label className={LABEL}>Framework</label>
              <select value={frameworkId} onChange={(e) => setFrameworkId(e.target.value)} className={INPUT}>
                <option value="">Select framework…</option>
                {TM_FRAMEWORKS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {automation === "automated" && (
          <div>
            <label className={LABEL}>Spec file (optional — blank runs smoke)</label>
            <input value={specFile} onChange={(e) => setSpecFile(e.target.value)} className={INPUT} placeholder="e.g. tests/smoke/site-health.spec.js" />
          </div>
        )}
        <div>
          <label className={LABEL}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} rows={2} />
        </div>
        <div>
          <label className={LABEL}>Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className={INPUT} placeholder="smoke, regression" />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={LABEL}>Steps &amp; Expected Results</label>
            <button
              onClick={() => setSteps((s) => [...s, { step: "", expected: "" }])}
              className="text-[12px] font-semibold text-primary hover:underline"
            >
              + Add step
            </button>
          </div>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 w-4 text-[12px] text-muted-foreground">{i + 1}</span>
                <textarea
                  value={s.step}
                  onChange={(e) => setSteps((arr) => arr.map((x, j) => (j === i ? { ...x, step: e.target.value } : x)))}
                  className={`${INPUT} flex-1 min-w-0 resize-y field-sizing-content min-h-[72px]`}
                  rows={3}
                  placeholder="Action"
                />
                <textarea
                  value={s.expected}
                  onChange={(e) => setSteps((arr) => arr.map((x, j) => (j === i ? { ...x, expected: e.target.value } : x)))}
                  className={`${INPUT} flex-1 min-w-0 resize-y field-sizing-content min-h-[72px]`}
                  rows={3}
                  placeholder="Expected result"
                />
                <button
                  onClick={() => setSteps((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr))}
                  className="mt-1.5 text-muted-foreground hover:text-destructive"
                  title="Remove step"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        {initial ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              deleteCase(initial.id);
              onClose();
            }}
          >
            <Trash2 size={13} /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={!title.trim()} onClick={save}>
            {initial ? "Save changes" : "Add case"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CopilotModal({
  suites,
  defaultSuiteId,
  onClose,
}: {
  suites: TmSuite[];
  defaultSuiteId: string | null;
  onClose: () => void;
}) {
  const generateCases = useTm((s) => s.generateCases);
  const aiBusy = useTm((s) => s.aiBusy);
  const pushToast = useStoreToast();
  const [suiteId, setSuiteId] = useState(defaultSuiteId ?? suites[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(8);

  const go = async () => {
    if (!prompt.trim() || !suiteId) return;
    const n = await generateCases({ suiteId, prompt: prompt.trim(), count });
    if (n > 0) {
      pushToast({ icon: "generate", title: `QA Copilot added ${n} cases`, subtitle: suites.find((s) => s.id === suiteId)?.name ?? "" });
      onClose();
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Create with QA Copilot" width={560}>
      <p className="text-[13px] leading-[1.55] text-ink-2">
        Describe what to test. QA Copilot (Claude) plans coverage and generates cases — happy-path plus negative, boundary,
        error, security, a11y and responsive edge cases — with steps and expected results, dropped into the suite as
        <b> review-pending</b>. Automated cases inherit the suite's product framework.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className={LABEL}>Target suite</label>
          <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)} className={INPUT}>
            {suites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>What should it cover?</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={INPUT}
            rows={4}
            placeholder="e.g. The subscriber segmentation flow: creating, editing and deleting segments, with validation and permission edges."
          />
        </div>
        <div>
          <label className={LABEL}>Max cases</label>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className={INPUT}
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="magic" size="sm" disabled={aiBusy || !prompt.trim()} onClick={go}>
          {aiBusy ? <Loader2 size={13} className="cp-spin" /> : <Sparkles size={13} />}
          {aiBusy ? "Generating…" : "Generate cases"}
        </Button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const importFrameworkSpecs = useTm((s) => s.importFrameworkSpecs);
  const pushToast = useStoreToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { added: number; updated: number; bound?: number }>>({});
  const running = busy !== null;

  const importOne = async (id: string) => {
    if (running) return;
    setBusy(id);
    const r = await importFrameworkSpecs(id);
    setResults((p) => ({ ...p, [id]: { added: r.added, updated: r.updated, bound: r.bound } }));
    setBusy(null);
  };

  const importAll = async () => {
    if (running) return;
    let added = 0;
    let updated = 0;
    for (const f of TM_FRAMEWORKS) {
      setBusy(f.id);
      const r = await importFrameworkSpecs(f.id);
      setResults((p) => ({ ...p, [f.id]: { added: r.added, updated: r.updated, bound: r.bound } }));
      added += r.added;
      updated += r.updated;
    }
    setBusy(null);
    pushToast({ icon: "generate", title: `Imported ${added} cases`, subtitle: `across ${TM_FRAMEWORKS.length} frameworks${updated ? ` · ${updated} updated` : ""}` });
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Import from frameworks" width={580}>
      <p className="text-[13px] leading-[1.55] text-ink-2">
        Pull the real Playwright specs from each framework into Test Cases. Every test becomes an
        <b> automated</b> case bound to its <span className="font-mono text-[12px]">spec:line</span>, grouped by test
        folder — clicking <b>Run</b> executes that exact test and records the result. Re-importing updates existing cases.
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          {TM_FRAMEWORKS.length} frameworks
        </span>
        <Button size="sm" variant="primary" disabled={running} onClick={importAll}>
          {running ? <Loader2 size={13} className="cp-spin" /> : <DownloadCloud size={13} />} Import all
        </Button>
      </div>
      <div className="mt-2 max-h-[360px] overflow-y-auto">
        {TM_FRAMEWORKS.map((f) => {
          const r = results[f.id];
          return (
            <div key={f.id} className="flex items-center gap-2 border-b border-border py-2.5 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink-1">{f.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {f.brand}
                  {r ? ` · +${r.added} added${r.updated ? `, ${r.updated} updated` : ""}${r.bound ? `, ${r.bound} bound by @case` : ""}` : ""}
                </span>
              </span>
              <Button size="sm" variant="outline" disabled={running} onClick={() => importOne(f.id)}>
                {busy === f.id ? <Loader2 size={12} className="cp-spin" /> : <DownloadCloud size={12} />} Import
              </Button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">
        Listing runs <span className="font-mono">playwright test --list</span> per framework (a few seconds each; cached).
      </div>
    </Modal>
  );
}

// Small hook to reach the main store's toast.
function useStoreToast() {
  return useStore((s) => s.pushToast);
}

// ── On-device run reports: every "Run on device" / "Run selected" produces one
// report (persisted server-side with screenshots). Passed cases show the shot.
function statusTint(s: string): string {
  return s === "passed" ? "var(--success)" : s === "failed" ? "var(--destructive)" : "var(--caution)";
}
function DeviceRunReports({ onClose }: { onClose: () => void }) {
  const [reports, setReports] = useState<DeviceRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState<DeviceRun | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listDeviceReports()
      .then((r) => setReports(r.reports))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const open = (id: string) => {
    setOpenId(id);
    setBusy(true);
    setFull(null);
    fetchDeviceReport(id)
      .then((r) => setFull(r.report))
      .catch(() => setFull(null))
      .finally(() => setBusy(false));
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="On-device run reports" width={760}>
      {loading ? (
        <div className="py-6 text-center text-[13px] text-muted-foreground">
          <Loader2 size={16} className="cp-spin mx-auto mb-2" /> Loading reports…
        </div>
      ) : openId && full ? (
        <div>
          <button className="mb-3 text-[12.5px] text-primary hover:underline" onClick={() => { setOpenId(null); setFull(null); }}>
            ← All reports
          </button>
          <div className="text-[14px] font-semibold">{full.label}</div>
          <div className="mb-3 text-[12px] text-muted-foreground">
            {timeAgo(full.at)} · {full.by} · {full.passed} passed / {full.failed} failed / {full.total} total
          </div>
          <div className="space-y-3">
            {full.results.map((r) => (
              <div key={r.caseId} className="rounded-[8px] border border-border p-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: statusTint(r.status) }} />
                  <span className="font-medium">{r.key}</span>
                  <span className="text-muted-foreground">{r.title}</span>
                  <span className="ml-auto text-[11px] font-semibold uppercase" style={{ color: statusTint(r.status) }}>{r.status}</span>
                </div>
                {r.screenshot ? (
                  <a href={r.screenshot} target="_blank" rel="noreferrer" title="Open full screenshot">
                    <img src={r.screenshot} alt={`${r.key} screenshot`} className="mt-2 max-h-80 rounded border border-border object-contain" />
                  </a>
                ) : (
                  <div className="mt-2 text-[11.5px] text-muted-foreground">No screenshot captured.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : busy ? (
        <div className="py-6 text-center text-[13px] text-muted-foreground"><Loader2 size={16} className="cp-spin mx-auto" /></div>
      ) : reports.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-muted-foreground">
          No on-device runs yet. Run an IAM case with the <b>Run</b> button (or "Run N on device"); each run is saved here with its screenshots.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => open(r.id)}
              className="flex w-full items-center gap-3 rounded-[8px] border border-border p-3 text-left hover:bg-surface-2"
            >
              <Images size={16} className="text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{r.label}</div>
                <div className="text-[11.5px] text-muted-foreground">{timeAgo(r.at)} · {r.by}</div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span style={{ color: "var(--success)" }}>{r.passed}✓</span>
                {r.failed > 0 && <span style={{ color: "var(--destructive)" }}>{r.failed}✗</span>}
                <span className="text-muted-foreground">/ {r.total}</span>
              </div>
              <ChevronRight size={15} className="text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
