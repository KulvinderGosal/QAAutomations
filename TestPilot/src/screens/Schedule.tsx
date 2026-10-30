import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  FolderGit2,
  Loader2,
  Pause,
  Play,
  Plus,
  Terminal,
  Trash2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card, Chip } from "@/components/ui/primitives";
import { BRAND_TONE } from "@/lib/tone";
import { RunPanel } from "@/screens/runner/RunPanel";
import { timeAgo } from "@/lib/utils";
import { fetchScripts, type NpmScript, type RunnerFramework } from "@/lib/runner";
import {
  createScheduleReq,
  deleteScheduleReq,
  describeCadence,
  fetchSchedules,
  runScheduleReq,
  toggleScheduleReq,
  type Cadence,
  type Schedule,
} from "@/lib/schedule";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Readable future time for a schedule's next run (timeAgo is past-only). */
function fmtNext(iso: string): string {
  const d = new Date(iso);
  const soon = d.getTime() - Date.now() < 24 * 3600_000;
  return d.toLocaleString(undefined, soon ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export function Schedule() {
  const frameworks = useStore((s) => s.runnerFrameworks);
  const loadRunnerFrameworks = useStore((s) => s.loadRunnerFrameworks);
  const startPlaywrightRun = useStore((s) => s.startPlaywrightRun);
  const run = useStore((s) => s.runnerRun);
  const brand = useStore((s) => s.brand);
  const pushToast = useStore((s) => s.pushToast);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<NpmScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [env, setEnv] = useState("");
  const [cmdInput, setCmdInput] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New-schedule form state.
  const [schedScript, setSchedScript] = useState("");
  const [cadType, setCadType] = useState<"interval" | "daily" | "weekly">("daily");
  const [everyMinutes, setEveryMinutes] = useState(60);
  const [atTime, setAtTime] = useState("09:00");
  const [weekday, setWeekday] = useState(1);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!frameworks) void loadRunnerFrameworks();
  }, [frameworks, loadRunnerFrameworks]);

  const refreshSchedules = () =>
    fetchSchedules()
      .then((r) => setSchedules(r.schedules))
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    void refreshSchedules();
    const t = setInterval(() => void refreshSchedules(), 15_000);
    return () => clearInterval(t);
  }, []);

  const visible = (frameworks ?? []).filter((f) => brand === "all" || f.brand === brand);
  const selected = visible.find((f) => f.id === selectedId) ?? null;
  const running = run?.status === "running";

  const pick = (fw: RunnerFramework) => {
    setSelectedId(fw.id);
    setEnv(fw.defaultEnv ?? "");
    setSchedScript("");
    setScripts([]);
    if (!fw.healthy) return;
    setScriptsLoading(true);
    fetchScripts(fw.id)
      .then((r) => {
        setScripts(r.scripts);
        setSchedScript(r.scripts[0]?.name ?? "");
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setScriptsLoading(false));
  };

  const runScript = (script: string) => {
    if (!selected || running || !script.trim()) return;
    void startPlaywrightRun({ framework: selected.id, mode: "command", script: script.trim(), env: env || undefined });
  };

  const buildCadence = (): Cadence =>
    cadType === "interval"
      ? { type: "interval", everyMinutes }
      : cadType === "daily"
        ? { type: "daily", at: atTime }
        : { type: "weekly", day: weekday, at: atTime };

  const createSchedule = async () => {
    if (!selected || !schedScript) return;
    setCreating(true);
    try {
      await createScheduleReq({ framework: selected.id, script: schedScript, env: env || null, cadence: buildCadence() });
      await refreshSchedules();
      pushToast({ icon: "check", title: "Schedule created", subtitle: `${schedScript} · ${describeCadence(buildCadence())}` });
    } catch (e) {
      pushToast({ icon: "issue", title: "Couldn't create schedule", subtitle: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const fwLabel = (id: string) => frameworks?.find((f) => f.id === id)?.label ?? id;

  return (
    <div>
      <div className="mb-5">
        <h1 className="m-0 text-[24px] font-bold tracking-tight">Automation Scheduler</h1>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          Schedule Playwright automation for a product, or run any of its npm commands right here in the terminal. Pick a
          framework to see every command from its <span className="font-mono text-[12.5px]">package.json</span>. Runs
          execute locally, one at a time. The header tab scopes this list by brand.
        </p>
        <p className="m-0 mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <AlertTriangle size={13} className="shrink-0 text-caution" />
          Schedules fire only while the TestPilot dev server (<span className="font-mono">npm run dev</span>) is running —
          they persist across restarts but there is no always-on backend.
        </p>
      </div>

      {error && (
        <Card className="mb-4 flex items-center gap-2.5 border-[color-mix(in_srgb,var(--destructive)_35%,transparent)] p-3.5 text-[13px] text-destructive">
          <AlertTriangle size={15} className="shrink-0" /> {error}
        </Card>
      )}

      {/* Framework picker */}
      <div className="mb-5 grid grid-cols-4 gap-2.5">
        {visible.map((fw) => (
          <button
            key={fw.id}
            onClick={() => pick(fw)}
            className={`group cursor-pointer rounded-card border bg-card p-3 text-left transition-all duration-150 ${
              fw.id === selectedId
                ? "border-primary shadow-[0_0_0_1px_var(--primary)]"
                : "border-border hover:-translate-y-0.5 hover:border-[oklch(0.8_0_0)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105"
                style={{ background: BRAND_TONE[fw.brand].surface, color: BRAND_TONE[fw.brand].color }}
              >
                <FolderGit2 size={14} />
              </span>
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${fw.healthy ? "bg-success" : "bg-warning"}`} title={fw.problem ?? "Ready"} />
            </div>
            <div className="mt-2 min-w-0 text-[12.5px] font-semibold leading-tight text-ink-1">
              <span className="line-clamp-2">{fw.label}</span>
            </div>
            <div className="mt-1.5">
              <Chip tone={BRAND_TONE[fw.brand]}>{fw.brand}</Chip>
            </div>
          </button>
        ))}
        {!frameworks && (
          <Card className="col-span-4 flex items-center justify-center gap-2 p-8 text-[13px] text-muted-foreground">
            <Loader2 size={15} className="cp-spin" /> Checking frameworks…
          </Card>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start gap-[18px]">
        <div className="flex flex-col gap-[18px]">
          {/* npm commands + terminal input */}
          {selected && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
                <h2 className="m-0 flex items-center gap-1.5 text-[15px] font-semibold">
                  <Terminal size={15} className="text-muted-foreground" /> {selected.label} — commands
                </h2>
                <span className="flex-1" />
                {selected.envVar && (
                  <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                    {selected.envVar}
                    <select
                      value={env}
                      onChange={(e) => setEnv(e.target.value)}
                      className="rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1 outline-none"
                    >
                      {selected.envOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {/* Free-text: type a command and run it in the terminal */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <span className="font-mono text-[12px] text-muted-foreground">npm run</span>
                <input
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      runScript(cmdInput);
                      setCmdInput("");
                    }
                  }}
                  placeholder="type a script name (e.g. test:smoke) and press Enter"
                  className="min-w-0 flex-1 rounded-control border border-border bg-card px-2.5 py-1.5 font-mono text-[12px] text-ink-1 outline-none focus:border-primary"
                  list="sched-scripts"
                />
                <datalist id="sched-scripts">
                  {scripts.map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={running || !cmdInput.trim() || !selected.healthy}
                  onClick={() => {
                    runScript(cmdInput);
                    setCmdInput("");
                  }}
                >
                  <Play size={12} /> Run
                </Button>
              </div>

              {!selected.healthy ? (
                <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-warning">
                  <AlertTriangle size={15} /> {selected.problem}
                </div>
              ) : scriptsLoading ? (
                <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground">
                  <Loader2 size={15} className="cp-spin" /> Reading package.json scripts…
                </div>
              ) : (
                <div className="max-h-[340px] overflow-y-auto">
                  {scripts.map((s) => (
                    <div key={s.name} className="flex items-center gap-2 border-b border-border px-4 py-2 last:border-b-0 hover:bg-surface-1">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[12.5px] font-semibold text-ink-1">{s.name}</div>
                        <div className="truncate font-mono text-[10.5px] text-muted-foreground">{s.command}</div>
                      </div>
                      <Button size="sm" variant="ghost" title="Use in the schedule form below" onClick={() => setSchedScript(s.name)}>
                        <CalendarClock size={13} />
                      </Button>
                      <Button size="sm" variant="outline" disabled={running} onClick={() => runScript(s.name)} title={`npm run ${s.name}`}>
                        <Play size={12} /> Run
                      </Button>
                    </div>
                  ))}
                  {scripts.length === 0 && <div className="px-4 py-6 text-[13px] text-muted-foreground">No npm scripts found.</div>}
                </div>
              )}

              {/* New schedule form */}
              {selected.healthy && scripts.length > 0 && (
                <div className="flex flex-wrap items-end gap-2.5 border-t border-border bg-surface-1 px-4 py-3">
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                    Command
                    <select
                      value={schedScript}
                      onChange={(e) => setSchedScript(e.target.value)}
                      className="rounded-control border border-border bg-card px-2 py-1 font-mono text-[12px] text-ink-1 outline-none"
                    >
                      {scripts.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                    Cadence
                    <select
                      value={cadType}
                      onChange={(e) => setCadType(e.target.value as typeof cadType)}
                      className="rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1 outline-none"
                    >
                      <option value="interval">every N min</option>
                      <option value="daily">daily</option>
                      <option value="weekly">weekly</option>
                    </select>
                  </label>
                  {cadType === "interval" ? (
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                      minutes
                      <input
                        type="number"
                        min={1}
                        value={everyMinutes}
                        onChange={(e) => setEveryMinutes(Math.max(1, Number(e.target.value) || 1))}
                        className="w-20 rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1 outline-none"
                      />
                    </label>
                  ) : (
                    <>
                      {cadType === "weekly" && (
                        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                          day
                          <select
                            value={weekday}
                            onChange={(e) => setWeekday(Number(e.target.value))}
                            className="rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1 outline-none"
                          >
                            {WEEKDAYS.map((d, i) => (
                              <option key={d} value={i}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                        at
                        <input
                          type="time"
                          value={atTime}
                          onChange={(e) => setAtTime(e.target.value)}
                          className="rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1 outline-none"
                        />
                      </label>
                    </>
                  )}
                  <Button size="sm" variant="primary" disabled={creating || !schedScript} onClick={() => void createSchedule()}>
                    {creating ? <Loader2 size={12} className="cp-spin" /> : <Plus size={12} />} Add schedule
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Scheduled jobs */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <h2 className="m-0 flex items-center gap-1.5 text-[15px] font-semibold">
                <CalendarClock size={15} className="text-muted-foreground" /> Scheduled jobs
              </h2>
              <span className="rounded-full bg-surface-3 px-1.5 text-[10.5px] font-bold text-muted-foreground">{schedules.length}</span>
            </div>
            {schedules.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                No schedules yet. Pick a framework and add one above.
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                {schedules.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${s.enabled ? "bg-success" : "bg-[oklch(0.7_0_0)]"}`}
                      title={s.enabled ? "Enabled" : "Paused"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-ink-1">
                        <span className="font-mono">{s.script}</span>
                        <span className="ml-1.5 font-normal text-muted-foreground">· {fwLabel(s.framework)}</span>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {describeCadence(s.cadence)}
                        {s.env ? ` · ${s.env}` : ""}
                        {s.nextRunAt && s.enabled ? ` · next ${fmtNext(s.nextRunAt)}` : ""}
                        {s.lastStatus ? ` · last: ${s.lastStatus}${s.lastRunAt ? ` (${timeAgo(s.lastRunAt)})` : ""}` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={running}
                      title="Run now"
                      onClick={() =>
                        void runScheduleReq(s.id)
                          .then(() => pushToast({ icon: "generate", title: "Schedule run started", subtitle: s.script }))
                          .then(refreshSchedules)
                          .catch((e) => pushToast({ icon: "issue", title: "Couldn't run", subtitle: (e as Error).message }))
                      }
                    >
                      <Play size={12} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={s.enabled ? "Pause" : "Enable"}
                      onClick={() => void toggleScheduleReq(s.id, !s.enabled).then(refreshSchedules)}
                    >
                      {s.enabled ? <Pause size={12} /> : <Play size={12} />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Delete"
                      onClick={() => void deleteScheduleReq(s.id).then(refreshSchedules)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <RunPanel />
      </div>
    </div>
  );
}
