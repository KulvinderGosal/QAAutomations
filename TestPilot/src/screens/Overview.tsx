import { useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Bot, Calendar, CheckCircle2, ClipboardList, Filter, FlaskConical, GitPullRequest, Inbox, Loader2, RefreshCw, ShieldCheck, UserCheck, Zap } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useFilteredByBrand } from "@/components/ProductChip";
import { ProductChip } from "@/components/ProductChip";
import { ATTENTION_STATUSES, actionFor, reasonFor, urgencyRank } from "@/lib/taskUi";
import { OWNERSHIP_TONE, PRIORITY_TONE } from "@/lib/tone";
import { Avatar, Button, Card, CardHover, Chip, EyebrowLabel, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import type { Tone } from "@/lib/tone";
import { AsanaLogo } from "@/components/icons/AsanaLogo";
import { GithubMark } from "@/components/icons/GithubMark";
import { SlackLogo } from "@/components/icons/SlackLogo";
import { AsanaOriginBadge } from "@/components/AsanaOriginBadge";
import { SlackOriginBadge } from "@/components/SlackOriginBadge";
import { Donut, type Slice } from "@/components/charts/Donut";
import { timeAgo } from "@/lib/utils";
import type { Task } from "@/types";
import { DemoBadge } from "@/components/ui/DemoBadge";

// Validated categorical palette (dataviz skill, worst adjacent ΔE 10.3) + the
// reserved status hues. Assigned in fixed order — never cycled.
const CAT = {
  blue: "#2a78d6",
  aqua: "#1baf7a",
  yellow: "#eda100",
  green: "#008300",
  violet: "#4a3aa7",
  red: "#e34948",
  magenta: "#e87ba4",
  orange: "#eb6834",
};

function isTodayIST(iso: string): boolean {
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  return fmt(new Date(iso)) === fmt(new Date());
}

// Overview date-range filter. Scopes the "at a glance" donuts + the attention
// list by task created-date.
const RANGES = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function withinRange(iso: string, range: RangeKey): boolean {
  if (range === "all") return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return t >= Date.now() - days * 86_400_000;
}

export function Overview() {
  const navigate = useNavigate();
  const tasksAll = useStore((s) => s.tasks);
  const devs = useStore((s) => s.devs);
  const issues = useStore((s) => s.issues);
  const runTestPlan = useStore((s) => s.runTestPlan);
  const claimTask = useStore((s) => s.claimTask);
  const asanaState = useStore((s) => s.asanaState);
  const asanaUser = useStore((s) => s.asanaUser);
  const loadAsana = useStore((s) => s.loadAsana);
  const githubState = useStore((s) => s.githubState);
  const githubUser = useStore((s) => s.githubUser);
  const loadGithub = useStore((s) => s.loadGithub);
  const slackState = useStore((s) => s.slackState);
  const slackUser = useStore((s) => s.slackUser);
  const loadSlack = useStore((s) => s.loadSlack);
  const meName = useStore((s) => s.users.find((u) => u.id === s.currentUserId)?.name);
  const role = useStore((s) => s.users.find((u) => u.id === s.currentUserId)?.role);
  const firstName = (meName ?? "there").split(" ")[0];
  // QA-only sections (queue cards / connector inboxes + Run/Claim actions) are for
  // QA/admin. NB: /queue is now dev-accessible (read-only), so we can't derive this
  // from canAccess("/queue") — gate on the role directly, matching QaQueue's canRunQa.
  const canQa = role === "admin" || role === "qa";

  const [range, setRange] = useState<RangeKey>("all");
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "All time";

  const tasks = useFilteredByBrand(tasksAll);
  // Date-filtered slice: drives the donuts + the attention list.
  const rangedTasks = tasks.filter((t) => withinRange(t.createdAt, range));
  const attention = rangedTasks
    .filter((t) => ATTENTION_STATUSES.includes(t.status))
    .sort((a, b) => urgencyRank(a) - urgencyRank(b));

  const awaitingVerification = issues.filter((i) => i.state !== "closed").length;

  // KPI tiles + connector inboxes reflect the full (non-date-filtered) set.
  const cameInToday = tasks.filter((t) => isTodayIST(t.createdAt)).length;
  const pickedUpByMe = tasks.filter((t) => t.ownership === "human").length;
  const handedToAi = tasks.filter((t) => t.ownership === "ai").length;
  const unclaimed = tasks.filter((t) => t.ownership === "unclaimed").length;
  // Connector inboxes show newest first (latest task/issue on top).
  const byNewest = (a: Task, b: Task) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const asanaIncoming = tasks.filter((t) => t.origin === "asana").sort(byNewest);
  const githubIncoming = tasks.filter((t) => t.origin === "github").sort(byNewest);
  const slackIncoming = tasks.filter((t) => t.origin === "slack").sort(byNewest);

  // ── QA readiness checklist (ConsentLayer-style score card) ───────────────────
  // Real signal from the live queue: each check is a lever that either passes
  // (green) or points QA at the screen that clears it.
  const testsMissing = tasks.filter((t) => t.status === "tests-missing").length;
  const failing = tasks.filter((t) => ["failed", "reported"].includes(t.status)).length;
  const anyConnector = [asanaState, githubState, slackState].includes("connected");
  const readinessChecks: ReadinessCheck[] = [
    {
      label: "A source is connected",
      done: anyConnector,
      desc: anyConnector ? "Tasks are syncing from your connectors" : "Link Asana, GitHub, or Slack to sync tasks",
      action: "Set up",
      to: "/integrations",
    },
    {
      label: "Coverage in place",
      done: testsMissing === 0,
      desc: testsMissing === 0 ? "Every task has tests attached" : `${testsMissing} task${testsMissing === 1 ? "" : "s"} missing tests`,
      action: "Add tests",
      to: "/queue",
    },
    {
      label: "No failing builds",
      done: failing === 0,
      desc: failing === 0 ? "Nothing is failing QA right now" : `${failing} build${failing === 1 ? "" : "s"} failed QA`,
      action: "Review",
      to: "/queue",
    },
    {
      label: "Queue triaged",
      done: unclaimed === 0,
      desc: unclaimed === 0 ? "Nothing waiting to be claimed" : `${unclaimed} unclaimed task${unclaimed === 1 ? "" : "s"}`,
      action: "Triage",
      to: "/queue",
    },
    {
      label: "Bugs cleared",
      done: awaitingVerification === 0,
      desc: awaitingVerification === 0 ? "No open bugs to verify" : `${awaitingVerification} bug${awaitingVerification === 1 ? "" : "s"} awaiting verification`,
      action: "Verify",
      to: "/queue",
    },
  ];

  // ── Donut datasets (queue by stage / origin / ownership), date-scoped ────────
  const count = (pred: (t: Task) => boolean) => rangedTasks.filter(pred).length;
  const statusSlices: Slice[] = [
    { label: "New", value: count((t) => t.status === "assigned"), color: CAT.blue },
    { label: "Tests missing", value: count((t) => t.status === "tests-missing"), color: CAT.yellow },
    { label: "Ready", value: count((t) => t.status === "ready"), color: CAT.aqua },
    { label: "In progress", value: count((t) => ["running", "reported", "verifying"].includes(t.status)), color: CAT.violet },
    { label: "Failed", value: count((t) => t.status === "failed"), color: CAT.red },
    { label: "Cleared", value: count((t) => ["passed", "verified", "accepted"].includes(t.status)), color: CAT.green },
  ].filter((s) => s.value > 0);

  const originSlices: Slice[] = [
    { label: "Asana", value: count((t) => t.origin === "asana"), color: "#F06A6A" },
    { label: "GitHub", value: count((t) => t.origin === "github"), color: "#1f2328" },
    { label: "Slack", value: count((t) => t.origin === "slack"), color: "#611f69" },
    { label: "Manual", value: count((t) => t.origin === "manual"), color: "#9aa0a6" },
  ].filter((s) => s.value > 0);

  const ownershipSlices: Slice[] = [
    { label: "Unclaimed", value: count((t) => t.ownership === "unclaimed"), color: "#9aa0a6" },
    { label: "Picked up", value: count((t) => t.ownership === "human"), color: "var(--primary)" },
    { label: "AI automation", value: count((t) => t.ownership === "ai"), color: "var(--magic)" },
  ].filter((s) => s.value > 0);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const istHour = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()),
  );
  const greeting = istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      {/* Gradient hero — greeting + the day's headline numbers + KPI tiles */}
      <div className="mb-5 overflow-hidden rounded-card border border-border bg-gradient-to-br from-hero-1 via-hero-2 to-hero-3">
        <div className="flex items-end justify-between gap-4 px-5 pt-5">
          <div>
            <h1 className="m-0 text-[25px] font-bold tracking-tight text-ink-1">
              {greeting}, {firstName}
            </h1>
            <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
              <b className="font-semibold text-ink-1">{attention.length}</b> task
              {attention.length === 1 ? "" : "s"} need your attention ·{" "}
              <b className="font-semibold text-ink-1">{awaitingVerification}</b> issue
              {awaitingVerification === 1 ? "" : "s"} awaiting verification
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-control border border-border bg-card/70 px-2.5 py-1.5 text-[12.5px] text-muted-foreground backdrop-blur">
              <Filter size={14} />
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as RangeKey)}
                className="cursor-pointer border-none bg-transparent pr-1 text-[12.5px] font-medium text-ink-2 outline-none"
                title="Filter the at-a-glance breakdown and attention list by date"
              >
                {RANGES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2 rounded-control border border-border bg-card/70 px-3 py-1.5 text-[12.5px] text-muted-foreground backdrop-blur">
              <Calendar size={15} />
              <span className="font-medium text-ink-2">{today}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3 px-5 pb-5">
          <TriageStat
            icon={Inbox}
            label="Came in today"
            value={cameInToday}
            tone="var(--info)"
            hint={cameInToday > 0 ? "Fresh in the queue" : "Nothing new yet"}
          />
          <TriageStat
            icon={UserCheck}
            label="Picked up"
            value={pickedUpByMe}
            tone="var(--primary)"
            hint={pickedUpByMe > 0 ? "Being worked on" : "None claimed yet"}
          />
          <TriageStat
            icon={Bot}
            label="Handed to AI"
            value={handedToAi}
            tone="var(--magic)"
            hint={handedToAi > 0 ? "Automated QA running" : "None handed off"}
          />
          <TriageStat
            icon={Inbox}
            label="Unclaimed"
            value={unclaimed}
            tone={unclaimed > 0 ? "var(--warning)" : "var(--muted-foreground)"}
            hint={unclaimed > 0 ? "Needs triage" : "All triaged"}
            hintTone={unclaimed > 0 ? "var(--warning)" : "var(--success)"}
          />
        </div>
      </div>

      {/* QA readiness — score + checklist, ported from ConsentLayer's compliance card */}
      {canQa && <QaReadinessCard checks={readinessChecks} />}

      {/* QA at a glance — composition donuts */}
      <Card className="mb-5 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Zap size={15} className="text-primary" />
          <h2 className="m-0 text-[13.5px] font-semibold">QA at a glance</h2>
          <span className="text-[11.5px] text-muted-foreground">
            {rangedTasks.length} task{rangedTasks.length === 1 ? "" : "s"}
            {range === "all" ? " in the queue" : ` · ${rangeLabel}`}
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          <DonutPanel title="By stage" slices={statusSlices} unit="tasks" />
          <DonutPanel title="By source" slices={originSlices} unit="tasks" />
          <DonutPanel title="By ownership" slices={ownershipSlices} unit="tasks" />
        </div>
      </Card>

      {canQa && (asanaIncoming.length > 0 || asanaState === "connected" || asanaState === "error") && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <AsanaLogo size={14} />
            <h2 className="m-0 text-[13.5px] font-semibold">From Asana</h2>
            <span className="text-[11.5px] text-muted-foreground">
              {asanaState === "connected"
                ? `${asanaIncoming.length} task${asanaIncoming.length === 1 ? "" : "s"} assigned to you${asanaUser ? ` · ${asanaUser}` : ""}`
                : asanaState === "error"
                  ? "Couldn't reach Asana — showing sample data"
                  : asanaState === "no_token"
                    ? "Sample data — add ASANA_ACCESS_TOKEN to .env to load your real tasks"
                    : `${asanaIncoming.length} task${asanaIncoming.length === 1 ? "" : "s"} created & assigned in Asana, landed here for QA`}
            </span>
            <button
              onClick={() => void loadAsana()}
              disabled={asanaState === "loading"}
              className="ml-auto flex items-center gap-1.5 rounded-control border border-border px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-surface-1 disabled:opacity-50"
              title="Fetch tasks assigned to you in Asana"
            >
              {asanaState === "loading" ? <Loader2 size={12} className="cp-spin" /> : <RefreshCw size={12} />}
              {asanaState === "connected" ? "Refresh" : "Connect"}
            </button>
          </div>
          <div className="flex flex-col">
            {asanaIncoming.slice(0, 4).map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/queue/${t.id}`)}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-1"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-1">{t.title}</span>
                <ProductChip productId={t.productId} />
                <span className="hidden text-[11px] text-muted-foreground sm:inline">{t.asana?.project}</span>
              </button>
            ))}
            {asanaState === "connected" && asanaIncoming.length === 0 && (
              <div className="px-4 py-3 text-[12.5px] text-muted-foreground">
                No open Asana tasks assigned to you right now.
              </div>
            )}
          </div>
        </Card>
      )}

      {canQa && (githubIncoming.length > 0 || githubState === "connected" || githubState === "error" || githubState === "no_token") && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <GithubMark size={14} />
            <h2 className="m-0 text-[13.5px] font-semibold">From GitHub</h2>
            <span className="text-[11.5px] text-muted-foreground">
              {githubState === "connected"
                ? `${githubIncoming.length} issue${githubIncoming.length === 1 ? "" : "s"} you filed or own${githubUser ? ` · ${githubUser}` : ""}`
                : githubState === "error"
                  ? "Couldn't reach GitHub — check GITHUB_TOKEN in .env"
                  : githubState === "no_token"
                    ? "Add GITHUB_TOKEN (+ optional GITHUB_REPO) to .env to load your issues"
                    : `${githubIncoming.length} GitHub issue${githubIncoming.length === 1 ? "" : "s"} landed here for QA`}
            </span>
            <button
              onClick={() => void loadGithub()}
              disabled={githubState === "loading"}
              className="ml-auto flex items-center gap-1.5 rounded-control border border-border px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-surface-1 disabled:opacity-50"
              title="Fetch open issues you created or are assigned on GitHub"
            >
              {githubState === "loading" ? <Loader2 size={12} className="cp-spin" /> : <RefreshCw size={12} />}
              {githubState === "connected" ? "Refresh" : "Connect"}
            </button>
          </div>
          <div className="flex flex-col">
            {githubIncoming.slice(0, 6).map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/queue/${t.id}`)}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-1"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-1">{t.title}</span>
                <ProductChip productId={t.productId} />
                <span className="hidden text-[11px] text-muted-foreground sm:inline">
                  {t.github ? `${t.github.repo}#${t.github.number}` : ""}
                </span>
              </button>
            ))}
            {githubIncoming.length === 0 && (
              <div className="px-4 py-3 text-[12.5px] text-muted-foreground">
                {githubState === "connected"
                  ? "No open GitHub issues for you right now."
                  : "No GitHub issues to show yet — connect GitHub to load yours."}
              </div>
            )}
          </div>
        </Card>
      )}

      {canQa && (slackIncoming.length > 0 || slackState === "connected" || slackState === "error") && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <SlackLogo size={14} />
            <h2 className="m-0 text-[13.5px] font-semibold">From Slack</h2>
            <span className="text-[11.5px] text-muted-foreground">
              {slackState === "connected"
                ? `${slackIncoming.length} QA request${slackIncoming.length === 1 ? "" : "s"} in the channel${slackUser ? ` · ${slackUser}` : ""}`
                : slackState === "error"
                  ? "Couldn't reach Slack — showing sample data"
                  : slackState === "no_token"
                    ? "Sample data — add SLACK_BOT_TOKEN to .env to watch your QA channel"
                    : `${slackIncoming.length} build${slackIncoming.length === 1 ? "" : "s"} devs handed to QA in Slack`}
            </span>
            <button
              onClick={() => void loadSlack()}
              disabled={slackState === "loading"}
              className="ml-auto flex items-center gap-1.5 rounded-control border border-border px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-surface-1 disabled:opacity-50"
              title="Fetch QA hand-offs from your Slack channel"
            >
              {slackState === "loading" ? <Loader2 size={12} className="cp-spin" /> : <RefreshCw size={12} />}
              {slackState === "connected" ? "Refresh" : "Connect"}
            </button>
          </div>
          <div className="flex flex-col">
            {slackIncoming.slice(0, 4).map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/queue/${t.id}`)}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-1"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-1">{t.title}</span>
                <ProductChip productId={t.productId} />
                <span className="hidden text-[11px] text-muted-foreground sm:inline">{t.slack?.channel}</span>
              </button>
            ))}
            {slackState === "connected" && slackIncoming.length === 0 && (
              <div className="px-4 py-3 text-[12.5px] text-muted-foreground">
                No open Slack QA requests right now.
              </div>
            )}
          </div>
        </Card>
      )}

      {canQa ? (
        <>
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Zap size={18} className="text-warning" />
              <h2 className="m-0 text-[16px] font-semibold">Needs your attention</h2>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-bold text-muted-foreground">
                {attention.length}
              </span>
            </div>
            <Button variant="link" onClick={() => navigate("/queue")}>
              Full queue <ArrowRight size={14} />
            </Button>
          </div>

          {attention.length === 0 ? (
            <Card className="p-10 text-center text-[13.5px] text-muted-foreground">Nothing needs attention right now.</Card>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              {attention.map((t) => (
                <AttentionCard
                  key={t.id}
                  task={t}
                  devName={devs.find((d) => d.id === t.devId)?.name ?? ""}
                  onRun={() => runTestPlan(t.id)}
                  onClaim={(ownership) => claimTask(t.id, ownership)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        // Developer view — no QA-queue actions; point at their own work.
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <ClipboardList size={24} className="text-primary" />
          <div className="text-[14px] font-semibold text-ink-1">Your work</div>
          <p className="m-0 max-w-[420px] text-[13px] text-muted-foreground">
            See the issues and tasks assigned to you, and the bugs filed against your work.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => navigate("/queue")}>
              Assigned to me <ArrowRight size={14} />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function DonutPanel({ title, slices, unit }: { title: string; slices: Slice[]; unit: string }) {
  return (
    <div className="px-4 py-4">
      <EyebrowLabel className="mb-3">{title}</EyebrowLabel>
      {slices.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center text-[12px] text-muted-foreground">No data yet</div>
      ) : (
        <Donut slices={slices} unit={unit} orientation="col" size={120} thickness={15} />
      )}
    </div>
  );
}

function TriageStat({
  icon: Icon,
  label,
  value,
  tone,
  hint,
  hintTone,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  tone: string;
  hint?: string;
  hintTone?: string;
}) {
  return (
    <div className="rounded-card border border-[oklch(0.92_0.01_265)] bg-card/80 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur">
      <div className="flex items-center justify-between">
        <EyebrowLabel>{label}</EyebrowLabel>
        <span style={{ color: tone }}>
          <Icon size={15} />
        </span>
      </div>
      <div
        className="mt-2 text-[28px] font-bold leading-none tracking-tight text-ink-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1.5 text-[11.5px] font-medium" style={{ color: hintTone ?? "var(--muted-foreground)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

type ReadinessCheck = { label: string; done: boolean; desc: string; action: string; to: string };

// Score-and-checklist card modelled on ConsentLayer's "Compliance score" card:
// a large /100 score + status pill + progress bar on the left, a live checklist
// with action links on the right.
function QaReadinessCard({ checks }: { checks: ReadinessCheck[] }) {
  const navigate = useNavigate();
  const passed = checks.filter((c) => c.done).length;
  const score = Math.round((passed / checks.length) * 100);
  const status: Tone =
    score >= 90
      ? { label: "All clear", color: "var(--success)", surface: "var(--success-surface)" }
      : score >= 60
        ? { label: "Getting there", color: "var(--caution)", surface: "var(--caution-surface)" }
        : { label: "Needs work", color: "var(--warning)", surface: "var(--warning-surface)" };

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-primary" />
          <h2 className="m-0 text-[13.5px] font-semibold">QA readiness</h2>
        </div>
        <StatusBadge tone={status}>{status.label}</StatusBadge>
      </div>
      <div className="grid grid-cols-[minmax(0,240px)_1fr] max-md:grid-cols-1">
        <div className="flex flex-col justify-center gap-3 border-r border-border px-5 py-5 max-md:border-b max-md:border-r-0">
          <div className="flex items-end gap-1.5">
            <span
              className="text-[46px] font-bold leading-none tracking-tight text-ink-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {score}
            </span>
            <span className="mb-1 text-[15px] font-semibold text-muted-foreground">/ 100</span>
          </div>
          <ProgressBar value={score} tone={status.color} />
          <div className="text-[11.5px] text-muted-foreground">
            {passed} of {checks.length} checks passing
          </div>
        </div>
        <div className="flex flex-col">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
              {c.done ? (
                <CheckCircle2 size={16} className="shrink-0 text-success" />
              ) : (
                <AlertCircle size={16} className="shrink-0 text-warning" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink-1">{c.label}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{c.desc}</div>
              </div>
              {!c.done && (
                <button
                  onClick={() => navigate(c.to)}
                  className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                >
                  {c.action} <ArrowRight size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function AttentionCard({
  task,
  devName,
  onRun,
  onClaim,
}: {
  task: Task;
  devName: string;
  onRun: () => void;
  onClaim: (ownership: "human" | "ai") => void;
}) {
  const navigate = useNavigate();
  const reason = reasonFor(task);
  const action = actionFor(task);
  const priorityTone = PRIORITY_TONE[task.priority];
  const ownershipTone = OWNERSHIP_TONE[task.ownership];
  const testLabel = task.tests.length ? `${task.tests.length} tests` : "No tests";

  const handleAction = (e: MouseEvent) => {
    e.stopPropagation();
    if (action.kind === "run" || action.kind === "verify") onRun();
    navigate(`/queue/${task.id}`);
  };

  const handleClaim = (e: MouseEvent, ownership: "human" | "ai") => {
    e.stopPropagation();
    onClaim(ownership);
  };

  return (
    <CardHover onClick={() => navigate(`/queue/${task.id}`)} className="overflow-hidden">
      <div className="h-[3px] w-full" style={{ background: reason.tone.color }} />
      <div className="flex flex-col gap-2.5 px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2.5">
          <Chip tone={reason.tone}>{reason.label}</Chip>
          <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">{timeAgo(task.createdAt)}</span>
        </div>
        <div className="text-[15.5px] font-semibold leading-[1.3] text-ink-1">{task.title}</div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ProductChip productId={task.productId} />
          <span className="h-[3px] w-[3px] rounded-full bg-[oklch(0.78_0_0)]" />
          <span className="text-[12px] font-medium" style={{ color: priorityTone.color }}>
            {task.priority} priority
          </span>
          <span className="h-[3px] w-[3px] rounded-full bg-[oklch(0.78_0_0)]" />
          <Chip tone={ownershipTone}>{ownershipTone.label}</Chip>
          {task.origin === "asana" && <AsanaOriginBadge />}
          {task.origin === "slack" && <SlackOriginBadge />}
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border">
        <Field label="Pull request" value={`#${task.pr}`} mono border />
        <Field label="Environment" value={task.environment} />
        <Field label="Branch" value={task.branch} mono border truncate />
        <Field label="Coverage" value={testLabel} />
      </div>
      {task.ownership === "unclaimed" && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
          <span className="text-[11.5px] text-muted-foreground">Who's taking this?</span>
          <Button size="sm" variant="outline" onClick={(e) => handleClaim(e, "human")}>
            <UserCheck size={12} /> Take it
          </Button>
          <Button size="sm" variant="outline" onClick={(e) => handleClaim(e, "ai")}>
            <Bot size={12} /> Hand to AI
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2.5 border-t border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={devName} size={26} />
          <div className="min-w-0">
            <EyebrowLabel>Assigned by</EyebrowLabel>
            <div className="truncate text-[12.5px] font-semibold text-ink-1">{devName}</div>
          </div>
        </div>
        <Button
          size="sm"
          variant={action.kind === "report" ? "destructive" : action.kind === "none" ? "ghost" : "primary"}
          disabled={action.kind === "none"}
          onClick={handleAction}
        >
          {action.kind === "run" && <FlaskConical size={13} />}
          {action.kind === "view" && task.run.running && <Loader2 size={13} className="cp-spin" />}
          {action.kind === "report" && <GitPullRequest size={13} />}
          {action.label}
          {(action.kind === "run" || action.kind === "verify") && <DemoBadge />}
        </Button>
      </div>
    </CardHover>
  );
}

function Field({ label, value, mono, border, truncate }: { label: string; value: string; mono?: boolean; border?: boolean; truncate?: boolean }) {
  return (
    <div className={`px-4 py-2.5 ${border ? "border-r border-border" : ""} border-b border-border min-w-0`}>
      <EyebrowLabel className="mb-1">{label}</EyebrowLabel>
      <div className={`text-[12.5px] font-medium text-ink-1 ${mono ? "font-mono" : ""} ${truncate ? "truncate" : ""}`}>{value}</div>
    </div>
  );
}
