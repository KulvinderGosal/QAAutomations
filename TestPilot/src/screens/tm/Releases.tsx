import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardList, Plus, Rocket, ShieldAlert, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { useTm } from "@/tm/store";
import { useStore } from "@/store/useStore";
import type { TmCase, TmDefect, TmGateCriterion, TmPlan, TmRelease, TmReleaseStatus, TmSignOffDecision } from "@/tm/types";
import { Button, Card, Chip, ProgressBar } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tone";

const INPUT =
  "w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";
const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground";

const RELEASE_STATUS_LABEL: Record<TmReleaseStatus, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  released: "Released",
};

const RELEASE_STATUS_TONE: Record<TmReleaseStatus, Tone> = {
  planned: { label: "Planned", color: "var(--muted-foreground)", surface: "oklch(0.96 0 0)" },
  "in-progress": { label: "In progress", color: "var(--info)", surface: "var(--info-surface)" },
  released: { label: "Released", color: "var(--success)", surface: "var(--success-surface)" },
};

const STATUS_ORDER: TmReleaseStatus[] = ["planned", "in-progress", "released"];

const GO_TONE: Tone = { label: "GO", color: "var(--success)", surface: "var(--success-surface)" };
const NOGO_TONE: Tone = { label: "NO-GO", color: "var(--destructive)", surface: "var(--destructive-surface)" };
const READY_TONE: Tone = { label: "GO ready", color: "var(--success)", surface: "var(--success-surface)" };
const NOTREADY_TONE: Tone = { label: "Not ready", color: "var(--caution)", surface: "var(--caution-surface)" };

function formatDate(iso?: string | null): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type Gate = {
  ready: boolean;
  reasons: string[];
  total: number;
  executed: number;
  failing: number;
  openBlockers: number;
  criteria: TmGateCriterion[];
  criteriaMet: number;
};

// Auto-computed release readiness: all mapped cases executed + none failing/blocked
// + no open high/critical defects on those cases + all exit-criteria ticked.
function computeGate(release: TmRelease, plans: TmPlan[], caseById: Map<string, TmCase>, defects: TmDefect[]): Gate {
  const caseIds = new Set(plans.filter((p) => p.releaseId === release.id).flatMap((p) => p.caseIds));
  const relCases = [...caseIds].map((id) => caseById.get(id)).filter((c): c is TmCase => !!c);
  const total = relCases.length;
  const executed = relCases.filter((c) => c.lastRunStatus !== "unexecuted").length;
  const failing = relCases.filter((c) => c.lastRunStatus === "failed" || c.lastRunStatus === "blocked").length;
  const openBlockers = defects.filter(
    (d) =>
      (d.status === "open" || d.status === "in-progress") &&
      (d.severity === "high" || d.severity === "critical") &&
      d.caseId != null &&
      caseIds.has(d.caseId),
  ).length;
  const criteria = release.gateCriteria ?? [];
  const criteriaMet = criteria.filter((c) => c.met).length;
  const reasons: string[] = [];
  if (total === 0) reasons.push("no cases mapped to this release");
  if (executed < total) reasons.push(`${total - executed} case(s) not executed`);
  if (failing > 0) reasons.push(`${failing} failing/blocked case(s)`);
  if (openBlockers > 0) reasons.push(`${openBlockers} open high/critical defect(s)`);
  if (criteria.length && criteriaMet < criteria.length) reasons.push(`${criteria.length - criteriaMet} exit criteria unmet`);
  return { ready: total > 0 && reasons.length === 0, reasons, total, executed, failing, openBlockers, criteria, criteriaMet };
}

