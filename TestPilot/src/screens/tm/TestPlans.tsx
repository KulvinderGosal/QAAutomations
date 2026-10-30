import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ClipboardList, FlaskConical, GitPullRequest, Loader2, Play, Rocket, Sparkles, Trash2, Zap } from "lucide-react";
import { useTm } from "@/tm/store";
import { useStore } from "@/store/useStore";
import { fetchPr, listPrs, parsePrUrl, type GithubPr } from "@/lib/github";
import {
  TM_PLAN_STATUS_LABEL,
  TM_PRIORITY_LABEL,
  TM_PRIORITY_TONE,
  TM_RUN_STATUS_LABEL,
  TM_RUN_STATUS_TONE,
  type TmCase,
  type TmPlan,
  type TmPlanStatus,
} from "@/tm/types";
import { Button, Card, Chip, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { RunPanel } from "@/screens/runner/RunPanel";

const INPUT =
  "w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";
const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground";

// Share of a plan's cases that have been executed at least once.
function planProgress(plan: TmPlan, cases: TmCase[]): { executed: number; total: number; pct: number } {
  const total = plan.caseIds.length;
  if (total === 0) return { executed: 0, total: 0, pct: 0 };
  const executed = plan.caseIds.filter((id) => {
    const c = cases.find((x) => x.id === id);
    return c ? c.lastRunStatus !== "unexecuted" : false;
  }).length;
  return { executed, total, pct: Math.round((executed / total) * 100) };
}

const SEL =
  "rounded-control border border-border bg-card px-2 py-1.5 text-[12.5px] text-ink-1 outline-none focus:border-primary";

// Known product → source-repo map for the "fetch latest PR" path. Any other repo
// works via the PR-URL box, so this only needs the products whose repo we know.
const PRODUCT_REPO: Record<string, string> = {
  "pushengage-shopify-revamped": "awesomemotive/pushengage-sdks",
  "pushengage-app-dashboard": "awesomemotive/pushengage-app",
  "ledgerport-marketing-site": "awesomemotive/pushengage-ledgerport-site",
  "ledgerport-shopify": "awesomemotive/omnysync-backend",
};

// PR → test plan builder: fetch a product's latest PR (or a pasted PR link),
// then generate a test plan against it — deterministic checklist cases from the
// PR's changed areas + the product's runnable automated cases, AI-enriched when
// Anthropic credits are available.
function PlanFromPr({ onCreated }: { onCreated: (planId: string) => void }) {
  const frameworks = useStore((s) => s.runnerFrameworks);
  const loadRunnerFrameworks = useStore((s) => s.loadRunnerFrameworks);
  const createPlanFromPr = useTm((s) => s.createPlanFromPr);
  const pushToast = useStore((s) => s.pushToast);
  const aiUnfunded = useStore((s) => s.aiUnfunded);

  const [fwId, setFwId] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [pr, setPr] = useState<GithubPr | null>(null);
  const [busy, setBusy] = useState<"" | "fetch" | "create">("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!frameworks) void loadRunnerFrameworks();
  }, [frameworks, loadRunnerFrameworks]);

  const repoForFw = fwId ? PRODUCT_REPO[fwId] : "";

  const doFetch = async (source: "url" | "latest") => {
    setErr("");
    setPr(null);
    setBusy("fetch");
    try {
      let repo = "";
      let number = 0;
      if (source === "url") {
        const parsed = parsePrUrl(prUrl);
        if (!parsed) throw new Error("Paste a valid GitHub PR link (…/pull/123)");
        ({ repo, number } = parsed);
      } else {
        if (!repoForFw) throw new Error("No repo mapped for this product — paste a PR link instead");
        const prs = await listPrs(repoForFw);
        if (!prs.length) throw new Error(`No open PRs in ${repoForFw}`);
        repo = repoForFw;
        number = prs[0].number;
      }
      setPr(await fetchPr(repo, number));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const create = async () => {
    if (!pr) return;
    setBusy("create");
    setErr("");
    try {
      // frameworkId drives auto-linking of runnable cases: the picked product, or
      // inferred from the PR's repo when the box was used without picking one.
      const inferred = Object.entries(PRODUCT_REPO).find(([, r]) => pr.url.includes(r))?.[0] ?? null;
      const plan = await createPlanFromPr(pr, fwId || inferred);
      pushToast({ icon: "generate", title: `Test plan ${plan.key} created`, subtitle: `PR #${pr.number} · ${plan.caseIds.length} cases` });
      onCreated(plan.id);
      setPr(null);
      setPrUrl("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Card className="mb-[18px] overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
        <GitPullRequest size={16} className="text-primary" />
        <h2 className="m-0 text-[14px] font-semibold">New test plan from a PR</h2>
        <span className="text-[11.5px] text-muted-foreground">
          Fetch a product’s latest PR — or paste a PR link — and generate a plan against its changed areas.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2.5 px-4 py-3.5">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          Product
          <select value={fwId} onChange={(e) => setFwId(e.target.value)} className={SEL + " min-w-[220px]"}>
            <option value="">Pick a product…</option>
            {(frameworks ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
                {PRODUCT_REPO[f.id] ? "" : " (paste PR link)"}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" size="sm" disabled={!repoForFw || busy !== ""} onClick={() => void doFetch("latest")}>
          {busy === "fetch" ? <Loader2 size={13} className="cp-spin" /> : <GitPullRequest size={13} />} Fetch latest PR
        </Button>

        <span className="px-1 text-[11px] text-muted-foreground">or</span>

        <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          PR link
          <input
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && prUrl && void doFetch("url")}
            placeholder="https://github.com/owner/repo/pull/123"
            className={SEL + " min-w-[260px]"}
          />
        </label>
        <Button variant="outline" size="sm" disabled={!prUrl || busy !== ""} onClick={() => void doFetch("url")}>
          {busy === "fetch" ? <Loader2 size={13} className="cp-spin" /> : null} Fetch PR
        </Button>
      </div>

      {err && (
        <div
          className="mx-4 mb-3 rounded-control border px-3 py-2 text-[12px]"
          style={{ borderColor: "var(--destructive)", background: "var(--destructive-surface)", color: "var(--destructive)" }}
        >
          {err}
        </div>
      )}

      {pr && (
        <div className="border-t border-border bg-surface-1 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] font-semibold text-ink-2">#{pr.number}</span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-1">{pr.title}</span>
            <StatusBadge
              tone={
                pr.merged
                  ? { label: "merged", color: "var(--info)", surface: "var(--info-surface)" }
                  : pr.state === "open"
                    ? { label: "open", color: "var(--success)", surface: "var(--success-surface)" }
                    : { label: "closed", color: "var(--muted-foreground)", surface: "var(--surface-2)" }
              }
            >
              {pr.merged ? "merged" : pr.state}
            </StatusBadge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            <span>{pr.changedFiles} files changed</span>
            <span>·</span>
            <span>by {pr.author ?? "—"}</span>
            <span>·</span>
            <span>{pr.base} ← {pr.head}</span>
            {pr.labels.slice(0, 5).map((l) => (
              <Chip key={l} tone={{ color: "var(--muted-foreground)", surface: "var(--surface-2)" }}>
                {l}
              </Chip>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={busy !== ""} onClick={() => void create()}>
              {busy === "create" ? <Loader2 size={13} className="cp-spin" /> : <ClipboardList size={13} />} Create test plan
            </Button>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles size={12} className={aiUnfunded ? "text-muted-foreground" : "text-primary"} />
              {aiUnfunded
                ? "Deterministic plan (AI enrichment needs Anthropic credits)"
                : "Checklist + runnable cases, enriched with AI scenarios"}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

// Product-level automation launcher: pick a product (framework) and run its
// Smoke set, Full regression, or a single spec — all through the shared local
// Playwright runner (same infra as the Test Runner), streamed in the RunPanel.
function RunAutomation() {
  const frameworks = useStore((s) => s.runnerFrameworks);
  const loadRunnerFrameworks = useStore((s) => s.loadRunnerFrameworks);
  const specsByFw = useStore((s) => s.runnerSpecs);
  const specsLoading = useStore((s) => s.runnerSpecsLoading);
  const loadRunnerSpecs = useStore((s) => s.loadRunnerSpecs);
  const startPlaywrightRun = useStore((s) => s.startPlaywrightRun);
  const run = useStore((s) => s.runnerRun);
  const pushToast = useStore((s) => s.pushToast);

  const [fwId, setFwId] = useState("");
  const [env, setEnv] = useState("");
  const [project, setProject] = useState("");
  const [filter, setFilter] = useState("");
  const [spec, setSpec] = useState("");

  useEffect(() => {
    if (!frameworks) void loadRunnerFrameworks();
  }, [frameworks, loadRunnerFrameworks]);

  const fw = frameworks?.find((f) => f.id === fwId) ?? null;
  const specs = fwId ? specsByFw[fwId] : undefined;
  const running = run?.status === "running";

  const pickFw = (id: string) => {
    setFwId(id);
    setSpec("");
    setFilter("");
    const f = frameworks?.find((x) => x.id === id) ?? null;
    setEnv(f?.defaultEnv ?? "");
    setProject(f && f.projects.length > 1 ? f.projects[0] : "");
    if (f?.healthy && !specsByFw[id]) void loadRunnerSpecs(id);
  };

  const start = (mode: "smoke" | "full" | "spec", specPath?: string) => {
    if (!fw || running || !fw.healthy) return;
    void startPlaywrightRun({
      framework: fw.id,
      mode,
      spec: specPath,
      project: project || undefined,
      env: env || undefined,
      quick: mode === "spec",
    });
    pushToast({
      icon: "generate",
      title: mode === "smoke" ? "Smoke run started" : mode === "full" ? "Regression run started" : "Test run started",
      subtitle: fw.label + (env ? ` · ${env}` : ""),
    });
  };

  const filtered = (specs ?? [])
    .filter((s) => !filter || `${s.file} ${s.title}`.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 300);

  return (
    <Card className="mb-[18px] overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
        <Rocket size={16} className="text-primary" />
        <h2 className="m-0 text-[14px] font-semibold">Run automation</h2>
        <span className="text-[11.5px] text-muted-foreground">
          Pick a product, then run its smoke, full regression, or a single test — live below.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2.5 px-4 py-3.5">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          Product
          <select value={fwId} onChange={(e) => pickFw(e.target.value)} className={SEL + " min-w-[220px]"}>
            <option value="">Pick a product…</option>
            {(frameworks ?? []).map((f) => (
              <option key={f.id} value={f.id} disabled={!f.healthy}>
                {f.label}
                {f.healthy ? "" : " (unavailable)"}
              </option>
            ))}
          </select>
        </label>

        {fw?.envVar && (
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            {fw.envVar}
            <select value={env} onChange={(e) => setEnv(e.target.value)} className={SEL}>
              {fw.envOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        )}

        {fw && fw.projects.length > 1 && (
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            browser
            <select value={project} onChange={(e) => setProject(e.target.value)} className={SEL}>
              {fw.projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="all">all browsers</option>
            </select>
          </label>
        )}

        <Button variant="outline" size="sm" disabled={!fw || running || !fw.healthy} onClick={() => start("smoke")}>
          <Zap size={13} /> Smoke
        </Button>
        <Button variant="primary" size="sm" disabled={!fw || running || !fw.healthy} onClick={() => start("full")}>
          <FlaskConical size={13} /> Regression
        </Button>
        {running && (
          <span className="flex items-center gap-1.5 text-[11.5px] text-emphasis">
            <Loader2 size={12} className="cp-spin" /> a run is in progress…
          </span>
        )}
      </div>

      {/* Individual test run */}
      {fw && fw.healthy && (
        <div className="flex flex-wrap items-end gap-2.5 border-t border-border bg-surface-1 px-4 py-3">
          <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            Individual test
            {specsLoading === fwId && !specs ? (
              <span className="flex items-center gap-1.5 py-1.5 text-[12px] text-muted-foreground">
                <Loader2 size={12} className="cp-spin" /> listing tests…
              </span>
            ) : specs && specs.length ? (
              <div className="flex flex-wrap gap-2">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={`Filter ${specs.length} tests…`}
                  className={SEL + " w-48"}
                />
                <select value={spec} onChange={(e) => setSpec(e.target.value)} className={SEL + " min-w-[280px] max-w-[520px]"}>
                  <option value="">Pick a test…</option>
                  {filtered.map((s, i) => (
                    <option key={`${s.file}:${s.line}:${i}`} value={`${s.file}:${s.line}`}>
                      {s.title} — {s.file.split("/").pop()}:{s.line}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="py-1.5 text-[12px] text-muted-foreground">No tests listed for this product.</span>
            )}
          </label>
          <Button variant="outline" size="sm" disabled={!spec || running} onClick={() => start("spec", spec)}>
            <Play size={12} /> Run test
          </Button>
        </div>
      )}

      {run && (
        <div className="border-t border-border p-4">
          <RunPanel />
        </div>
      )}
    </Card>
  );
}

export function TestPlans() {
  const navigate = useNavigate();
  const plans = useTm((s) => s.plans);
  const cases = useTm((s) => s.cases);
  const releases = useTm((s) => s.releases);
  const users = useStore((s) => s.users);

  const [showArchived, setShowArchived] = useState(false);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);

  const visible = useMemo(
    () => (showArchived ? plans : plans.filter((p) => p.status !== "archived")),
    [plans, showArchived],
  );

  const openPlan = plans.find((p) => p.id === openPlanId) ?? null;

  const releaseName = (id?: string | null) => releases.find((r) => r.id === id)?.name ?? "—";
  const userName = (id?: string | null) => users.find((u) => u.id === id)?.name ?? "—";

  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Test Plans</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Grouped sets of cases scheduled for execution against a release, with live progress across the suite.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-ink-2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-[15px] w-[15px] cursor-pointer accent-[var(--primary)]"
          />
          Show archived
        </label>
      </div>

      <PlanFromPr onCreated={(id) => setOpenPlanId(id)} />

      <RunAutomation />

      <Card className="min-w-0 overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_170px_110px_130px_110px_150px_150px] items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <span>Plan</span>
          <span>Title</span>
          <span>Progress</span>
          <span>Status</span>
          <span>Release</span>
          <span>Priority</span>
          <span>Assigned To</span>
          <span>Created By</span>
        </div>
        {visible.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-muted-foreground">
            No test plans yet. Create one from{" "}
            <button onClick={() => navigate("/tests")} className="font-semibold text-primary hover:underline">
              Test Cases
            </button>{" "}
            — select cases, then <b>Create Test Plan</b>.
          </div>
        ) : (
          visible.map((p) => {
            const prog = planProgress(p, cases);
            return (
              <div
                key={p.id}
                onClick={() => setOpenPlanId(p.id)}
                className="grid cursor-pointer grid-cols-[80px_1fr_170px_110px_130px_110px_150px_150px] items-center gap-2 border-b border-border px-4 py-3 hover:bg-surface-1"
              >
                <span className="font-mono text-[12px] font-semibold text-ink-2">{p.key}</span>
                <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink-1">{p.title}</span>
                <span className="flex items-center gap-2">
                  <ProgressBar value={prog.pct} />
                  <span className="w-9 shrink-0 text-right text-[11.5px] tabular-nums text-muted-foreground">{prog.pct}%</span>
                </span>
                <span className="text-[12.5px] text-ink-2">{TM_PLAN_STATUS_LABEL[p.status]}</span>
                <span className="truncate text-[12.5px] text-muted-foreground">{releaseName(p.releaseId)}</span>
                <span>
                  <Chip tone={TM_PRIORITY_TONE[p.priority]}>{TM_PRIORITY_LABEL[p.priority]}</Chip>
                </span>
                <span className="truncate text-[12.5px] text-ink-2">{userName(p.assignedTo)}</span>
                <span className="truncate text-[12.5px] text-muted-foreground">{p.createdBy}</span>
              </div>
            );
          })
        )}
      </Card>

      {openPlan && (
        <PlanDetail
          key={openPlan.id}
          plan={openPlan}
          cases={cases}
          releaseName={releaseName(openPlan.releaseId)}
          assignedName={userName(openPlan.assignedTo)}
          onClose={() => setOpenPlanId(null)}
        />
      )}
    </div>
  );
}

function PlanDetail({
  plan,
  cases,
  releaseName,
  assignedName,
  onClose,
}: {
  plan: TmPlan;
  cases: TmCase[];
  releaseName: string;
  assignedName: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const updatePlan = useTm((s) => s.updatePlan);
  const deletePlan = useTm((s) => s.deletePlan);
  const pushToast = useStore((s) => s.pushToast);

  const planCases = useMemo(
    () => plan.caseIds.map((id) => cases.find((c) => c.id === id)).filter((c): c is TmCase => Boolean(c)),
    [plan.caseIds, cases],
  );
  const prog = planProgress(plan, cases);

  const runPlan = () => navigate(`/tests/runs?plan=${plan.id}`);

  const remove = () => {
    if (!window.confirm(`Delete ${plan.key} — ${plan.title}? This removes the plan and its recorded executions.`)) return;
    deletePlan(plan.id);
    pushToast({ icon: "issue", title: `Deleted ${plan.key}`, subtitle: plan.title });
    onClose();
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`${plan.key} · ${plan.title}`} width={720}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={TM_PRIORITY_TONE[plan.priority]}>{TM_PRIORITY_LABEL[plan.priority]} priority</Chip>
        <span className="text-[12px] text-muted-foreground">
          {TM_PLAN_STATUS_LABEL[plan.status]} · {releaseName} · {assignedName} · by {plan.createdBy}
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="primary" onClick={runPlan}>
          <Play size={12} /> Run this plan
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={prog.pct} />
        <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">
          {prog.executed}/{prog.total} executed · {prog.pct}%
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-border">
        <div className="grid grid-cols-[88px_1fr_140px] bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <span>Case</span>
          <span>Title</span>
          <span>Last Run</span>
        </div>
        {planCases.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">This plan has no cases.</div>
        ) : (
          planCases.map((c) => (
            <div key={c.id} className="grid grid-cols-[88px_1fr_140px] items-center gap-2 border-t border-border px-3 py-2 text-[13px]">
              <span className="font-mono text-[12px] font-semibold text-ink-2">{c.key}</span>
              <span className="min-w-0 truncate text-ink-1">{c.title}</span>
              <span>
                <StatusBadge tone={TM_RUN_STATUS_TONE[c.lastRunStatus]}>{TM_RUN_STATUS_LABEL[c.lastRunStatus]}</StatusBadge>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className={LABEL + " mb-0 mr-1"}>Status</label>
        <select
          value={plan.status}
          onChange={(e) => updatePlan(plan.id, { status: e.target.value as TmPlanStatus })}
          className={INPUT + " w-auto"}
        >
          {(["active", "completed", "archived"] as const).map((st) => (
            <option key={st} value={st}>
              {TM_PLAN_STATUS_LABEL[st]}
            </option>
          ))}
        </select>
        {plan.status !== "archived" && (
          <Button size="sm" variant="outline" onClick={() => updatePlan(plan.id, { status: "archived" })}>
            <Archive size={13} /> Archive
          </Button>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="destructive" onClick={remove}>
          <Trash2 size={13} /> Delete
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <ClipboardList size={12} /> {plan.caseIds.length} cases in this plan
      </div>
    </Modal>
  );
}
