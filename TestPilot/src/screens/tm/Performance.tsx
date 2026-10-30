import { useState } from "react";
import { Activity, Gauge, Plus, Trash2, X, Zap } from "lucide-react";
import { useTm } from "@/tm/store";
import { useStore } from "@/store/useStore";
import { TM_PERF_STATUS_TONE, type TmPerfRun } from "@/tm/types";
import { Button, Card, Chip } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import type { PerfTarget } from "@/lib/perf";

const INPUT =
  "w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";
const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground";

const ms = (n: number) => `${Math.round(n)}ms`;
const pctText = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.001 ? 3 : 1)}%`;
const num = (n: number) => Math.round(n).toLocaleString();

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function Performance() {
  const perfRuns = useTm((s) => s.perfRuns);
  const deletePerfRun = useTm((s) => s.deletePerfRun);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<TmPerfRun | null>(null);

  // Keep the viewed run in sync with the store (so a "running" row updates to its
  // terminal result while the detail modal is open).
  const viewingLive = viewing ? perfRuns.find((r) => r.id === viewing.id) ?? viewing : null;

  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Performance</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Load-test any endpoint — drive it at a set concurrency and gate it against a p95 latency budget and error-rate SLA.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> New load run
        </Button>
      </div>

      <Card className="min-w-0 overflow-x-auto">
        <div className="grid min-w-[860px] grid-cols-[1fr_110px_90px_110px_100px_110px_120px] items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <span>Run</span>
          <span>Status</span>
          <span className="text-right">Requests</span>
          <span className="text-right">Error rate</span>
          <span className="text-right">p95</span>
          <span className="text-right">Throughput</span>
          <span className="text-right">Started</span>
        </div>
        {perfRuns.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-muted-foreground">
            No load runs yet. Click <span className="font-semibold text-ink-2">New load run</span> to drive an endpoint and
            measure its latency budget.
          </div>
        ) : (
          perfRuns.map((r) => (
            <div
              key={r.id}
              onClick={() => setViewing(r)}
              className="grid min-w-[860px] cursor-pointer grid-cols-[1fr_110px_90px_110px_100px_110px_120px] items-center gap-3 border-b border-border px-4 py-3 hover:bg-surface-1"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <Gauge size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink-1">{r.label}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {r.vus} VUs · {r.durationSec}s · {r.transactions.length || "—"} txn
                  </span>
                </span>
              </span>
              <span>
                <Chip tone={TM_PERF_STATUS_TONE[r.status]}>{TM_PERF_STATUS_TONE[r.status].label}</Chip>
              </span>
              <span className="text-right text-[12.5px] tabular-nums text-ink-2">{num(r.totalRequests)}</span>
              <span
                className="text-right text-[12.5px] tabular-nums"
                style={{ color: r.errorRate > 0 ? "var(--destructive)" : "var(--ink-2)" }}
              >
                {pctText(r.errorRate)}
              </span>
              <span className="text-right text-[12.5px] tabular-nums text-ink-2">{r.status === "running" ? "…" : ms(r.p95Ms)}</span>
              <span className="text-right text-[12.5px] tabular-nums text-ink-2">{r.status === "running" ? "…" : `${num(r.rps)}/s`}</span>
              <span className="text-right text-[12px] text-muted-foreground">{relTime(r.startedAt)}</span>
            </div>
          ))
        )}
      </Card>

      {creating && <NewRunModal onClose={() => setCreating(false)} onStarted={(run) => setViewing(run)} />}
      {viewingLive && (
        <RunDetail
          run={viewingLive}
          onClose={() => setViewing(null)}
          onDelete={() => {
            deletePerfRun(viewingLive.id);
            setViewing(null);
          }}
        />
      )}
    </div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-control border border-border bg-surface-2 px-3.5 py-3">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[20px] font-bold tabular-nums tracking-tight" style={{ color: tone ?? "var(--ink-1)" }}>
        {value}
      </div>
    </div>
  );
}

function RunDetail({ run, onClose, onDelete }: { run: TmPerfRun; onClose: () => void; onDelete: () => void }) {
  const running = run.status === "running";
  const errored = run.status === "error";
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={run.label} width={720}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip tone={TM_PERF_STATUS_TONE[run.status]}>{TM_PERF_STATUS_TONE[run.status].label}</Chip>
        <span className="text-[12px] text-muted-foreground">
          {run.engine} · {run.location} · {run.vus} VUs · {run.durationSec}s
        </span>
        {run.budgetP95Ms != null && (
          <span className="text-[12px] text-muted-foreground">· p95 budget {run.budgetP95Ms}ms</span>
        )}
        {run.maxErrorRate != null && (
          <span className="text-[12px] text-muted-foreground">· max err {(run.maxErrorRate * 100).toFixed(1)}%</span>
        )}
      </div>

      {running && (
        <div className="flex items-center gap-2 rounded-control border border-border bg-surface-2 px-4 py-6 text-[13px] text-muted-foreground">
          <Zap size={15} className="animate-pulse text-primary" /> Running the load test…
        </div>
      )}

      {errored && (
        <div className="rounded-control border border-border bg-[var(--destructive-surface)] px-4 py-3 text-[13px] text-[var(--destructive)]">
          {run.gateReason || "The run failed to start."}
        </div>
      )}

      {!running && !errored && (
        <>
          {run.gateReason ? (
            <div className="mb-3 rounded-control border border-border bg-[var(--destructive-surface)] px-3.5 py-2.5 text-[12.5px] text-[var(--destructive)]">
              <b>NO-GO:</b> {run.gateReason}
            </div>
          ) : (
            <div className="mb-3 rounded-control border border-border bg-[var(--success-surface)] px-3.5 py-2.5 text-[12.5px] text-[var(--success)]">
              <b>Within budget</b> — p95 and error rate met the SLA.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <KpiTile label="Requests" value={num(run.totalRequests)} />
            <KpiTile
              label="Error rate"
              value={pctText(run.errorRate)}
              tone={run.errorRate > 0 ? "var(--destructive)" : "var(--success)"}
            />
            <KpiTile label="Avg latency" value={ms(run.avgMs)} />
            <KpiTile
              label="p95 latency"
              value={ms(run.p95Ms)}
              tone={run.budgetP95Ms != null && run.p95Ms > run.budgetP95Ms ? "var(--destructive)" : "var(--ink-1)"}
            />
            <KpiTile label="Throughput" value={`${num(run.rps)}/s`} />
          </div>

          <div className="mb-1.5 mt-4 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            <Activity size={13} /> Transactions
          </div>
          <div className="overflow-x-auto rounded-control border border-border">
            <table className="w-full min-w-[620px] border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-surface-2 text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-3 py-2 text-left">Transaction</th>
                  <th className="px-3 py-2 text-right">Samples</th>
                  <th className="px-3 py-2 text-right">Err</th>
                  <th className="px-3 py-2 text-right">p50</th>
                  <th className="px-3 py-2 text-right">p90</th>
                  <th className="px-3 py-2 text-right">p95</th>
                  <th className="px-3 py-2 text-right">p99</th>
                  <th className="px-3 py-2 text-right">req/s</th>
                </tr>
              </thead>
              <tbody>
                {run.transactions.map((t) => (
                  <tr key={t.target} className="border-t border-border">
                    <td className="max-w-[220px] px-3 py-2">
                      <div className="truncate font-medium text-ink-1">{t.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{t.target}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-2">{num(t.samples)}</td>
                    <td
                      className="px-3 py-2 text-right tabular-nums"
                      style={{ color: t.errors > 0 ? "var(--destructive)" : "var(--ink-2)" }}
                    >
                      {t.errors}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-2">{ms(t.p50)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-2">{ms(t.p90)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-2">{ms(t.p95)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-2">{ms(t.p99)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-2">{num(t.rps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-5 flex items-center justify-between">
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 size={13} /> Delete run
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

type Row = { name: string; url: string; method: string };

function NewRunModal({ onClose, onStarted }: { onClose: () => void; onStarted: (run: TmPerfRun) => void }) {
  const startPerfRun = useTm((s) => s.startPerfRun);
  const pushToast = useStore((s) => s.pushToast);
  const [label, setLabel] = useState("");
  const [rows, setRows] = useState<Row[]>([{ name: "", url: "", method: "GET" }]);
  const [vus, setVus] = useState(5);
  const [durationSec, setDurationSec] = useState(15);
  const [budget, setBudget] = useState("");
  const [maxErr, setMaxErr] = useState("");
  const [busy, setBusy] = useState(false);

  const validRows = rows.filter((r) => /^https?:\/\//i.test(r.url.trim()));
  const canRun = validRows.length > 0 && !busy;

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const start = async () => {
    if (!canRun) return;
    setBusy(true);
    const targets: PerfTarget[] = validRows.map((r) => ({
      name: r.name.trim() || undefined,
      url: r.url.trim(),
      method: r.method,
    }));
    const run = await startPerfRun({
      label: label.trim(),
      targets,
      vus,
      durationSec,
      budgetP95Ms: budget.trim() ? Number(budget) : null,
      maxErrorRate: maxErr.trim() ? Number(maxErr) / 100 : null,
    });
    setBusy(false);
    if (run.status === "error") {
      pushToast({ icon: "issue", title: "Load run failed", subtitle: run.gateReason ?? "See the run for details" });
    } else {
      pushToast({
        icon: run.status === "passed" ? "generate" : "issue",
        title: run.status === "passed" ? "Load run passed" : "Load run failed the SLA",
        subtitle: `p95 ${Math.round(run.p95Ms)}ms · ${(run.errorRate * 100).toFixed(1)}% err · ${Math.round(run.rps)} req/s`,
      });
    }
    onClose();
    onStarted(run);
  };

  return (
    <Modal open onOpenChange={(o) => !o && !busy && onClose()} title="New load run" width={640}>
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT} placeholder="e.g. LedgerPort Plans API — 20 VUs" />
        </div>

        <div>
          <label className={LABEL}>Targets (transactions)</label>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[92px_1fr_84px_32px] items-center gap-2">
                <select value={r.method} onChange={(e) => setRow(i, { method: e.target.value })} className={INPUT}>
                  {["GET", "POST", "HEAD", "PUT"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input value={r.url} onChange={(e) => setRow(i, { url: e.target.value })} className={INPUT} placeholder="https://…" />
                <input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} className={INPUT} placeholder="name" />
                <button
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}
                  className="flex h-9 w-8 items-center justify-center rounded-control border border-border text-muted-foreground hover:bg-surface-2"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setRows((rs) => [...rs, { name: "", url: "", method: "GET" }])}
            className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            <Plus size={12} /> Add target
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={LABEL}>Virtual users</label>
            <input type="number" min={1} max={50} value={vus} onChange={(e) => setVus(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Duration (s)</label>
            <input type="number" min={1} max={120} value={durationSec} onChange={(e) => setDurationSec(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>p95 budget (ms)</label>
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className={INPUT} placeholder="optional" />
          </div>
          <div>
            <label className={LABEL}>Max error %</label>
            <input type="number" min={0} max={100} value={maxErr} onChange={(e) => setMaxErr(e.target.value)} className={INPUT} placeholder="optional" />
          </div>
        </div>

        <p className="text-[11.5px] text-muted-foreground">
          Runs from this machine (single engine, capped at 50 VUs / 120s). Sends real requests — point it at staging, not production.
        </p>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={!canRun} onClick={start}>
          {busy ? "Running…" : "Run load test"}
        </Button>
      </div>
    </Modal>
  );
}
