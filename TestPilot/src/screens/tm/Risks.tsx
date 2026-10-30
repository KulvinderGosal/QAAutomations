import { useMemo, useState } from "react";
import { Bug, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useTm } from "@/tm/store";
import { useStore } from "@/store/useStore";
import {
  riskBand,
  riskScore,
  type TmCase,
  type TmRisk,
  type TmRiskStatus,
} from "@/tm/types";
import type { Tone } from "@/lib/tone";
import { Button, Card, Chip } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { timeAgo } from "@/lib/utils";

const INPUT =
  "w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";
const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground";

const STATUS_LABEL: Record<TmRiskStatus, string> = {
  open: "Open",
  mitigated: "Mitigated",
  accepted: "Accepted",
  closed: "Closed",
};

const STATUS_TONE: Record<TmRiskStatus, Tone> = {
  open: { label: "Open", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  mitigated: { label: "Mitigated", color: "var(--success)", surface: "var(--success-surface)" },
  accepted: { label: "Accepted", color: "var(--caution)", surface: "var(--caution-surface)" },
  closed: { label: "Closed", color: "var(--muted-foreground)", surface: "oklch(0.96 0 0)" },
};

const SCALE = [1, 2, 3, 4, 5] as const;

export function Risks() {
  const risks = useTm((s) => s.risks);
  const cases = useTm((s) => s.cases);
  const deleteRisk = useTm((s) => s.deleteRisk);

  const [editing, setEditing] = useState<TmRisk | "new" | null>(null);

  const caseKey = (id: string) => cases.find((c) => c.id === id)?.key ?? id;

  // Sorted by score, highest risk first.
  const sorted = useMemo(
    () => [...risks].sort((a, b) => riskScore(b) - riskScore(a)),
    [risks],
  );

  // Count of risks per (likelihood, impact) cell for the heatmap.
  const matrix = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of risks) {
      const k = `${r.likelihood}:${r.impact}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [risks]);

  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Risks</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Risk-based testing register — score each risk by likelihood × impact, link cases and defects, and steer coverage
            toward what matters most.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus size={14} /> Add risk
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Risk matrix heatmap */}
        <Card className="shrink-0 self-start p-4">
          <div className="mb-3 text-[13px] font-semibold text-ink-1">Risk matrix</div>
          <div className="flex items-start gap-2">
            {/* Impact axis label (vertical) */}
            <div className="flex flex-col items-center justify-center self-stretch pt-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground [writing-mode:vertical-rl] rotate-180">
                Impact
              </span>
            </div>
            <div>
              {/* Rows: impact 5 (top) → 1 (bottom) */}
              {[...SCALE].reverse().map((impact) => (
                <div key={impact} className="flex items-center gap-1">
                  <span className="w-3 text-right text-[10px] font-semibold text-muted-foreground">{impact}</span>
                  {SCALE.map((likelihood) => {
                    const score = likelihood * impact;
                    const band = riskBand(score);
                    const count = matrix.get(`${likelihood}:${impact}`) ?? 0;
                    return (
                      <div
                        key={likelihood}
                        title={`Likelihood ${likelihood} × Impact ${impact} = ${score} · ${band.label}${count ? ` · ${count} risk(s)` : ""}`}
                        className="flex h-9 w-9 items-center justify-center rounded-control border border-border text-[12px] font-bold tabular-nums"
                        style={{ background: band.tone.surface, color: count ? band.tone.color : "var(--muted-foreground)" }}
                      >
                        {count || ""}
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Likelihood axis (bottom) */}
              <div className="mt-1 flex items-center gap-1">
                <span className="w-3" />
                {SCALE.map((l) => (
                  <span key={l} className="w-9 text-center text-[10px] font-semibold text-muted-foreground">
                    {l}
                  </span>
                ))}
              </div>
              <div className="mt-0.5 pl-4 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                Likelihood
              </div>
            </div>
          </div>
        </Card>

        {/* Risk register table */}
        <Card className="min-w-0 flex-1 overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_70px_70px_96px_120px_120px_44px] items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            <span>Risk</span>
            <span>Title</span>
            <span className="text-center">Likeli.</span>
            <span className="text-center">Impact</span>
            <span className="text-center">Score</span>
            <span>Status</span>
            <span className="text-center">Links</span>
            <span />
          </div>
          {sorted.length === 0 ? (
            <div className="p-10 text-center text-[13.5px] text-muted-foreground">
              No risks logged yet. Add one to start the risk-based testing register.
            </div>
          ) : (
            sorted.map((r) => {
              const score = riskScore(r);
              const band = riskBand(score);
              return (
                <div
                  key={r.id}
                  onClick={() => setEditing(r)}
                  className="grid cursor-pointer grid-cols-[80px_1fr_70px_70px_96px_120px_120px_44px] items-center gap-2 border-b border-border px-4 py-3 hover:bg-surface-1"
                >
                  <span className="font-mono text-[12px] font-semibold text-ink-2">{r.key}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink-1">{r.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                  </span>
                  <span className="text-center text-[13px] tabular-nums text-ink-2">{r.likelihood}</span>
                  <span className="text-center text-[13px] tabular-nums text-ink-2">{r.impact}</span>
                  <span className="flex justify-center">
                    <Chip tone={band.tone}>
                      {score} · {band.label}
                    </Chip>
                  </span>
                  <span>
                    <Chip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Chip>
                  </span>
                  <span className="flex items-center justify-center gap-3 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1" title={`${r.caseIds.length} linked cases`}>
                      <FileText size={12} /> {r.caseIds.length}
                    </span>
                    <span className="inline-flex items-center gap-1" title={`${r.defectIds.length} linked defects`}>
                      <Bug size={12} /> {r.defectIds.length}
                    </span>
                  </span>
                  <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditing(r)}
                      title="Edit risk"
                      className="flex h-7 w-7 items-center justify-center rounded-control text-muted-foreground hover:bg-surface-2 hover:text-ink-1"
                    >
                      <Pencil size={13} />
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {editing && (
        <RiskEditor
          initial={editing === "new" ? null : editing}
          cases={cases}
          caseKey={caseKey}
          onDelete={deleteRisk}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RiskEditor({
  initial,
  cases,
  caseKey,
  onDelete,
  onClose,
}: {
  initial: TmRisk | null;
  cases: TmCase[];
  caseKey: (id: string) => string;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const addRisk = useTm((s) => s.addRisk);
  const updateRisk = useTm((s) => s.updateRisk);
  const pushToast = useStore((s) => s.pushToast);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [likelihood, setLikelihood] = useState(initial?.likelihood ?? 3);
  const [impact, setImpact] = useState(initial?.impact ?? 3);
  const [status, setStatus] = useState<TmRiskStatus>(initial?.status ?? "open");
  const [caseIds, setCaseIds] = useState<Set<string>>(new Set(initial?.caseIds ?? []));

  const score = likelihood * impact;
  const band = riskBand(score);

  const toggleCase = (id: string) =>
    setCaseIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = () => {
    if (!title.trim()) return;
    const linked = [...caseIds];
    if (initial) {
      updateRisk(initial.id, {
        title: title.trim(),
        description: description.trim(),
        likelihood,
        impact,
        status,
        caseIds: linked,
      });
    } else {
      const r = addRisk({
        title: title.trim(),
        description: description.trim(),
        likelihood,
        impact,
        status,
        caseIds: linked,
        defectIds: [],
      });
      pushToast({ icon: "generate", title: `Logged ${r.key}`, subtitle: r.title });
    }
    onClose();
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={initial ? `Edit ${initial.key}` : "Add risk"} width={620}>
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} placeholder="What could go wrong?" />
        </div>
        <div>
          <label className={LABEL}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} rows={2} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Likelihood</label>
            <select value={likelihood} onChange={(e) => setLikelihood(Number(e.target.value))} className={INPUT}>
              {SCALE.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Impact</label>
            <select value={impact} onChange={(e) => setImpact(Number(e.target.value))} className={INPUT}>
              {SCALE.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Score</label>
            <div className="flex h-[38px] items-center">
              <Chip tone={band.tone}>
                {score} · {band.label}
              </Chip>
            </div>
          </div>
        </div>
        <div>
          <label className={LABEL}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as TmRiskStatus)} className={INPUT}>
            {(["open", "mitigated", "accepted", "closed"] as const).map((st) => (
              <option key={st} value={st}>
                {STATUS_LABEL[st]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Linked cases ({caseIds.size})</label>
          {cases.length === 0 ? (
            <div className="rounded-control border border-border bg-surface-1 px-3 py-2 text-[12.5px] text-muted-foreground">
              No test cases to link yet.
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto rounded-control border border-border">
              {cases.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 text-[13px] last:border-0 hover:bg-surface-1"
                >
                  <input
                    type="checkbox"
                    checked={caseIds.has(c.id)}
                    onChange={() => toggleCase(c.id)}
                    className="h-[15px] w-[15px] cursor-pointer accent-[var(--primary)]"
                  />
                  <span className="font-mono text-[12px] font-semibold text-ink-2">{caseKey(c.id)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-1">{c.title}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        {initial ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onDelete(initial.id);
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
            {initial ? "Save changes" : "Add risk"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