export function Releases() {
  const releases = useTm((s) => s.releases);
  const plans = useTm((s) => s.plans);
  const cases = useTm((s) => s.cases);
  const defects = useTm((s) => s.defects);
  const addRelease = useTm((s) => s.addRelease);
  const updateRelease = useTm((s) => s.updateRelease);
  const deleteRelease = useTm((s) => s.deleteRelease);
  const pushToast = useStore((s) => s.pushToast);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const meName = users.find((u) => u.id === currentUserId)?.name ?? "QA";

  const [editing, setEditing] = useState<TmRelease | "new" | null>(null);

  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  const rollup = useMemo(() => {
    const map = new Map<string, { plans: number; total: number; executed: number; gate: Gate }>();
    for (const r of releases) {
      const relPlans = plans.filter((p) => p.releaseId === r.id);
      const gate = computeGate(r, plans, caseById, defects);
      map.set(r.id, { plans: relPlans.length, total: gate.total, executed: gate.executed, gate });
    }
    return map;
  }, [releases, plans, caseById, defects]);

  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Releases</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Milestones to ship against — map test plans to a release, track execution, and gate the GO/NO-GO decision.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus size={14} /> Add release
        </Button>
      </div>

      <Card className="min-w-0 overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-[1fr_120px_120px_120px_70px_160px] items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <span>Release</span>
          <span>Date</span>
          <span>Status</span>
          <span>Gate</span>
          <span className="text-right">Plans</span>
          <span>Execution</span>
        </div>
        {releases.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-muted-foreground">
            No releases yet. Add one to start mapping test plans against a milestone.
          </div>
        ) : (
          releases.map((r) => {
            const agg = rollup.get(r.id) ?? { plans: 0, total: 0, executed: 0, gate: null as unknown as Gate };
            const pct = agg.total > 0 ? Math.round((agg.executed / agg.total) * 100) : 0;
            const signed = r.signOff;
            const gate = agg.gate;
            return (
              <div
                key={r.id}
                onClick={() => setEditing(r)}
                className="grid min-w-[840px] cursor-pointer grid-cols-[1fr_120px_120px_120px_70px_160px] items-center gap-3 border-b border-border px-4 py-3 hover:bg-surface-1"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
                    <Rocket size={15} />
                  </span>
                  <span className="truncate text-[13.5px] font-semibold text-ink-1">{r.name}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <CalendarDays size={13} className="shrink-0 opacity-60" />
                  {formatDate(r.date)}
                </span>
                <span>
                  <Chip tone={RELEASE_STATUS_TONE[r.status]}>{RELEASE_STATUS_LABEL[r.status]}</Chip>
                </span>
                <span>
                  {signed ? (
                    <Chip tone={signed.decision === "go" ? GO_TONE : NOGO_TONE}>
                      {signed.decision === "go" ? "GO — signed" : "NO-GO — signed"}
                    </Chip>
                  ) : (
                    <Chip tone={gate?.ready ? READY_TONE : NOTREADY_TONE}>{gate?.ready ? "GO ready" : "Not ready"}</Chip>
                  )}
                </span>
                <span className="flex items-center justify-end gap-1 text-right text-[12.5px] tabular-nums text-muted-foreground">
                  <ClipboardList size={13} className="opacity-60" />
                  {agg.plans}
                </span>
                <span className="min-w-0">
                  <span className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {agg.executed}/{agg.total} cases
                    </span>
                    <span className="tabular-nums font-semibold text-ink-2">{pct}%</span>
                  </span>
                  <ProgressBar value={pct} />
                </span>
              </div>
            );
          })
        )}
      </Card>

      {editing && (
        <ReleaseEditor
          initial={editing === "new" ? null : editing}
          gate={editing === "new" ? null : (rollup.get(editing.id)?.gate ?? null)}
          meName={meName}
          onClose={() => setEditing(null)}
          addRelease={addRelease}
          updateRelease={updateRelease}
          deleteRelease={deleteRelease}
          onToast={(title, subtitle) => pushToast({ icon: "generate", title, subtitle })}
        />
      )}
    </div>
  );
}

