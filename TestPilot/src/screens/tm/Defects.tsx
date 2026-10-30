import { useMemo, useState } from "react";
import { Bug, ExternalLink, GitBranch, Plus, Trash2 } from "lucide-react";
import { useTm } from "@/tm/store";
import { useStore } from "@/store/useStore";
import {
  TM_DEFECT_SEVERITY_TONE,
  type TmCase,
  type TmDefect,
  type TmDefectSeverity,
  type TmDefectStatus,
  type TmSuite,
} from "@/tm/types";
import type { Tone } from "@/lib/tone";
import { Button, Card, Chip, StatusBadge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { timeAgo } from "@/lib/utils";

const INPUT =
  "w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";
const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground";

const SEVERITY_ORDER: TmDefectSeverity[] = ["low", "medium", "high", "critical"];
const STATUS_ORDER: TmDefectStatus[] = ["open", "in-progress", "resolved", "closed"];

const DEFECT_STATUS_LABEL: Record<TmDefectStatus, string> = {
  open: "Open",
  "in-progress": "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const DEFECT_STATUS_TONE: Record<TmDefectStatus, Tone> = {
  open: { label: "Open", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  "in-progress": { label: "In progress", color: "var(--caution)", surface: "var(--caution-surface)" },
  resolved: { label: "Resolved", color: "var(--success)", surface: "var(--success-surface)" },
  closed: { label: "Closed", color: "var(--muted-foreground)", surface: "oklch(0.96 0 0)" },
};

type Filter = "all" | TmDefectStatus;

export function Defects() {
  const defects = useTm((s) => s.defects);
  const cases = useTm((s) => s.cases);
  const suites = useTm((s) => s.suites);

  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<TmDefect | "new" | null>(null);

  const caseOf = (id: string | null | undefined) => (id ? cases.find((c) => c.id === id) ?? null : null);

  const counts = useMemo(() => {
    const by: Record<Filter, number> = { all: defects.length, open: 0, "in-progress": 0, resolved: 0, closed: 0 };
    for (const d of defects) by[d.status] += 1;
    return by;
  }, [defects]);

  const visible = useMemo(
    () => (filter === "all" ? defects : defects.filter((d) => d.status === filter)),
    [defects, filter],
  );

  const pills: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    ...STATUS_ORDER.map((s) => ({ value: s as Filter, label: DEFECT_STATUS_LABEL[s] })),
  ];

  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Defects</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Bugs raised against test cases and executions — track severity and status through to resolution.
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2.5 rounded-card border border-border bg-surface-1 px-3.5 py-2.5 text-[12.5px] text-ink-2">
        <GitBranch size={15} className="shrink-0 text-muted-foreground" />
        <span>
          GitHub-tracked bugs also live in the QA Queue's <b className="text-ink-1">Verify-fix</b> flow.
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {pills.map((p) => (
            <button
              key={p.value}
              onClick={() => setFilter(p.value)}
              className={`inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                filter === p.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-ink-2 hover:bg-surface-2"
              }`}
            >
              {p.label}
              <span className="rounded-full bg-surface-3 px-1.5 text-[10.5px] font-bold text-ink-2">
                {counts[p.value]}
              </span>
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus size={14} /> Report defect
        </Button>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_110px_120px_180px_150px] items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <span>Key</span>
          <span>Title</span>
          <span>Severity</span>
          <span>Status</span>
          <span>Linked case</span>
          <span>Created</span>
        </div>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-[13.5px] text-muted-foreground">
            <Bug size={22} className="opacity-40" />
            {filter === "all" ? "No defects reported yet." : `No ${DEFECT_STATUS_LABEL[filter].toLowerCase()} defects.`}
          </div>
        ) : (
          visible.map((d) => {
            const linked = caseOf(d.caseId);
            return (
              <div
                key={d.id}
                onClick={() => setEditing(d)}
                className="grid cursor-pointer grid-cols-[80px_1fr_110px_120px_180px_150px] items-center gap-2 border-b border-border px-4 py-3 last:border-0 hover:bg-surface-1"
              >
                <span className="font-mono text-[12px] font-semibold text-ink-2">{d.key}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink-1">{d.title}</span>
                  {d.github && (
                    <a
                      href={d.github.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <GitBranch size={11} /> {d.github.repo}#{d.github.number}
                      <ExternalLink size={10} />
                    </a>
                  )}
                </span>
                <span>
                  <Chip tone={TM_DEFECT_SEVERITY_TONE[d.severity]}>{TM_DEFECT_SEVERITY_TONE[d.severity].label}</Chip>
                </span>
                <span>
                  <StatusBadge tone={DEFECT_STATUS_TONE[d.status]}>{DEFECT_STATUS_LABEL[d.status]}</StatusBadge>
                </span>
                <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">
                  {linked ? (
                    <>
                      <span className="font-mono font-semibold text-ink-2">{linked.key}</span> {linked.title}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="truncate text-[12px] text-muted-foreground">
                  {d.createdBy} · {timeAgo(d.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </Card>

      {editing && (
        <DefectEditor
          initial={editing === "new" ? null : editing}
          cases={cases}
          suites={suites}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DefectEditor({
  initial,
  cases,
  suites,
  onClose,
}: {
  initial: TmDefect | null;
  cases: TmCase[];
  suites: TmSuite[];
  onClose: () => void;
}) {
  const addDefect = useTm((s) => s.addDefect);
  const updateDefect = useTm((s) => s.updateDefect);
  const deleteDefect = useTm((s) => s.deleteDefect);
  const pushToast = useStore((s) => s.pushToast);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [severity, setSeverity] = useState<TmDefectSeverity>(initial?.severity ?? "medium");
  const [status, setStatus] = useState<TmDefectStatus>(initial?.status ?? "open");
  const [caseId, setCaseId] = useState<string>(initial?.caseId ?? "");

  // Group the case picker by suite (only suites that actually contain cases).
  const grouped = useMemo(() => {
    return suites
      .map((s) => ({ suite: s, items: cases.filter((c) => c.suiteId === s.id) }))
      .filter((g) => g.items.length > 0);
  }, [suites, cases]);

  const save = () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim(),
      severity,
      status,
      caseId: caseId || null,
    };
    if (initial) {
      updateDefect(initial.id, payload);
      pushToast({ icon: "check", title: `Updated ${initial.key}`, subtitle: payload.title });
    } else {
      const d = addDefect(payload);
      pushToast({ icon: "issue", title: `Reported ${d.key}`, subtitle: payload.title });
    }
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={initial ? `Edit ${initial.key}` : "Report defect"}
      width={600}
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={INPUT}
            placeholder="Short summary of the bug"
          />
        </div>
        <div>
          <label className={LABEL}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={INPUT}
            rows={4}
            placeholder="Steps to reproduce, expected vs. actual, environment…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as TmDefectSeverity)} className={INPUT}>
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {TM_DEFECT_SEVERITY_TONE[s].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TmDefectStatus)} className={INPUT}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {DEFECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Linked test case (optional)</label>
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={INPUT}>
            <option value="">Not linked</option>
            {grouped.map((g) => (
              <optgroup key={g.suite.id} label={g.suite.name}>
                {g.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.key} · {c.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {initial?.github && (
          <div className="flex items-center gap-2 rounded-control border border-border bg-surface-1 px-3 py-2 text-[12px] text-muted-foreground">
            <GitBranch size={13} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Tracked on GitHub as {initial.github.repo}#{initial.github.number}
            </span>
            <a
              href={initial.github.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              View <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        {initial ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              deleteDefect(initial.id);
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
            {initial ? "Save changes" : "Report defect"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
