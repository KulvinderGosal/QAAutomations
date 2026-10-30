import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bot, Bug, Check, ExternalLink, FlaskConical, GitPullRequest, Layers, Loader2, MessageSquare, ShieldCheck, SlidersHorizontal, UserCheck, X } from "lucide-react";
import { useStore, type InboxFilter } from "@/store/useStore";
import { useFilteredByBrand, ProductChip } from "@/components/ProductChip";
import { actionFor, reasonFor } from "@/lib/taskUi";
import { OWNERSHIP_TONE, TASK_STATUS_TONE } from "@/lib/tone";
import { Avatar, Button, Card, CardHover, Chip, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { AsanaOriginBadge } from "@/components/AsanaOriginBadge";
import { GithubOriginBadge } from "@/components/GithubOriginBadge";
import { SlackOriginBadge } from "@/components/SlackOriginBadge";
import { timeAgo } from "@/lib/utils";
import type { Ownership, Task } from "@/types";
import { DemoBadge } from "@/components/ui/DemoBadge";

const OWNERSHIP_FILTERS: { value: Ownership | "all"; label: string }[] = [
  { value: "all", label: "Anyone" },
  { value: "unclaimed", label: "Unclaimed" },
  { value: "human", label: "Picked up by me" },
  { value: "ai", label: "Handed to AI" },
];

const SCOPE_FILTERS: { value: "anyone" | "mine"; label: string }[] = [
  { value: "anyone", label: "Anyone" },
  { value: "mine", label: "Assigned to me" },
];

// Colored stage dot per filter (matches the status tones) — scannability on the
// pill row, like the prototype's colored filter dots.
const STAGE_DOT: Record<InboxFilter, string> = {
  all: "var(--muted-foreground)",
  new: "var(--info)",
  "tests-missing": "var(--warning)",
  ready: "var(--info)",
  "needs-report": "var(--destructive)",
  verifying: "var(--caution)",
  cleared: "var(--success)",
};

const OWN_DOT: Record<string, string> = {
  all: "var(--muted-foreground)",
  unclaimed: "var(--muted-foreground)",
  human: "var(--primary)",
  ai: "var(--magic)",
};

const FILTERS: { value: InboxFilter; label: string; match: (t: Task) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "new", label: "New", match: (t) => t.status === "assigned" },
  { value: "tests-missing", label: "Tests missing", match: (t) => t.status === "tests-missing" },
  { value: "ready", label: "Ready", match: (t) => t.status === "ready" },
  { value: "needs-report", label: "Needs report", match: (t) => t.status === "failed" },
  { value: "verifying", label: "Verifying", match: (t) => t.status === "reported" || t.status === "verifying" },
  { value: "cleared", label: "Cleared", match: (t) => ["passed", "verified", "accepted"].includes(t.status) },
];