function ReleaseEditor({
  initial,
  gate,
  meName,
  onClose,
  addRelease,
  updateRelease,
  deleteRelease,
  onToast,
}: {
  initial: TmRelease | null;
  gate: Gate | null;
  meName: string;
  onClose: () => void;
  addRelease: (name: string, date?: string | null) => TmRelease;
  updateRelease: (id: string, patch: Partial<TmRelease>) => void;
  deleteRelease: (id: string) => void;
  onToast: (title: string, subtitle: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [status, setStatus] = useState<TmReleaseStatus>(initial?.status ?? "planned");
  const [entryCriteria, setEntryCriteria] = useState(initial?.entryCriteria ?? "");
  const [criteria, setCriteria] = useState<TmGateCriterion[]>(initial?.gateCriteria ?? []);
  const [newCriterion, setNewCriterion] = useState("");
  const [signOff, setSignOff] = useState(initial?.signOff ?? null);

  const addCriterion = () => {
    const label = newCriterion.trim();
    if (!label) return;
    setCriteria((cs) => [...cs, { id: `gc-${Date.now()}-${cs.length}`, label, met: false }]);
    setNewCriterion("");
  };

  const patch = (): Partial<TmRelease> => ({
    name: name.trim(),
    date: date.trim() || null,
    status,
    entryCriteria: entryCriteria.trim() || undefined,
    gateCriteria: criteria,
    signOff,
  });

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (initial) {
      updateRelease(initial.id, patch());
      onToast("Release updated", trimmed);
    } else {
      const rel = addRelease(trimmed, date.trim() || null);
      updateRelease(rel.id, { status, entryCriteria: entryCriteria.trim() || undefined, gateCriteria: criteria, signOff });
      onToast("Release created", trimmed);
    }
    onClose();
  };

  const doSignOff = (decision: TmSignOffDecision) => {
    setSignOff({ by: meName, at: new Date().toISOString(), decision });
  };

  const criteriaMet = criteria.filter((c) => c.met).length;

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={initial ? `Edit ${initial.name}` : "Add release"} width={600}>
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="e.g. Q3 Shopify revamp" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Target date</label>
            <input type="date" value={date ?? ""} onChange={(e) => setDate(e.target.value)} className={cn(INPUT)} />
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TmReleaseStatus)} className={INPUT}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {RELEASE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL}>Entry criteria / scope</label>
          <textarea
            value={entryCriteria}
            onChange={(e) => setEntryCriteria(e.target.value)}
            className={cn(INPUT, "min-h-[64px] resize-y")}
            placeholder="What must be true to start release testing (features code-complete, env ready, test data seeded)…"
          />
        </div>

        <div>
          <label className={LABEL}>Exit criteria (GO/NO-GO checklist)</label>
          <div className="space-y-1.5">
            {criteria.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-control border border-border bg-surface-2 px-2.5 py-1.5">
                <input
                  type="checkbox"
                  checked={c.met}
                  onChange={(e) => setCriteria((cs) => cs.map((x) => (x.id === c.id ? { ...x, met: e.target.checked } : x)))}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span className={cn("flex-1 text-[13px]", c.met ? "text-ink-1" : "text-ink-2")}>{c.label}</span>
                <button
                  onClick={() => setCriteria((cs) => cs.filter((x) => x.id !== c.id))}
                  className="flex h-6 w-6 items-center justify-center rounded-control text-muted-foreground hover:bg-surface-3"
                  title="Remove"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCriterion())}
                className={INPUT}
                placeholder="e.g. All critical-path suites pass on staging"
              />
              <Button variant="outline" size="sm" onClick={addCriterion} disabled={!newCriterion.trim()}>
                <Plus size={13} /> Add
              </Button>
            </div>
          </div>
        </div>

        {gate && (
          <div className="rounded-control border border-border bg-surface-1 px-3.5 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
              <ShieldAlert size={13} /> Readiness
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] text-ink-2 sm:grid-cols-4">
              <span>Cases: <b className="tabular-nums">{gate.executed}/{gate.total}</b></span>
              <span>Failing: <b className="tabular-nums" style={{ color: gate.failing ? "var(--destructive)" : undefined }}>{gate.failing}</b></span>
              <span>Blockers: <b className="tabular-nums" style={{ color: gate.openBlockers ? "var(--destructive)" : undefined }}>{gate.openBlockers}</b></span>
              <span>Criteria: <b className="tabular-nums">{criteriaMet}/{criteria.length}</b></span>
            </div>
            <div className="mt-2 text-[12.5px]">
              {gate.reasons.length === 0 && criteriaMet === criteria.length ? (
                <span className="flex items-center gap-1.5 font-semibold text-[var(--success)]">
                  <CheckCircle2 size={14} /> Meets exit criteria — clear to GO
                </span>
              ) : (
                <span className="text-[var(--caution)]">Blockers: {gate.reasons.join("; ") || "exit criteria unmet"}</span>
              )}
            </div>
          </div>
        )}

        {initial && (
          <div className="rounded-control border border-border px-3.5 py-3">
            <label className={LABEL}>Sign-off</label>
            {signOff ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px]">
                  <Chip tone={signOff.decision === "go" ? GO_TONE : NOGO_TONE}>{signOff.decision === "go" ? "GO" : "NO-GO"}</Chip>{" "}
                  <span className="text-muted-foreground">
                    by {signOff.by} · {new Date(signOff.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                <Button variant="outline" size="sm" onClick={() => setSignOff(null)}>
                  Clear
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={() => doSignOff("go")}>
                  <ThumbsUp size={13} /> Sign off GO
                </Button>
                <Button variant="destructive" size="sm" onClick={() => doSignOff("no-go")}>
                  <ThumbsDown size={13} /> Sign off NO-GO
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        {initial ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              deleteRelease(initial.id);
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
          <Button variant="primary" size="sm" disabled={!name.trim()} onClick={save}>
            {initial ? "Save changes" : "Add release"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