// GitHub-issue action cluster: "Test issue" (runs the product smoke — no
// writes) + "Verify fix" (unlocks once the dev has commented a fix; on a pass it
// posts "verified & validated" and closes the issue — real GitHub writes, so the
// click is confirm-gated by the parent).
function GithubVerifyControls({
  task,
  runBusy,
  onTest,
  onVerify,
}: {
  task: Task;
  runBusy: boolean;
  onTest: () => void;
  onVerify: () => void;
}) {
  const fv = task.fixVerification;
  const closed = fv?.state === "closed" || task.github?.state === "closed";
  const running = fv?.state === "running";
  const devReplied = !!task.devResponded;

  if (closed) {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-control bg-success-surface px-2.5 py-1.5 text-[12px] font-semibold text-success">
        <Check size={13} /> Verified &amp; closed
      </span>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {fv?.state === "blocked" && (
        // V1: the last verify run had no honest PASS (blocked / gaps / 0 executed),
        // so nothing was written to GitHub. Hover for the blocker + human action.
        <span
          className="max-w-[220px] truncate rounded-control bg-emphasis-surface px-2 py-1 text-[11.5px] font-semibold text-emphasis"
          title={fv.note}
        >
          Inconclusive{fv.note ? ` · ${fv.note}` : ""}
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={runBusy}
        title="Run the product smoke to reproduce/observe this issue (no GitHub writes)"
        onClick={(e) => {
          e.stopPropagation();
          onTest();
        }}
      >
        <Bug size={12} /> Test issue
      </Button>
      <Button
        size="sm"
        variant="primary"
        disabled={!devReplied || running || runBusy}
        title={
          !devReplied
            ? "Awaiting a dev fix — enables once the dev comments on the issue"
            : "Verify the fix: runs smoke, then comments & closes the issue on GitHub (real write)"
        }
        onClick={(e) => {
          e.stopPropagation();
          onVerify();
        }}
      >
        {running ? <Loader2 size={13} className="cp-spin" /> : <ShieldCheck size={12} />}
        {running ? "Verifying…" : "Verify fix"}
      </Button>
    </div>
  );
}

export function QaQueue() {
  const navigate = useNavigate();
  const tasksAll = useStore((s) => s.tasks);
  const devs = useStore((s) => s.devs);
  const query = useStore((s) => s.query);
  const inboxFilter = useStore((s) => s.inboxFilter);
  const setInboxFilter = useStore((s) => s.setInboxFilter);
  const selected = useStore((s) => s.selected);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const clearSelect = useStore((s) => s.clearSelect);
  const bulkRun = useStore((s) => s.bulkRun);
  const runTestPlan = useStore((s) => s.runTestPlan);
  const claimTask = useStore((s) => s.claimTask);
  const testGithubIssue = useStore((s) => s.testGithubIssue);
  const verifyGithubFix = useStore((s) => s.verifyGithubFix);
  const runnerRun = useStore((s) => s.runnerRun);
  const aiUnfunded = useStore((s) => s.aiUnfunded);
  const githubLogin = useStore((s) => s.githubLogin);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const [ownershipFilter, setOwnershipFilter] = useState<Ownership | "all">("all");
  const [groupByDev, setGroupByDev] = useState(false);
  const [scope, setScope] = useState<"anyone" | "mine">("anyone");
  // The GitHub issue queued for "Verify fix" — its confirm dialog gates the real
  // GitHub comment + close writes.
  const [verifyTask, setVerifyTask] = useState<Task | null>(null);

  const runBusy = runnerRun?.status === "running";

  // Role decides what this screen is: QA/admin get the full actionable queue
  // (claim, run, verify); a dev gets a read-only view locked to items assigned
  // to them — the old "Assigned to me" screen, folded in here.
  const me = users.find((u) => u.id === currentUserId);
  const canRunQa = me?.role === "admin" || me?.role === "qa";
  const effectiveScope: "anyone" | "mine" = canRunQa ? scope : "mine";

  const brandTasks = useFilteredByBrand(tasksAll);

  // "Assigned to me": Asana tasks + Slack hand-offs qualify by connector design;
  // GitHub issues only when assigned to you and opened by someone else.
  const scoped = useMemo(() => {
    if (effectiveScope !== "mine") return brandTasks;
    const meLogin = githubLogin?.toLowerCase();
    return brandTasks.filter((t) => {
      if (t.origin === "asana" || t.origin === "slack") return true;
      if (t.origin === "github") {
        const a = t.github?.assignee?.toLowerCase();
        const c = t.github?.creator?.toLowerCase();
        return !!a && !!meLogin && a === meLogin && !!c && c !== meLogin;
      }
      return false;
    });
  }, [brandTasks, effectiveScope, githubLogin]);

  const searched = useMemo(() => {
    if (!query.trim()) return scoped;
    const q = query.toLowerCase();
    return scoped.filter(
      (t) => t.title.toLowerCase().includes(q) || t.branch.toLowerCase().includes(q) || String(t.pr).includes(q),
    );
  }, [scoped, query]);

  // Chip counts come from the SAME base the list uses (search + ownership applied),
  // minus the stage match — so each badge equals what selecting it would show.
  const base = searched.filter((t) => ownershipFilter === "all" || t.ownership === ownershipFilter);
  const counts = FILTERS.map((f) => ({ ...f, count: base.filter(f.match).length }));
  const activeMatch = FILTERS.find((f) => f.value === inboxFilter)?.match ?? (() => true);
  const list = base.filter(activeMatch);

  // Clear bulk selection whenever the visible set changes, so "N selected" and
  // "Run selected" never act on rows that are no longer shown.
  useEffect(() => {
    clearSelect();
  }, [effectiveScope, ownershipFilter, query, inboxFilter, clearSelect]);

  // Group the (filtered) list by the dev who created/assigned each task in Asana.
  const devGroups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of list) {
      const key = t.devId || "__unassigned";
      const arr = m.get(key);
      if (arr) arr.push(t);
      else m.set(key, [t]);
    }
    return [...m.entries()]
      .map(([key, tasks]) => ({ key, tasks, dev: devs.find((d) => d.id === key) ?? null }))
      .sort((a, b) => b.tasks.length - a.tasks.length || (a.dev?.name ?? "~").localeCompare(b.dev?.name ?? "~"));
  }, [list, devs]);

  const renderRow = (t: Task) => {
    const reason = reasonFor(t);
    const action = actionFor(t);
    const dev = devs.find((d) => d.id === t.devId);
    const extUrl = t.origin === "github" ? t.github?.url : t.origin === "asana" ? t.asana?.url : t.slack?.permalink;
    return (
      <CardHover key={t.id} onClick={() => navigate(`/queue/${t.id}`)} className="flex items-center gap-3.5 px-4 py-3.5">
        {canRunQa && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(t.id);
            }}
            className={`flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border ${
              selected.has(t.id) ? "border-primary bg-primary" : "border-[oklch(0.8_0_0)] bg-card"
            }`}
          >
            {selected.has(t.id) && <Check size={12} className="text-white" />}
          </button>
        )}
        <Avatar name={dev?.name ?? ""} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[14.5px] font-semibold text-ink-1">{t.title}</span>
            {t.status === "assigned" && (
              <span className="rounded-[5px] bg-info-surface px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-info">
                New
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <ProductChip productId={t.productId} />
            {t.origin === "asana" && <AsanaOriginBadge />}
            {t.origin === "github" && <GithubOriginBadge link={t.github} />}
            {t.origin === "slack" && <SlackOriginBadge />}
            {t.pr > 0 && (
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <GitPullRequest size={13} /> #{t.pr}
              </span>
            )}
            <span className="text-[12px] text-muted-foreground">
              {dev?.name ?? "—"} · {timeAgo(t.createdAt)}
            </span>
            {t.tests.length === 0 ? (
              <span className="flex items-center gap-1 text-[12px] font-medium text-warning">
                <AlertTriangle size={13} /> No tests authored
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <FlaskConical size={13} /> {t.tests.length} tests
              </span>
            )}
            {t.origin === "github" && t.github?.devComment && (
              <span
                className="flex items-center gap-1 text-[12px] font-medium text-success"
                title={`${t.github.devComment.login}: ${t.github.devComment.body}`}
              >
                <MessageSquare size={13} /> {t.github.devComment.login} replied · {timeAgo(t.github.devComment.at)}
              </span>
            )}
          </div>
        </div>
        {canRunQa ? (
          <>
            {t.ownership === "unclaimed" ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    claimTask(t.id, "human");
                  }}
                >
                  <UserCheck size={12} /> Take it
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={aiUnfunded}
                  title={
                    aiUnfunded
                      ? "AI authoring needs Anthropic credits — fund the account or set a funded key in .env"
                      : "Hand this task to AI to author its QA plan"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    claimTask(t.id, "ai");
                  }}
                >
                  <Bot size={12} /> Hand to AI
                </Button>
              </div>
            ) : (
              <Chip tone={OWNERSHIP_TONE[t.ownership]}>{OWNERSHIP_TONE[t.ownership].label}</Chip>
            )}
            <StatusBadge tone={reason.tone}>{TASK_STATUS_TONE[t.status].label}</StatusBadge>
            {t.origin === "github" ? (
              <GithubVerifyControls
                task={t}
                runBusy={runBusy}
                onTest={() => testGithubIssue(t.id)}
                onVerify={() => setVerifyTask(t)}
              />
            ) : (
              <Button
                size="sm"
                variant={action.kind === "report" ? "destructive" : action.kind === "none" ? "ghost" : "primary"}
                disabled={action.kind === "none"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (action.kind === "run" || action.kind === "verify") runTestPlan(t.id, action.kind === "verify" ? "verify" : "run");
                  else navigate(`/queue/${t.id}`);
                }}
              >
                {action.kind === "view" && t.run.running && <Loader2 size={13} className="cp-spin" />}
                {action.label}
                {(action.kind === "run" || action.kind === "verify") && <DemoBadge />}
              </Button>
            )}
          </>
        ) : (
          <>
            <StatusBadge tone={reason.tone}>{TASK_STATUS_TONE[t.status].label}</StatusBadge>
            {extUrl && (
              <a
                href={extUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border text-muted-foreground hover:bg-surface-2"
                title="Open at source"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </>
        )}
      </CardHover>
    );
  };

  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-bold tracking-tight">QA Queue</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            {canRunQa
              ? "Every task developers assigned QA — filter by stage, ownership, or who assigned it."
              : "Tasks and issues developers have assigned to you for QA."}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {counts.map((f) => (
          <button
            key={f.value}
            onClick={() => setInboxFilter(f.value)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-control border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              inboxFilter === f.value
                ? "border-transparent bg-primary text-white"
                : "border-border bg-card text-ink-2 hover:bg-surface-2"
            }`}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: inboxFilter === f.value ? "currentColor" : STAGE_DOT[f.value] }}
            />
            {f.label}
            {f.count > 0 && (
              <span
                className={`rounded-full px-1.5 text-[10.5px] font-bold ${
                  inboxFilter === f.value ? "bg-card/25 text-white" : "bg-surface-3 text-ink-2"
                }`}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {canRunQa && (
          <FilterMenu
            label="Filter"
            icon={<SlidersHorizontal size={13} />}
            activeCount={(scope !== "anyone" ? 1 : 0) + (ownershipFilter !== "all" ? 1 : 0)}
            groups={[
              {
                key: "scope",
                label: "Show",
                type: "radio",
                value: scope,
                onChange: (v) => setScope(v as "anyone" | "mine"),
                options: SCOPE_FILTERS.map((f) => ({ value: f.value, label: f.label })),
              },
              {
                key: "ownership",
                label: "Ownership",
                type: "radio",
                value: ownershipFilter,
                onChange: (v) => setOwnershipFilter(v as Ownership | "all"),
                options: OWNERSHIP_FILTERS.map((f) => ({ value: f.value, label: f.label, dot: OWN_DOT[f.value] })),
              },
            ]}
          />
        )}
        <span className="flex-1" />
        <FilterMenu
          label="Group by"
          icon={<Layers size={13} />}
          align="end"
          activeCount={groupByDev ? 1 : 0}
          groups={[
            {
              key: "groupby",
              type: "radio",
              value: groupByDev ? "dev" : "none",
              onChange: (v) => setGroupByDev(v === "dev"),
              options: [
                { value: "none", label: "None" },
                { value: "dev", label: "By developer" },
              ],
            },
          ]}
        />
      </div>

      {canRunQa && selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-[11px] bg-primary/5 px-3.5 py-2.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_30%,transparent)]">
          <span className="text-[13px] font-semibold text-primary">{selected.size} selected</span>
          <span className="flex-1" />
          <Button variant="primary" size="sm" onClick={bulkRun}>
            <FlaskConical size={14} /> Run selected
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelect}>
            <X size={14} /> Clear
          </Button>
        </div>
      )}

      {list.length === 0 ? (
        <Card className="p-10 text-center text-[13.5px] text-muted-foreground">No tasks match your filters.</Card>
      ) : groupByDev ? (
        <div className="flex flex-col gap-5">
          {devGroups.map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-2.5">
                <Avatar name={g.dev?.name ?? ""} size={24} />
                <span className="text-[13.5px] font-semibold text-ink-1">{g.dev?.name ?? "Unassigned"}</span>
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-ink-2">
                  {g.tasks.length}
                </span>
                {g.dev?.role && <span className="text-[11.5px] text-muted-foreground">{g.dev.role}</span>}
              </div>
              <div className="flex flex-col gap-2.5">{g.tasks.map(renderRow)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">{list.map(renderRow)}</div>
      )}

      <ConfirmDialog
        open={!!verifyTask}
        onOpenChange={(o) => !o && setVerifyTask(null)}
        title="Verify fix & close issue"
        destructive
        confirmLabel="Run smoke & verify"
        message={
          verifyTask?.github ? (
            <>
              This runs the <b>{verifyTask.github.repo.split("/")[1]}</b> product smoke against issue{" "}
              <b>#{verifyTask.github.number}</b>. If it <b>passes</b>, TestPilot will post a
              “verified &amp; validated” comment and <b>close the issue on real GitHub</b>. If it fails, the
              issue is left open. This is a real write to <b>{verifyTask.github.repo}</b>.
            </>
          ) : (
            ""
          )
        }
        onConfirm={() => {
          if (verifyTask) void verifyGithubFix(verifyTask.id);
          setVerifyTask(null);
        }}
      />
    </div>
  );
}
