import { create } from "zustand";
import {
  devs,
  issues as initialIssues,
  notifications as initialNotifications,
  products,
  repos as initialRepos,
  tasks as initialTasks,
} from "@/data/mock";
import type {
  ActivityEvent,
  AppNotification,
  AppUser,
  AsanaComment,
  BrandFilter,
  GeneratedSpec,
  Issue,
  Phase,
  PrReport,
  Product,
  QaAuthoring,
  QaPipeline,
  QaStage,
  QaStageKey,
  QaStageStatus,
  Task,
  TaskOrigin,
  TaskStatus,
  TestArea,
  TestArtifacts,
  TestCase,
  TestScenario,
  Toast,
} from "@/types";
import { PHASE_ORDER, QA_STAGE_ORDER } from "@/types";
import { fetchAiStatus } from "@/lib/ai";
import {
  aiCases,
  aiExportRecord,
  aiPlanTask,
  aiScenarios,
  defaultFrameworkFor,
  type PlanInput,
} from "@/lib/qaPlanner";
import { applyTheme, initialTheme, saveTheme, type Theme } from "@/lib/theme";
import { readSession, readUsers, writeSession, writeUsers } from "@/lib/users";
import { fetchAsanaTasks, asanaToTask, completeAsanaTask } from "@/lib/asana";
import { readQaLog, writeQaLog, type QaLogEntry } from "@/lib/qaLog";
import { fetchGithubIssues, githubIssueToTask, commentOnRepoIssue, closeRepoIssue } from "@/lib/github";
import { fetchSlackMessages, slackMessageToTask } from "@/lib/slack";
import {
  cancelRunnerRun,
  fetchFrameworks,
  fetchRun,
  fetchSpecs,
  readSavedTests,
  startAdhocRun,
  startRunnerRun,
  writeSavedTests,
  isHonestPass,
  verdictNote,
  type AdhocBody,
  type RunnerFramework,
  type RunnerRun,
  type RunnerSpec,
  type SavedTest,
  type StartRunBody,
} from "@/lib/runner";

export type AsanaConnState = "unknown" | "loading" | "connected" | "no_token" | "error";

export type InboxFilter =
  | "all"
  | "new"
  | "tests-missing"
  | "ready"
  | "needs-report"
  | "verifying"
  | "cleared";

type State = {
  brand: BrandFilter;
  theme: Theme;
  toggleTheme: () => void;

  // ── Simulated auth / team ───────────────────────────────────────────────────
  users: AppUser[];
  currentUserId: string | null;
  signIn: (userId: string) => void;
  signOut: () => void;
  addUser: (u: Omit<AppUser, "id">) => void;
  updateUser: (id: string, patch: Partial<Omit<AppUser, "id">>) => void;
  removeUser: (id: string) => void;

  query: string;
  inboxFilter: InboxFilter;
  selected: Set<string>;
  notifOpen: boolean;
  toasts: Toast[];
  expandedTests: Record<string, boolean>;
  merged: Record<string, boolean>;
  deployed: Record<string, boolean>;

  asanaState: AsanaConnState;
  asanaUser: string | null;
  asanaError: string | null;

  githubState: AsanaConnState;
  githubUser: string | null;
  githubLogin: string | null; // the viewer's GitHub login (for "assigned to me")
  githubError: string | null;

  slackState: AsanaConnState;
  slackUser: string | null; // Slack team name
  slackError: string | null;

  tasks: Task[];
  issues: Issue[];
  notifications: AppNotification[];
  repos: typeof initialRepos;
  products: typeof products;
  devs: typeof devs;
  issueDrafts: Record<string, { title: string; body: string; repoId: string }>;

  editorTaskId: string | null;
  artifactModal: { testId: string; kind: "screenshot" | "trace" | "video" | "diff" } | null;

  // ── Local Playwright runner ────────────────────────────────────────────────
  runnerFrameworks: RunnerFramework[] | null;
  runnerAdhocReady: { ready: boolean; problem: string | null } | null;
  runnerError: string | null;
  runnerSpecs: Record<string, RunnerSpec[]>;
  runnerSpecsLoading: string | null;
  runnerRun: RunnerRun | null;
  runnerOutput: string;

  savedTests: SavedTest[];

  loadRunnerFrameworks: () => Promise<void>;
  loadRunnerSpecs: (frameworkId: string, refresh?: boolean) => Promise<void>;
  startPlaywrightRun: (body: StartRunBody) => Promise<void>;
  /** Attach the live RunPanel to an already-started run (e.g. a pipeline stage). */
  attachRunnerRun: (runId: string) => void;
  startAdhocTest: (body: AdhocBody) => Promise<boolean>;
  saveManualTest: (t: Omit<SavedTest, "id" | "savedAt">) => void;
  deleteManualTest: (id: string) => void;
  cancelPlaywrightRun: () => Promise<void>;
  clearRunnerRun: () => void;

  setBrand: (b: BrandFilter) => void;
  setQuery: (q: string) => void;
  setInboxFilter: (f: InboxFilter) => void;
  toggleSelect: (id: string) => void;
  clearSelect: () => void;
  toggleNotif: () => void;
  closeNotif: () => void;
  markAllRead: () => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  toggleExpandTest: (id: string) => void;

  runTestPlan: (
    taskId: string,
    mode?: "run" | "verify",
    onSettle?: (r: { failed: boolean; status: TaskStatus }) => void,
  ) => void;
  fileIssue: (taskId: string, draft: { title: string; body: string; repoId: string }) => void;
  acceptKnownIssue: (taskId: string) => void;
  simulateDevFix: (taskId: string) => void;
  commentAndMarkReady: (taskId: string) => void;
  mergeTask: (taskId: string) => void;
  closeTask: (taskId: string) => Promise<void>;
  /** Run the product smoke to test a reported GitHub issue (no writes). */
  testGithubIssue: (taskId: string) => Promise<void>;
  /**
   * Verify a dev's fix on a GitHub issue: run the product smoke, and on a PASS
   * post "verified & validated" + close the issue (REAL GitHub writes). The
   * caller (UI) is responsible for confirm-gating this.
   */
  verifyGithubFix: (taskId: string) => Promise<void>;
  qaLog: QaLogEntry[];
  bulkRun: () => void;
  scaffoldTests: (taskId: string) => void;
  generateFromTask: (taskId: string) => void;
  loadAsana: () => Promise<void>;
  loadGithub: () => Promise<void>;
  loadSlack: () => Promise<void>;
  setIssueDraft: (taskId: string, patch: Partial<{ title: string; body: string; repoId: string }>) => void;

  claimTask: (taskId: string, ownership: "human" | "ai") => void;
  releaseTask: (taskId: string) => void;
  toggleTestArtifact: (taskId: string, key: keyof TestArtifacts) => void;

  // ── AI QA authoring (Plan → Scenarios → Playwright cases → Excel) ──────────
  aiReady: boolean | null; // cached /api/ai/status, gates auto-authoring
  aiUnfunded: boolean; // set true once an AI call fails with a 402/credit error
  autoAuthor: boolean; // auto-author each newly synced task (persisted)
  setAutoAuthor: (v: boolean) => void;
  authorQaPlan: (taskId: string, opts?: { silent?: boolean }) => Promise<void>;
  exportQaRecord: (taskId: string) => Promise<void>;

  runQaPipeline: (taskId: string) => void;
  advanceQaStage: (taskId: string, stage: QaStageKey) => void;

  openEditor: (taskId: string) => void;
  closeEditor: () => void;
  openArtifact: (testId: string, kind: "screenshot" | "trace" | "video" | "diff") => void;
  closeArtifact: () => void;
};

let toastSeq = 0;
let issueSeq = 300;
let actSeq = 0;
let savedSeq = 0;
let userSeq = 0;
let qaLogSeq = 0;

// Apply the persisted/OS theme at module load so the first paint is correct.
const bootTheme = initialTheme();
applyTheme(bootTheme);

// Unique activity-event id. Date.now() alone collides when several events are
// appended within the same millisecond (e.g. the QA pipeline settling), which
// React flags as duplicate keys — the counter guarantees uniqueness.
const aid = () => `a-${Date.now()}-${actSeq++}`;

function taskById(tasks: Task[], id: string) {
  return tasks.find((t) => t.id === id);
}

// True if `prev` had ≥1 active admin but `next` has none — the change would
// lock everyone out of user management, so it must be rejected.
function leavesNoActiveAdmin(prev: AppUser[], next: AppUser[]): boolean {
  const activeAdmins = (list: AppUser[]) => list.filter((u) => u.role === "admin" && u.active).length;
  return activeAdmins(prev) > 0 && activeAdmins(next) === 0;
}

// ── Runner poll loop (module-level so it survives component unmounts) ────────
let runnerTimer: ReturnType<typeof setTimeout> | null = null;
let runnerOffset = 0;
let runnerPollFails = 0;
let runnerStarting = false;

// When a GitHub-issue "Verify fix" run is in flight, this points the run's
// terminal handler at the task so a PASS can post "verified & validated" and
// close the issue (both REAL GitHub writes). Cleared once handled.
let pendingGithubVerify: { taskId: string; runId: string } | null = null;

function stopRunnerPoll() {
  if (runnerTimer) clearTimeout(runnerTimer);
  runnerTimer = null;
}

/** The product brand for a task, used only as a framework-map fallback. */
function brandOf(state: State, task: Task): string | undefined {
  return state.products.find((p) => p.id === task.productId)?.brand;
}

// Called from the run-poll terminal branch. On a passing verify run, comment
// "verified & validated" on the issue and close it (real writes), then record
// the sign-off. On a failing run, leave the issue open and mark it failed.
async function finishGithubVerify(
  set: (partial: Partial<State> | ((s: State) => Partial<State>)) => void,
  get: () => State,
  run: RunnerRun,
) {
  const pending = pendingGithubVerify;
  if (!pending || pending.runId !== run.id) return;
  pendingGithubVerify = null;

  const task = taskById(get().tasks, pending.taskId);
  const gh = task?.github;
  // V1 honest verdict floor: ONLY a verdict of PASS with ≥1 executed test may
  // comment + close. A green exit with 0 tests, skips (PASS_WITH_GAPS), a blocked
  // run, or an old server with no verdict at all must never close an issue.
  const honestPass = isHonestPass(run.verdict);
  const passed = run.status === "passed" && honestPass;
  const now = new Date().toISOString();

  const stamp = (icon: ActivityEvent["icon"], html: string) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === pending.taskId ? { ...t, activity: [...t.activity, { id: aid(), icon, html, at: now }] } : t,
      ),
    }));
  const setVerify = (v: Partial<import("@/types").FixVerification>) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === pending.taskId
          ? { ...t, fixVerification: { ...(t.fixVerification ?? { state: "idle" as const }), ...v } }
          : t,
      ),
    }));

  if (!task || !gh) {
    return;
  }

  if (!passed && run.status !== "failed") {
    // Not a defect, not a pass: blocked / gaps / not run → inconclusive. The
    // issue stays open and the task is NOT marked failed (it isn't a regression).
    const note = run.verdict ? verdictNote(run.verdict) : "No verdict from the runner — can't confirm the fix";
    setVerify({ state: "blocked", finishedAt: now, note });
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === pending.taskId ? { ...t, status: "ready" as const } : t)) }));
    stamp("flag", `Fix verification <b>inconclusive</b> — ${note}. Issue #${gh.number} left open (no GitHub write).`);
    get().pushToast({ icon: "issue", title: "Fix not verified — inconclusive", subtitle: `#${gh.number} left open · ${note}` });
    return;
  }

  if (!passed) {
    setVerify({ state: "failed", finishedAt: now });
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === pending.taskId ? { ...t, status: "failed" as const } : t)) }));
    stamp("issue", `Fix verification <b>failed</b> — smoke did not pass. Issue #${gh.number} left open.`);
    get().pushToast({ icon: "issue", title: "Fix not verified", subtitle: `#${gh.number} left open — smoke failed` });
    return;
  }

  // PASS → real GitHub writes: comment then close.
  const me = get().users.find((u) => u.id === get().currentUserId);
  const summary = run.summary
    ? `${run.summary.expected} passed${run.summary.skipped ? ` · ${run.summary.skipped} skipped` : ""}`
    : "smoke passed";
  const body = [
    "✅ **Verified & validated by QA (TestPilot)**",
    "",
    `The reported issue was re-tested against an automated smoke run — **${summary}**. The fix works as described; closing.`,
    "",
    `_Verified by ${me?.name ?? "QA"} · ${new Date(now).toUTCString()}_`,
  ].join("\n");

  const cRes = await commentOnRepoIssue(gh.repo, gh.number, body);
  if (cRes.error) {
    setVerify({ state: "passed", finishedAt: now });
    stamp("issue", `Smoke passed, but posting the comment failed: ${cRes.error}`);
    get().pushToast({ icon: "issue", title: "Verified — comment failed", subtitle: cRes.error });
    return;
  }
  stamp("comment", `Posted <b>verified &amp; validated</b> on #${gh.number} ✓`);

  const clRes = await closeRepoIssue(gh.repo, gh.number);
  if (clRes.error) {
    setVerify({ state: "passed", finishedAt: now, commentUrl: cRes.comment?.url });
    stamp("issue", `Commented, but closing #${gh.number} failed: ${clRes.error}`);
    get().pushToast({ icon: "issue", title: "Commented — close failed", subtitle: clRes.error });
    return;
  }

  setVerify({ state: "closed", finishedAt: now, commentUrl: cRes.comment?.url });
  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === pending.taskId
        ? {
            ...t,
            status: "closed" as const,
            clearedAt: t.clearedAt ?? now,
            github: t.github ? { ...t.github, state: "closed" } : t.github,
          }
        : t,
    ),
  }));
  stamp("check", `Closed issue #${gh.number} on GitHub ✓`);

  // Durable QA sign-off (persisted).
  const entry: QaLogEntry = {
    id: `qalog-${Date.now()}-${qaLogSeq++}`,
    taskId: task.id,
    title: task.title,
    origin: task.origin,
    pr: task.pr || null,
    closedBy: me?.name ?? "QA",
    closedAt: now,
    asana: "none",
    github: { repo: gh.repo, number: gh.number, action: "verified-closed", commentUrl: cRes.comment?.url },
  };
  set((s) => {
    const next = [entry, ...s.qaLog].slice(0, 300);
    writeQaLog(next);
    return { qaLog: next };
  });
  get().pushToast({ icon: "verify", title: "Fix verified & issue closed", subtitle: `#${gh.number} on GitHub` });
}

function describeRun(state: State, run: { framework: string; mode: string; env?: Record<string, string> }) {
  if (run.mode === "adhoc") return `Ad-hoc test · ${run.env?.url ?? "URL"}`;
  const fw = state.runnerFrameworks?.find((f) => f.id === run.framework);
  const modeLabel = run.mode === "smoke" ? "Smoke" : run.mode === "full" ? "Full regression" : "Single spec";
  return `${modeLabel} · ${fw?.label ?? run.framework}`;
}

function pollRunnerRun(
  set: (partial: Partial<State> | ((s: State) => Partial<State>)) => void,
  get: () => State,
  runId: string,
) {
  stopRunnerPoll();
  const tick = async () => {
    try {
      const { run, output, nextOffset } = await fetchRun(runId, runnerOffset);
      runnerOffset = nextOffset;
      runnerPollFails = 0;
      set((s) => ({
        runnerRun: run,
        runnerOutput: (s.runnerOutput + output).slice(-400_000),
      }));
      if (run.status === "running") {
        runnerTimer = setTimeout(tick, 1000);
        return;
      }
      const summary = run.summary;
      const subtitle = summary
        ? `${summary.expected} passed · ${summary.unexpected} failed${summary.skipped ? ` · ${summary.skipped} skipped` : ""}`
        : describeRun(get(), run);
      if (pendingGithubVerify && pendingGithubVerify.runId === run.id) {
        // A GitHub Verify-fix run finished — this owns the toast (comment/close).
        void finishGithubVerify(set, get, run);
      } else if (run.status === "passed")
        get().pushToast({
          icon: "check",
          title: run.verdict?.state === "PASS_WITH_GAPS" ? "Run passed with gaps" : "Run passed",
          subtitle,
        });
      else if (run.status === "blocked")
        get().pushToast({ icon: "issue", title: "Run blocked — no verdict", subtitle: verdictNote(run.verdict) || subtitle });
      else if (run.status === "failed") get().pushToast({ icon: "issue", title: "Run failed", subtitle });
      else if (run.status === "cancelled") get().pushToast({ icon: "sync", title: "Run cancelled", subtitle });
    } catch (e) {
      const status = (e as import("@/lib/runner").ApiError).status;
      if (status === 404) {
        // Dev server restarted: the run (and its child) are genuinely gone.
        set((s) => ({
          runnerError: "The dev server restarted mid-run — run state was lost.",
          runnerRun: s.runnerRun ? { ...s.runnerRun, status: "error" as const } : null,
        }));
        return;
      }
      // Transient (network blip, laptop sleep/wake): keep polling with backoff —
      // the Playwright child is still running server-side and must stay
      // observable/cancellable.
      runnerPollFails++;
      runnerTimer = setTimeout(tick, Math.min(2_000 * runnerPollFails, 10_000));
    }
  };
  runnerTimer = setTimeout(tick, 700);
}

export const useStore = create<State>((set, get) => ({
  brand: "all",
  theme: bootTheme,
  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === "dark" ? "light" : "dark";
      applyTheme(theme);
      saveTheme(theme);
      return { theme };
    }),

  users: readUsers(),
  currentUserId: (() => {
    const sid = readSession();
    return sid && readUsers().some((u) => u.id === sid && u.active) ? sid : null;
  })(),
  signIn: (userId) =>
    set((s) => {
      if (!s.users.some((u) => u.id === userId && u.active)) return {};
      writeSession(userId);
      return { currentUserId: userId };
    }),
  signOut: () => {
    writeSession(null);
    set({ currentUserId: null });
  },
  addUser: (u) =>
    set((s) => {
      const id = `u-${Date.now()}-${userSeq++}`;
      const next = [...s.users, { ...u, id }];
      writeUsers(next);
      return { users: next };
    }),
  updateUser: (id, patch) =>
    set((s) => {
      const next = s.users.map((u) => (u.id === id ? { ...u, ...patch } : u));
      // Central invariant: a role/active change must never orphan the last
      // ACTIVE admin (which would permanently lock everyone out of user mgmt).
      if (leavesNoActiveAdmin(s.users, next)) return {};
      writeUsers(next);
      return { users: next };
    }),
  removeUser: (id) =>
    set((s) => {
      if (id === s.currentUserId) return {}; // can't remove yourself while signed in
      const next = s.users.filter((u) => u.id !== id);
      if (leavesNoActiveAdmin(s.users, next)) return {};
      writeUsers(next);
      return { users: next };
    }),

  query: "",
  inboxFilter: "all",
  selected: new Set(),
  notifOpen: false,
  toasts: [],
  expandedTests: {},
  merged: {},
  deployed: {},

  asanaState: "unknown",
  asanaUser: null,
  asanaError: null,

  githubState: "unknown",
  githubUser: null,
  githubLogin: null,
  githubError: null,

  slackState: "unknown",
  slackUser: null,
  slackError: null,

  tasks: initialTasks,
  issues: initialIssues,
  notifications: initialNotifications,
  repos: initialRepos,
  products,
  devs,
  issueDrafts: {},

  editorTaskId: null,
  artifactModal: null,

  runnerFrameworks: null,
  runnerAdhocReady: null,
  runnerError: null,
  runnerSpecs: {},
  runnerSpecsLoading: null,
  runnerRun: null,
  runnerOutput: "",
  savedTests: readSavedTests(),
  qaLog: readQaLog(),
  aiReady: null,
  aiUnfunded: false,
  autoAuthor: readAutoAuthor(),

  saveManualTest: (t) =>
    set((s) => {
      // De-dupe by url+env — re-saving the same target updates it in place.
      const id = `saved-${Date.now()}-${savedSeq++}`;
      const entry: SavedTest = { ...t, id, savedAt: new Date().toISOString() };
      const rest = s.savedTests.filter((x) => !(x.url === t.url && (x.env ?? "") === (t.env ?? "")));
      const next = [entry, ...rest].slice(0, 50);
      writeSavedTests(next);
      return { savedTests: next };
    }),

  deleteManualTest: (id) =>
    set((s) => {
      const next = s.savedTests.filter((x) => x.id !== id);
      writeSavedTests(next);
      return { savedTests: next };
    }),

  loadRunnerFrameworks: async () => {
    try {
      const r = await fetchFrameworks();
      set({ runnerFrameworks: r.frameworks, runnerAdhocReady: r.adhoc, runnerError: null });
      // Re-attach to an in-flight run after a page reload.
      if (r.activeRunId && !get().runnerRun) {
        const cur = await fetchRun(r.activeRunId, 0);
        set({ runnerRun: cur.run, runnerOutput: cur.output });
        runnerOffset = cur.nextOffset;
        if (cur.run.status === "running") pollRunnerRun(set, get, cur.run.id);
      }
    } catch (e) {
      set({ runnerError: (e as Error).message });
    }
  },

  loadRunnerSpecs: async (frameworkId, refresh = false) => {
    set({ runnerSpecsLoading: frameworkId });
    try {
      const r = await fetchSpecs(frameworkId, refresh);
      set((s) => ({
        runnerSpecs: { ...s.runnerSpecs, [frameworkId]: r.specs },
        // Only clear the loading flag if a newer load hasn't claimed it since.
        runnerSpecsLoading: s.runnerSpecsLoading === frameworkId ? null : s.runnerSpecsLoading,
        runnerError: null,
      }));
    } catch (e) {
      set((s) => ({
        runnerSpecsLoading: s.runnerSpecsLoading === frameworkId ? null : s.runnerSpecsLoading,
        runnerError: (e as Error).message,
      }));
    }
  },

  startPlaywrightRun: async (body) => {
    // runnerStarting guards the double-click window before the POST resolves.
    if (runnerStarting || get().runnerRun?.status === "running") return;
    runnerStarting = true;
    try {
      const { run } = await startRunnerRun(body);
      runnerOffset = 0;
      runnerPollFails = 0;
      set({ runnerRun: run, runnerOutput: "", runnerError: null });
      get().pushToast({ icon: "generate", title: "Playwright run started", subtitle: describeRun(get(), run) });
      pollRunnerRun(set, get, run.id);
    } catch (e) {
      set({ runnerError: (e as Error).message });
      get().pushToast({ icon: "issue", title: "Couldn't start run", subtitle: (e as Error).message });
    } finally {
      runnerStarting = false;
    }
  },

  attachRunnerRun: (runId) => {
    // The run was started elsewhere (a pipeline stage started server-side) —
    // point the RunPanel at it and start polling. No-op if already attached.
    if (get().runnerRun?.id === runId && get().runnerRun?.status === "running") return;
    runnerOffset = 0;
    runnerPollFails = 0;
    set({ runnerOutput: "", runnerError: null });
    pollRunnerRun(set, get, runId);
  },

  startAdhocTest: async (body) => {
    if (runnerStarting || get().runnerRun?.status === "running") return false;
    runnerStarting = true;
    try {
      const { run } = await startAdhocRun(body);
      runnerOffset = 0;
      runnerPollFails = 0;
      set({ runnerRun: run, runnerOutput: "", runnerError: null });
      get().pushToast({ icon: "generate", title: "Ad-hoc test started", subtitle: body.title || body.url });
      pollRunnerRun(set, get, run.id);
      return true;
    } catch (e) {
      set({ runnerError: (e as Error).message });
      get().pushToast({ icon: "issue", title: "Couldn't start test", subtitle: (e as Error).message });
      return false;
    } finally {
      runnerStarting = false;
    }
  },

  cancelPlaywrightRun: async () => {
    const run = get().runnerRun;
    if (!run || run.status !== "running") return;
    try {
      await cancelRunnerRun(run.id);
    } catch (e) {
      set({ runnerError: (e as Error).message });
    }
  },

  clearRunnerRun: () => {
    if (get().runnerRun?.status === "running") return;
    stopRunnerPoll();
    set({ runnerRun: null, runnerOutput: "" });
  },

  setBrand: (b) => set({ brand: b }),
  setQuery: (q) => set({ query: q }),
  setInboxFilter: (f) => set({ inboxFilter: f }),
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next };
    }),
  clearSelect: () => set({ selected: new Set() }),
  toggleNotif: () => set((s) => ({ notifOpen: !s.notifOpen })),
  closeNotif: () => set({ notifOpen: false }),
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, unread: false })) })),
  pushToast: (t) =>
    set((s) => ({ toasts: [...s.toasts, { ...t, id: `toast-${toastSeq++}` }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  toggleExpandTest: (id) =>
    set((s) => ({ expandedTests: { ...s.expandedTests, [id]: !s.expandedTests[id] } })),

  setIssueDraft: (taskId, patch) =>
    set((s) => ({
      issueDrafts: {
        ...s.issueDrafts,
        [taskId]: { ...(s.issueDrafts[taskId] || { title: "", body: "", repoId: "" }), ...patch },
      },
    })),

  claimTask: (taskId, ownership) => {
    const task = taskById(get().tasks, taskId);
    const meName = get().users.find((u) => u.id === get().currentUserId)?.name ?? "QA";
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              ownership,
              pickedUpAt: new Date().toISOString(),
              activity: [
                ...t.activity,
                {
                  id: aid(),
                  icon: "claim" as const,
                  html: ownership === "ai" ? "Handed to <b>AI automation</b> for testing" : `<b>${meName}</b> picked this up`,
                  at: new Date().toISOString(),
                },
              ],
            }
          : t,
      ),
    }));
    get().pushToast({
      icon: "check",
      title: ownership === "ai" ? "Handed to AI automation" : "You picked this up",
      subtitle: task?.title ?? "",
    });
    // Handing a task to AI kicks off the full authoring pipeline (unless it was
    // already authored). authorQaPlan no-ops if a run is already in flight.
    if (ownership === "ai" && !taskById(get().tasks, taskId)?.qaAuthoring) {
      void get().authorQaPlan(taskId);
    }
  },

  releaseTask: (taskId) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ownership: "unclaimed" as const, pickedUpAt: null } : t)),
    })),

  toggleTestArtifact: (taskId, key) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, testArtifacts: { ...t.testArtifacts, [key]: !t.testArtifacts[key] } } : t,
      ),
    })),

  setAutoAuthor: (v) => {
    writeAutoAuthor(v);
    set({ autoAuthor: v });
  },

  // Full AI authoring pipeline for one task: plan → scenarios → Playwright
  // cases (saved into the framework's ai-generated/) → Excel record. Each stage
  // is persisted to task.qaAuthoring as it lands, so the UI streams progress and
  // an in-flight run survives navigation.
  authorQaPlan: async (taskId, opts) => {
    const task = taskById(get().tasks, taskId);
    if (!task) return;
    const active = task.qaAuthoring?.status;
    if (active === "planning" || active === "scenarios" || active === "cases" || active === "exporting") return;
    const silent = opts?.silent ?? false;

    const input = buildPlanInput(task, get().products);
    try {
      setAuthoring(set, taskId, { status: "planning", error: undefined });
      appendActivity(set, taskId, "run", "AI is authoring a <b>test plan</b>…");
      const { plan } = await aiPlanTask(input);
      setAuthoring(set, taskId, { status: "scenarios", plan });
      setArtifact(set, taskId, "plan", true);

      const { scenarios } = await aiScenarios(input, plan);
      setAuthoring(set, taskId, { status: "cases", scenarios });
      setArtifact(set, taskId, "scenarios", true);

      const { specs } = await aiCases(input, plan, scenarios);
      // Surface the generated cases in the existing Playwright card + Stepper.
      const tests = scenariosToTestCases(scenarios, specs);
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                tests,
                status: t.status === "assigned" || t.status === "tests-missing" ? "ready" : t.status,
                testArtifacts: { ...t.testArtifacts, cases: true },
                qaAuthoring: { ...(t.qaAuthoring ?? { status: "cases" as const }), status: "exporting", specs },
              }
            : t,
        ),
      }));
      appendActivity(
        set,
        taskId,
        "run",
        `Authored <b>${scenarios.length}</b> scenario${scenarios.length === 1 ? "" : "s"} + a Playwright spec in <span class="font-mono">${specs[0]?.filename ?? "ai-generated"}</span>`,
      );

      const rec = await aiExportRecord(input, plan, scenarios, specs);
      setAuthoring(set, taskId, { status: "done", recordPath: rec.path, authoredAt: new Date().toISOString() });
      appendActivity(set, taskId, "check", `Exported QA record <span class="font-mono">${rec.filename}</span>`);
      if (!silent) get().pushToast({ icon: "generate", title: "QA plan authored", subtitle: task.title });
    } catch (e) {
      const msg = (e as Error).message;
      setAuthoring(set, taskId, { status: "error", error: msg });
      // Unfunded Anthropic account (402) → flag it so the UI can greY the AI
      // actions instead of letting every click 402.
      if (/credit|payment required|\b402\b|billing|insufficient|quota|no funds/i.test(msg)) set({ aiUnfunded: true });
      // Auto-authoring toasts are summarised once by the queue (a config/billing
      // error would otherwise fire one toast per task). Manual runs toast here.
      if (!silent) get().pushToast({ icon: "issue", title: "QA authoring failed", subtitle: msg });
    }
  },

  // Re-export the Excel record from already-authored artifacts (manual button).
  exportQaRecord: async (taskId) => {
    const task = taskById(get().tasks, taskId);
    const a = task?.qaAuthoring;
    if (!task || !a?.plan || !a.scenarios) return;
    const input = buildPlanInput(task, get().products);
    try {
      setAuthoring(set, taskId, { status: "exporting" });
      const rec = await aiExportRecord(input, a.plan, a.scenarios, a.specs ?? []);
      setAuthoring(set, taskId, { status: "done", recordPath: rec.path, authoredAt: new Date().toISOString() });
      appendActivity(set, taskId, "check", `Exported QA record <span class="font-mono">${rec.filename}</span>`);
      get().pushToast({ icon: "generate", title: "QA record exported", subtitle: rec.filename });
    } catch (e) {
      setAuthoring(set, taskId, { status: "error", error: (e as Error).message });
    }
  },

  runQaPipeline: (taskId) => {
    const task = taskById(get().tasks, taskId);
    if (!task || task.qaPipeline?.running) return;
    const docsReady = !!task.links.pullRequest;
    const pipeline = seedPipeline("auto", docsReady);
    pipeline.running = true;
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, qaPipeline: pipeline } : t)) }));
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              activity: [
                ...t.activity,
                { id: aid(), icon: "run" as const, html: "Started doc-driven <b>QA pipeline</b>", at: new Date().toISOString() },
              ],
            }
          : t,
      ),
    }));
    get().pushToast({ icon: "generate", title: "QA pipeline started", subtitle: task.title });
    runStage(set, get, taskId, "docs", true);
  },

  advanceQaStage: (taskId, stage) => {
    const task = taskById(get().tasks, taskId);
    if (!task) return;
    if (!task.qaPipeline) {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, qaPipeline: seedPipeline("manual", !!task.links.pullRequest) } : t)) }));
    }
    runStage(set, get, taskId, stage, false);
  },

  runTestPlan: (taskId, mode = "run", onSettle) => {
    const task = taskById(get().tasks, taskId);
    if (!task || task.tests.length === 0 || task.run.running) return;

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "running",
              tests: t.tests.map((tc) => ({ ...tc, status: "queued" as const })),
              run: { running: true, progress: 0, currentTestId: t.tests[0].id },
              activity: [
                ...t.activity,
                { id: aid(), icon: "run", html: "Test run started", at: new Date().toISOString() },
              ],
            }
          : t,
      ),
    }));

    const orderedTests = [...task.tests].sort(
      (a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase),
    );
    // null = "no forced failure" — verify runs never fail/block. (Using -1 here
    // made `idx > forcedFailIndex` true for every test, flashing them all "blocked".)
    const forcedFailIndex = mode === "verify" ? null : task.failIndex;

    let i = 0;
    const step = () => {
      const total = orderedTests.length;
      const isFail = forcedFailIndex !== null && forcedFailIndex !== undefined && i === forcedFailIndex;

      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const tests = t.tests.map((tc) => {
            const idx = orderedTests.findIndex((o) => o.id === tc.id);
            if (idx < i) return tc.status === "failed" ? tc : { ...tc, status: "passed" as const };
            if (idx === i) return { ...tc, status: (isFail ? "failed" : "passed") as TestCase["status"] };
            if (
              forcedFailIndex !== null &&
              forcedFailIndex !== undefined &&
              idx > i &&
              idx > forcedFailIndex
            )
              return { ...tc, status: "blocked" as const };
            return tc;
          });
          return {
            ...t,
            tests,
            run: { running: true, progress: Math.round(((i + 1) / total) * 100), currentTestId: orderedTests[i + 1]?.id ?? null },
          };
        }),
      }));

      if (isFail) {
        finish(true);
        return;
      }
      i++;
      if (i >= total) {
        finish(false);
        return;
      }
      setTimeout(step, 550);
    };

    const finish = (failed: boolean) => {
      // A verify run only "closes an issue" if one is actually open for this
      // task; otherwise it's just a clean re-verification pass (smoke/regression).
      const hasOpenIssue = get().issues.some((iss) => iss.taskId === taskId && iss.state !== "closed");
      const verifyClosed = mode === "verify" && !failed && hasOpenIssue;

      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const nextStatus = failed ? "failed" : mode === "verify" ? "verified" : "passed";
          return {
            ...t,
            status: nextStatus,
            failIndex: failed ? i : t.failIndex,
            clearedAt: !failed ? t.clearedAt ?? new Date().toISOString() : t.clearedAt,
            run: { running: false, progress: 100, currentTestId: null },
            activity: [
              ...t.activity,
              {
                id: aid(),
                icon: failed ? "flag" : "check",
                html: failed
                  ? `Test run <b>failed</b> at ${t.tests.find((x) => x.status === "failed")?.phase ?? ""} phase`
                  : verifyClosed
                    ? "Re-verified the fix — issue verified &amp; closed"
                    : mode === "verify"
                      ? "Re-verification passed — all checks green"
                      : "All phases passed — cleared QA",
                at: new Date().toISOString(),
              },
            ],
          };
        }),
      }));

      const nextStatus: TaskStatus = failed ? "failed" : mode === "verify" ? "verified" : "passed";

      if (verifyClosed) {
        set((s) => ({
          issues: s.issues.map((iss) => (iss.taskId === taskId ? { ...iss, state: "closed" } : iss)),
        }));
        get().pushToast({ icon: "verify", title: "Fix verified & issue closed", subtitle: task.title });
      } else if (!failed) {
        get().pushToast({ icon: "check", title: mode === "verify" ? "Re-verification passed" : "Cleared QA", subtitle: task.title });
      } else {
        get().pushToast({ icon: "issue", title: "Test run failed", subtitle: `Blocked at ${task.tests[i]?.phase ?? "a"} phase` });
      }

      onSettle?.({ failed, status: nextStatus });
    };

    setTimeout(step, 400);
  },

  fileIssue: (taskId, draft) => {
    const task = taskById(get().tasks, taskId);
    if (!task) return;
    const number = issueSeq++;
    const newIssue: Issue = {
      id: `issue-${number}`,
      number,
      title: draft.title,
      repoId: draft.repoId,
      specFile: task.tests.find((t) => t.status === "failed")?.file ?? "",
      severity: task.priority === "High" ? "High" : task.priority === "Medium" ? "Medium" : "Low",
      productId: task.productId,
      openedAt: new Date().toISOString(),
      state: "open",
      taskId,
      devId: task.devId,
    };
    set((s) => ({
      issues: [newIssue, ...s.issues],
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "reported",
              issue: { number, repoId: draft.repoId, title: draft.title, body: draft.body, labels: ["bug", "qa-fail"] },
              activity: [
                ...t.activity,
                {
                  id: aid(),
                  icon: "issue",
                  html: `Filed <b>#${number}</b> and assigned back to ${s.devs.find((d) => d.id === t.devId)?.name ?? "the dev"}`,
                  at: new Date().toISOString(),
                },
              ],
            }
          : t,
      ),
      notifications: [
        {
          id: `n-${Date.now()}`,
          kind: "issue-filed",
          html: `Filed <b>#${number}</b> on <b>${s_repoName(get(), draft.repoId)}</b>, assigned to ${s.devs.find((d) => d.id === task.devId)?.name ?? "the dev"}`,
          at: new Date().toISOString(),
          unread: true,
          route: `/queue/${taskId}`,
        },
        ...s.notifications,
      ],
    }));
    get().pushToast({ icon: "issue", title: "Issue filed", subtitle: `#${number} assigned to ${get().devs.find((d) => d.id === task.devId)?.name ?? "the dev"}` });
  },

  acceptKnownIssue: (taskId) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "accepted",
              clearedAt: t.clearedAt ?? new Date().toISOString(),
              activity: [
                ...t.activity,
                { id: aid(), icon: "flag", html: "Accepted as a known issue", at: new Date().toISOString() },
              ],
            }
          : t,
      ),
    })),

  simulateDevFix: (taskId) => devRespond(set, get, taskId, "Dev responded"),
  commentAndMarkReady: (taskId) => devRespond(set, get, taskId, "Marked ready for re-test"),

  mergeTask: (taskId) => {
    set((s) => ({ merged: { ...s.merged, [taskId]: true } }));
    setTimeout(() => {
      set((s) => ({ deployed: { ...s.deployed, [taskId]: true } }));
    }, 1400);
    const task = taskById(get().tasks, taskId);
    get().pushToast({ icon: "merge", title: "Merged", subtitle: task?.title ?? "" });
  },

  // Close a verified task: move it to the terminal "closed" state and, for an
  // Asana-origin task, mark it complete in Asana (REAL write-back via the token).
  closeTask: async (taskId) => {
    const task = taskById(get().tasks, taskId);
    if (!task) return;
    const stamp = (icon: ActivityEvent["icon"], html: string) =>
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? { ...t, activity: [...t.activity, { id: aid(), icon, html, at: new Date().toISOString() }] }
            : t,
        ),
      }));

    // Local: move to closed.
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: "closed" as const, clearedAt: t.clearedAt ?? new Date().toISOString() }
          : t,
      ),
    }));
    stamp("check", "Verified &amp; <b>closed</b>");

    // Real write-back for Asana-origin tasks.
    let asanaResult: QaLogEntry["asana"] = "none";
    if (task.origin === "asana" && task.asana?.gid) {
      const r = await completeAsanaTask(task.asana.gid);
      if (r.ok) {
        asanaResult = "completed";
        stamp("check", "Marked <b>complete in Asana</b> ✓");
        get().pushToast({ icon: "check", title: "Closed + completed in Asana", subtitle: task.title });
      } else {
        asanaResult = "failed";
        stamp("issue", `Asana update failed: ${r.error ?? "unknown error"}`);
        get().pushToast({ icon: "issue", title: "Closed locally — Asana update failed", subtitle: r.error ?? "check the token's write access" });
      }
    } else {
      get().pushToast({ icon: "check", title: "Task closed", subtitle: task.title });
    }

    // Durable QA sign-off record (persisted — survives reloads, unlike task status).
    const me = get().users.find((u) => u.id === get().currentUserId);
    const entry: QaLogEntry = {
      id: `qalog-${Date.now()}-${qaLogSeq++}`,
      taskId: task.id,
      title: task.title,
      origin: task.origin,
      pr: task.pr || null,
      closedBy: me?.name ?? "QA",
      closedAt: new Date().toISOString(),
      asana: asanaResult,
    };
    set((s) => {
      const next = [entry, ...s.qaLog].slice(0, 300);
      writeQaLog(next);
      return { qaLog: next };
    });
  },

  testGithubIssue: async (taskId) => {
    const task = taskById(get().tasks, taskId);
    if (!task || task.origin !== "github" || !task.github) return;
    if (runnerStarting || get().runnerRun?.status === "running") {
      get().pushToast({ icon: "issue", title: "A run is already in progress", subtitle: "Wait for it to finish" });
      return;
    }
    const framework = defaultFrameworkFor(task.productId, brandOf(get(), task));
    runnerStarting = true;
    try {
      const { run } = await startRunnerRun({
        framework,
        mode: "smoke",
        taskRef: { taskId: task.id, label: `Test issue #${task.github.number}` },
      });
      runnerOffset = 0;
      runnerPollFails = 0;
      set({ runnerRun: run, runnerOutput: "", runnerError: null });
      get().pushToast({ icon: "generate", title: `Testing issue #${task.github.number}`, subtitle: describeRun(get(), run) });
      pollRunnerRun(set, get, run.id);
    } catch (e) {
      set({ runnerError: (e as Error).message });
      get().pushToast({ icon: "issue", title: "Couldn't start test", subtitle: (e as Error).message });
    } finally {
      runnerStarting = false;
    }
  },

  verifyGithubFix: async (taskId) => {
    const task = taskById(get().tasks, taskId);
    if (!task || task.origin !== "github" || !task.github) return;
    if (!task.devResponded) {
      get().pushToast({ icon: "issue", title: "No dev response yet", subtitle: "Verify unlocks once the dev comments a fix" });
      return;
    }
    if (runnerStarting || get().runnerRun?.status === "running") {
      get().pushToast({ icon: "issue", title: "A run is already in progress", subtitle: "Wait for it to finish" });
      return;
    }
    const framework = defaultFrameworkFor(task.productId, brandOf(get(), task));
    const now = new Date().toISOString();
    runnerStarting = true;
    try {
      const { run } = await startRunnerRun({
        framework,
        mode: "smoke",
        taskRef: { taskId: task.id, label: `Verify fix · #${task.github.number}` },
      });
      pendingGithubVerify = { taskId: task.id, runId: run.id };
      runnerOffset = 0;
      runnerPollFails = 0;
      set((s) => ({
        runnerRun: run,
        runnerOutput: "",
        runnerError: null,
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "verifying" as const,
                fixVerification: { state: "running", runId: run.id, startedAt: now },
                activity: [
                  ...t.activity,
                  { id: aid(), icon: "run", html: `Verifying the fix — running <b>${framework}</b> smoke…`, at: now },
                ],
              }
            : t,
        ),
      }));
      get().pushToast({ icon: "generate", title: `Verifying fix · #${task.github.number}`, subtitle: describeRun(get(), run) });
      pollRunnerRun(set, get, run.id);
    } catch (e) {
      set({ runnerError: (e as Error).message });
      get().pushToast({ icon: "issue", title: "Couldn't start verification", subtitle: (e as Error).message });
    } finally {
      runnerStarting = false;
    }
  },

  bulkRun: () => {
    const ids = [...get().selected];
    ids.forEach((id) => {
      const t = taskById(get().tasks, id);
      if (t && t.tests.length > 0 && !t.run.running) get().runTestPlan(id);
    });
    set({ selected: new Set() });
  },

  scaffoldTests: (taskId) => generateTestsForTask(set, get, taskId, "Scaffolded test suite"),
  generateFromTask: (taskId) => generateTestsForTask(set, get, taskId, "Generated tests from task"),

  loadAsana: async () => {
    set({ asanaState: "loading" });
    try {
      const resp = await fetchAsanaTasks();
      if (!resp.connected) {
        set({
          asanaState: resp.reason === "no_token" ? "no_token" : "error",
          asanaError: resp.error ?? null,
        });
        return;
      }
      const { products } = get();
      // All dev-list augmentation + task mapping happens inside the functional
      // set so it composes safely with loadGithub() running concurrently on
      // mount — each only replaces its own-origin tasks and merges devs.
      set((s) => {
        // Ensure every Asana creator exists as a dev so the "Assigned by"
        // attribution is correct — never silently defaults to the first dev.
        const devs = [...s.devs];
        const byName = new Map(devs.map((d) => [d.name.toLowerCase(), d]));
        for (const t of resp.tasks) {
          const c = (t.createdBy || "").trim();
          if (c && !byName.has(c.toLowerCase())) {
            const nd = {
              id: `dev-asana-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
              name: c,
              role: "Asana creator",
              slackHandle: "",
            };
            devs.push(nd);
            byName.set(c.toLowerCase(), nd);
          }
        }
        const realTasks = resp.tasks.map((t) => asanaToTask(t, products, devs));
        return {
          // Real Asana tasks replace the sample Asana items; manual + github
          // tasks are preserved.
          tasks: [...realTasks, ...s.tasks.filter((t) => t.origin !== "asana")],
          devs,
          asanaState: "connected" as AsanaConnState,
          asanaUser: resp.user?.name ?? null,
          asanaError: null,
        };
      });
      get().pushToast({
        icon: "sync",
        title: `Loaded ${resp.tasks.length} Asana task${resp.tasks.length === 1 ? "" : "s"}`,
        subtitle: resp.user?.name ? `Connected as ${resp.user.name}` : "Asana connected",
      });
      void enqueueAutoAuthor(set, get, "asana");
    } catch (e) {
      set({ asanaState: "error", asanaError: (e as Error).message });
    }
  },

  loadGithub: async () => {
    set({ githubState: "loading" });
    try {
      const resp = await fetchGithubIssues();
      if (!resp.connected) {
        set({
          githubState: resp.reason === "no_token" ? "no_token" : "error",
          githubError: resp.error ?? null,
        });
        return;
      }
      const { products } = get();
      set((s) => {
        // Add each issue's counterpart (the dev, not you) to the dev list so
        // attribution + group-by-dev are correct; unknown logins become
        // synthetic devs. Functional set → race-safe with loadAsana().
        const devs = [...s.devs];
        const byName = new Map(devs.map((d) => [d.name.toLowerCase(), d]));
        for (const it of resp.issues) {
          const who = (it.counterpart || "").trim();
          if (who && !byName.has(who.toLowerCase())) {
            const nd = {
              id: `dev-gh-${who.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
              name: who,
              role: "GitHub dev",
              slackHandle: "",
            };
            devs.push(nd);
            byName.set(who.toLowerCase(), nd);
          }
        }
        const realTasks = resp.issues.map((it) => githubIssueToTask(it, products, devs));
        return {
          // Real issues replace prior github tasks; asana + manual preserved.
          tasks: [...realTasks, ...s.tasks.filter((t) => t.origin !== "github")],
          devs,
          githubState: "connected" as AsanaConnState,
          githubUser: resp.user?.name || resp.user?.login || null,
          githubLogin: resp.user?.login || null,
          githubError: null,
        };
      });
      get().pushToast({
        icon: "sync",
        title: `Loaded ${resp.issues.length} GitHub issue${resp.issues.length === 1 ? "" : "s"}`,
        subtitle:
          resp.repo && resp.repo !== "(involves:me)"
            ? resp.repo
            : resp.user?.login
              ? `Connected as ${resp.user.login}`
              : "GitHub connected",
      });
      void enqueueAutoAuthor(set, get, "github");
    } catch (e) {
      set({ githubState: "error", githubError: (e as Error).message });
    }
  },

  loadSlack: async () => {
    set({ slackState: "loading" });
    try {
      const resp = await fetchSlackMessages();
      if (!resp.connected) {
        set({
          slackState: resp.reason === "no_token" ? "no_token" : "error",
          slackError: resp.error ?? null,
        });
        return;
      }
      const { products } = get();
      // Race-safe with loadAsana()/loadGithub(): the functional set only
      // replaces slack-origin tasks and merges any new Slack authors as devs.
      set((s) => {
        const devs = [...s.devs];
        const byName = new Map(devs.map((d) => [d.name.toLowerCase(), d]));
        for (const m of resp.messages) {
          const who = (m.author || "").trim();
          if (who && !byName.has(who.toLowerCase())) {
            const nd = {
              id: `dev-slack-${who.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
              name: who,
              role: "Slack teammate",
              slackHandle: "",
            };
            devs.push(nd);
            byName.set(who.toLowerCase(), nd);
          }
        }
        const realTasks = resp.messages.map((m) => slackMessageToTask(m, products, devs));
        return {
          tasks: [...realTasks, ...s.tasks.filter((t) => t.origin !== "slack")],
          devs,
          slackState: "connected" as AsanaConnState,
          slackUser: resp.team ?? null,
          slackError: null,
        };
      });
      get().pushToast({
        icon: "sync",
        title: `Loaded ${resp.messages.length} Slack request${resp.messages.length === 1 ? "" : "s"}`,
        subtitle: resp.channel ? `Watching ${resp.channel}` : "Slack connected",
      });
      void enqueueAutoAuthor(set, get, "slack");
    } catch (e) {
      set({ slackState: "error", slackError: (e as Error).message });
    }
  },

  openEditor: (taskId) => set({ editorTaskId: taskId }),
  closeEditor: () => set({ editorTaskId: null }),
  openArtifact: (testId, kind) => set({ artifactModal: { testId, kind } }),
  closeArtifact: () => set({ artifactModal: null }),
}));

function devRespond(
  set: (fn: (s: State) => Partial<State>) => void,
  get: () => State,
  taskId: string,
  toastTitle: string,
) {
  const task = taskById(get().tasks, taskId);
  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: t.status === "reported" ? ("verifying" as const) : t.status,
            devResponded: new Date().toISOString(),
            activity: [
              ...t.activity,
              {
                id: aid(),
                icon: "comment" as const,
                html: `<b>${s.devs.find((d) => d.id === t.devId)?.name ?? "The dev"}</b> commented: fixed, ready for re-test`,
                at: new Date().toISOString(),
              },
            ],
          }
        : t,
    ),
    issues: s.issues.map((iss) =>
      iss.taskId === taskId && iss.state !== "closed" ? { ...iss, state: "dev-responded" as const } : iss,
    ),
  }));
  get().pushToast({ icon: "check", title: toastTitle, subtitle: task?.title ?? "" });
}

function s_repoName(state: State, repoId: string) {
  return state.repos.find((r) => r.id === repoId)?.name ?? repoId;
}

// ── AI QA authoring helpers ─────────────────────────────────────────────────

const AUTO_AUTHOR_KEY = "testpilot.autoAuthor";

function readAutoAuthor(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_AUTHOR_KEY);
    return raw === null ? true : raw === "true"; // default on
  } catch {
    return true;
  }
}

function writeAutoAuthor(v: boolean): void {
  try {
    localStorage.setItem(AUTO_AUTHOR_KEY, String(v));
  } catch {
    /* localStorage unavailable — in-memory only */
  }
}

/** Map the app Task → the PlanInput the AI planner reads. */
function buildPlanInput(task: Task, products: Product[]): PlanInput {
  const product = products.find((p) => p.id === task.productId);
  return {
    title: task.title,
    description: task.description,
    acceptanceCriteria: task.acceptanceCriteria,
    type: task.type,
    priority: task.priority,
    brand: product?.brand,
    productName: product?.name,
    origin: task.origin,
    pr: task.pr || undefined,
    branch: task.branch || undefined,
    environment: task.environment || undefined,
    links: {
      pullRequest: task.links.pullRequest || undefined,
      repository: task.links.repository || undefined,
      staging: task.links.staging,
      design: task.links.design,
      pitchDoc: task.links.pitchDoc,
    },
    defaultFrameworkId: defaultFrameworkFor(task.productId, product?.brand),
  };
}

// A generated scenario maps onto a TestCase so the existing Playwright card /
// Stepper / Run-tests flow renders the AI-authored cases with no UI changes.
const AREA_TO_PHASE: Record<TestArea, Phase> = {
  ui: "ui",
  unit: "unit",
  functional: "functional",
  "cross-browser": "smoke",
  responsive: "ui",
  a11y: "a11y",
  perf: "perf",
  regression: "regression",
};

function scenariosToTestCases(scenarios: TestScenario[], specs: GeneratedSpec[]): TestCase[] {
  const file = specs[0]?.filename ?? "ai-generated.spec.ts";
  return scenarios.map((sc) => ({
    id: `qa-${sc.id}`,
    name: `${sc.id} · ${sc.title}`,
    file,
    phase: AREA_TO_PHASE[sc.area] ?? "functional",
    tag: sc.type,
    status: "queued" as const,
    history: [],
  }));
}

function setAuthoring(
  set: (fn: (s: State) => Partial<State>) => void,
  taskId: string,
  patch: Partial<QaAuthoring>,
) {
  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === taskId ? { ...t, qaAuthoring: { ...(t.qaAuthoring ?? { status: "idle" }), ...patch } } : t,
    ),
  }));
}

function setArtifact(
  set: (fn: (s: State) => Partial<State>) => void,
  taskId: string,
  key: keyof TestArtifacts,
  val: boolean,
) {
  set((s) => ({
    tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, testArtifacts: { ...t.testArtifacts, [key]: val } } : t)),
  }));
}

/** Cache /api/ai/status once — gates auto-authoring so we don't fire Claude
 *  calls when nothing is configured. */
async function ensureAiReady(
  set: (fn: (s: State) => Partial<State>) => void,
  get: () => State,
): Promise<boolean> {
  const cached = get().aiReady;
  if (cached !== null) return cached;
  try {
    const s = await fetchAiStatus();
    set(() => ({ aiReady: s.ready }));
    return s.ready;
  } catch {
    set(() => ({ aiReady: false }));
    return false;
  }
}

// Auto-author queue: a sync of N new tasks enqueues them and authors ONE AT A
// TIME (concurrency 1) so we never fire N bursts of Claude calls at once. Tasks
// already authored (have qaAuthoring) are skipped, so re-syncs only pick up the
// genuinely new ones.
const authorQueue: string[] = [];
let authorDraining = false;
// Task ids auto-authored this session. Connector Refresh rebuilds task objects
// (dropping in-memory qaAuthoring), so without this a refresh would re-author
// every task. Ids are stable across refreshes (Asana gid / GitHub repo#number /
// Slack ts), so each task auto-authors at most once per session.
const autoAuthoredIds = new Set<string>();

async function drainAuthorQueue(get: () => State): Promise<void> {
  if (authorDraining) return;
  authorDraining = true;
  let authored = 0;
  try {
    while (authorQueue.length) {
      const id = authorQueue.shift() as string;
      const t = taskById(get().tasks, id);
      if (!t || t.qaAuthoring) continue;
      await get().authorQaPlan(id, { silent: true });
      const after = taskById(get().tasks, id)?.qaAuthoring;
      if (after?.status === "error") {
        // A credential / billing / config error repeats for every queued task —
        // stop the burst and surface it ONCE instead of one toast per task.
        authorQueue.length = 0;
        get().pushToast({ icon: "issue", title: "Auto-authoring paused", subtitle: after.error ?? "QA authoring failed" });
        break;
      }
      authored++;
    }
  } finally {
    authorDraining = false;
  }
  if (authored > 0) {
    get().pushToast({
      icon: "generate",
      title: `Auto-authored ${authored} QA plan${authored === 1 ? "" : "s"}`,
      subtitle: "Plan · scenarios · Playwright cases · Excel",
    });
  }
}

async function enqueueAutoAuthor(
  set: (fn: (s: State) => Partial<State>) => void,
  get: () => State,
  origin: TaskOrigin,
): Promise<void> {
  if (!get().autoAuthor) return;
  if (!(await ensureAiReady(set, get))) return;
  const ids = get()
    .tasks.filter((t) => t.origin === origin && !t.qaAuthoring && !autoAuthoredIds.has(t.id))
    .map((t) => t.id);
  for (const id of ids) {
    if (authorQueue.includes(id)) continue;
    authorQueue.push(id);
    autoAuthoredIds.add(id);
  }
  void drainAuthorQueue(get);
}

function generateTestsForTask(
  set: (fn: (s: State) => Partial<State>) => void,
  get: () => State,
  taskId: string,
  toastTitle: string,
) {
  const phases: Phase[] = ["ui", "functional", "smoke", "regression"];
  const task = taskById(get().tasks, taskId);
  if (!task) return;
  const tests: TestCase[] = phases.map((phase, i) => ({
    id: `${taskId}-gen-${i}`,
    name: `${PHASE_NAME_HINT[phase]} for "${task.title.slice(0, 40)}"`,
    file: `${task.branch.split("/").pop()}.spec.ts`,
    phase,
    status: "queued",
    history: [],
  }));
  const fromDoc = !!task.links.pitchDoc;
  const activityHtml = fromDoc
    ? "Authored a phased Playwright plan from the <b>pitch doc</b> + acceptance criteria"
    : toastTitle;
  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            tests,
            status: "ready",
            activity: [
              ...t.activity,
              { id: aid(), icon: "run", html: activityHtml, at: new Date().toISOString() },
            ],
          }
        : t,
    ),
  }));
  get().pushToast({ icon: "generate", title: fromDoc ? "Test plan authored from docs" : toastTitle, subtitle: task.title });
}

const PHASE_NAME_HINT: Record<Phase, string> = {
  ui: "Renders UI",
  unit: "Unit coverage",
  functional: "Functional check",
  smoke: "Smoke check",
  a11y: "Accessibility check",
  perf: "Performance check",
  regression: "Regression check",
};

// ── QA pipeline orchestration ───────────────────────────────────────────────
// A thin driver over the existing actions (generateFromTask / runTestPlan /
// fileIssue / simulateDevFix / postPrReport). runStage runs ONE stage and, in
// auto mode, chains to the next when the stage settles — driven by runTestPlan's
// onSettle callback so an in-flight pipeline survives navigation (no reliance on
// a mounted screen). Manual mode runs one stage per call.

const STORE_SET_DELAY = 500;

function seedPipeline(mode: "auto" | "manual", docsReady: boolean): QaPipeline {
  const now = new Date().toISOString();
  const stages: QaStage[] = QA_STAGE_ORDER.map((key) => ({
    key,
    status: key === "docs" && docsReady ? "done" : "idle",
    at: key === "docs" && docsReady ? now : null,
  }));
  return { running: false, mode, currentStage: null, stages, smokePassed: null, regressionPassed: null, prReport: null, asanaComment: null };
}

function mutatePipeline(
  set: (fn: (s: State) => Partial<State>) => void,
  taskId: string,
  fn: (p: QaPipeline) => QaPipeline,
) {
  set((s) => ({
    tasks: s.tasks.map((t) => (t.id === taskId && t.qaPipeline ? { ...t, qaPipeline: fn(t.qaPipeline) } : t)),
  }));
}

function markStage(
  set: (fn: (s: State) => Partial<State>) => void,
  taskId: string,
  key: QaStageKey,
  status: QaStageStatus,
) {
  mutatePipeline(set, taskId, (p) => ({
    ...p,
    currentStage: status === "active" || status === "paused" ? key : p.currentStage,
    stages: p.stages.map((st) => (st.key === key ? { ...st, status, at: new Date().toISOString() } : st)),
  }));
}

function appendActivity(
  set: (fn: (s: State) => Partial<State>) => void,
  taskId: string,
  icon: Task["activity"][number]["icon"],
  html: string,
) {
  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === taskId
        ? { ...t, activity: [...t.activity, { id: aid(), icon, html, at: new Date().toISOString() }] }
        : t,
    ),
  }));
}

function buildIssueDraft(get: () => State, task: Task) {
  const failedTest = task.tests.find((t) => t.status === "failed");
  const product = get().products.find((p) => p.id === task.productId);
  return {
    title: failedTest ? `${failedTest.name} fails` : `${task.title} — QA failure`,
    body: failedTest
      ? `\`${failedTest.name}\` fails.\n\nSee spec \`${failedTest.file}\`.\n\n${failedTest.error?.message ?? ""}`
      : "",
    repoId: product?.repoId ?? get().repos[0]?.id ?? "",
  };
}

function postPrReport(
  set: (fn: (s: State) => Partial<State>) => void,
  get: () => State,
  taskId: string,
  verdict: PrReport["verdict"],
) {
  const task = taskById(get().tasks, taskId);
  if (!task) return;
  const pipeline = task.qaPipeline;
  const passed = task.tests.filter((t) => t.status === "passed").length;
  const failed = task.tests.filter((t) => t.status === "failed").length;
  const blocked = task.tests.filter((t) => t.status === "blocked").length;
  const product = get().products.find((p) => p.id === task.productId);
  const reportStage = pipeline?.stages.find((st) => st.key === "report");
  const issueNumbers = reportStage?.status === "done" && task.issue ? [task.issue.number] : [];
  const now = new Date().toISOString();

  const report: PrReport = {
    postedAt: now,
    prNumber: task.pr,
    repoId: product?.repoId ?? null,
    summary: `${passed} passed · ${failed} failed`,
    passed,
    failed,
    blocked,
    smoke: pipeline?.smokePassed ? "passed" : "skipped",
    regression: pipeline?.regressionPassed ? "passed" : "skipped",
    issueNumbers,
    verdict,
  };

  set((s) => ({
    tasks: s.tasks.map((t) => {
      if (t.id !== taskId || !t.qaPipeline) return t;
      return {
        ...t,
        qaPipeline: {
          ...t.qaPipeline,
          running: false,
          currentStage: null,
          prReport: report,
          stages: t.qaPipeline.stages.map((st) => (st.key === "verified" ? { ...st, status: "done", at: now } : st)),
        },
        activity: [
          ...t.activity,
          {
            id: aid(),
            icon: "issue" as const,
            html:
              verdict === "verified"
                ? `Posted QA status to <b>PR #${task.pr}</b> — <b>${passed} passed</b> · smoke ✓ · regression ✓`
                : `Posted QA status to <b>PR #${task.pr}</b> — <b>${failed} failed</b>, issue filed`,
            at: now,
          },
        ],
      };
    }),
    notifications: [
      {
        id: `n-${Date.now()}`,
        kind: verdict === "verified" ? ("verified" as const) : ("issue-filed" as const),
        html:
          verdict === "verified"
            ? `QA pipeline reported <b>green</b> to <b>PR #${task.pr}</b>`
            : `QA pipeline reported a <b>blocker</b> to <b>PR #${task.pr}</b>`,
        at: now,
        unread: true,
        route: `/queue/${taskId}`,
      },
      ...s.notifications,
    ],
  }));

  get().pushToast(
    verdict === "verified"
      ? { icon: "verify", title: `Reported to PR #${task.pr}`, subtitle: "Verified — smoke & regression green" }
      : { icon: "issue", title: `Reported to PR #${task.pr}`, subtitle: "Blocker filed" },
  );

  // Close the loop back on the source Asana task (simulated).
  if (task.asana) postAsanaComment(set, get, taskId, verdict);
}

function postAsanaComment(
  set: (fn: (s: State) => Partial<State>) => void,
  get: () => State,
  taskId: string,
  verdict: AsanaComment["verdict"],
) {
  const task = taskById(get().tasks, taskId);
  if (!task || !task.asana) return;
  const passed = task.tests.filter((t) => t.status === "passed").length;
  const failed = task.tests.filter((t) => t.status === "failed").length;
  const issueNumbers = task.qaPipeline?.prReport?.issueNumbers ?? (task.issue ? [task.issue.number] : []);
  const now = new Date().toISOString();

  // On a clean verdict with no bugs, QA marks the Asana task complete.
  const markComplete = verdict === "verified" && failed === 0;

  const body =
    verdict === "verified"
      ? `✅ QA verified & validated. ${passed} checks passed across smoke + regression.${
          issueNumbers.length ? ` Fixed issues: ${issueNumbers.map((n) => `#${n}`).join(", ")} (verified & closed).` : ""
        } Marking this task complete.`
      : `⚠️ QA found blockers. Filed ${issueNumbers.map((n) => `#${n}`).join(", ") || "issue(s)"} in GitHub, assigned back to the dev. Will re-verify after the fix.`;

  const comment: AsanaComment = {
    postedAt: now,
    gid: task.asana.gid,
    url: task.asana.url,
    verdict,
    body,
    passed,
    failed,
    issueNumbers,
  };

  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === taskId && t.qaPipeline && t.asana
        ? {
            ...t,
            asana: { ...t.asana, completed: markComplete ? true : t.asana.completed },
            qaPipeline: { ...t.qaPipeline, asanaComment: comment },
            activity: [
              ...t.activity,
              {
                id: aid(),
                icon: "comment" as const,
                html: `Commented on the <b>Asana task</b> — ${verdict === "verified" ? "verified &amp; validated ✓" : "blockers filed"}`,
                at: now,
              },
              ...(markComplete
                ? [
                    {
                      id: aid(),
                      icon: "check" as const,
                      html: "Marked the <b>Asana task complete</b> ✓",
                      at: now,
                    },
                  ]
                : []),
            ],
          }
        : t,
    ),
  }));

  get().pushToast({
    icon: markComplete ? "verify" : "check",
    title: markComplete ? "Asana task marked complete" : "Commented on Asana",
    subtitle: verdict === "verified" ? "Verified & validated" : "Blockers reported",
  });
}

const QA_NEXT: Record<QaStageKey, QaStageKey | null> = {
  docs: "generate",
  generate: "execute",
  execute: "report",
  report: "devfix",
  devfix: "smoke",
  smoke: "regression",
  regression: "verified",
  verified: null,
};

function scheduleNext(
  set: (fn: (s: State) => Partial<State>) => void,
  get: () => State,
  taskId: string,
  stage: QaStageKey,
  delay = STORE_SET_DELAY,
) {
  const next = QA_NEXT[stage];
  if (!next) return;
  setTimeout(() => runStage(set, get, taskId, next, true), delay);
}

function runStage(
  set: (fn: (s: State) => Partial<State>) => void,
  get: () => State,
  taskId: string,
  stage: QaStageKey,
  auto: boolean,
) {
  const task = taskById(get().tasks, taskId);
  if (!task) return;

  switch (stage) {
    case "docs": {
      markStage(set, taskId, "docs", "done");
      if (auto) scheduleNext(set, get, taskId, "docs", 250);
      return;
    }

    case "generate": {
      markStage(set, taskId, "generate", "active");
      const hadTests = task.tests.length > 0;
      if (!hadTests) get().generateFromTask(taskId);
      // Seed a functional-phase failure on a freshly generated auto run so the
      // full fail → fix → smoke → regression arc is exercised.
      if (auto && !hadTests) {
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId || t.failIndex !== null) return t;
            const ordered = [...t.tests].sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));
            const fnIdx = ordered.findIndex((x) => x.phase === "functional");
            return { ...t, failIndex: fnIdx >= 0 ? fnIdx : null };
          }),
        }));
      }
      markStage(set, taskId, "generate", "done");
      if (auto) scheduleNext(set, get, taskId, "generate");
      return;
    }

    case "execute": {
      markStage(set, taskId, "execute", "active");
      get().runTestPlan(taskId, "run", ({ failed }) => {
        if (failed) {
          markStage(set, taskId, "execute", "failed");
          if (auto) scheduleNext(set, get, taskId, "execute");
        } else {
          markStage(set, taskId, "execute", "done");
          markStage(set, taskId, "report", "skipped");
          markStage(set, taskId, "devfix", "skipped");
          if (auto) setTimeout(() => runStage(set, get, taskId, "smoke", true), STORE_SET_DELAY);
        }
      });
      return;
    }

    case "report": {
      markStage(set, taskId, "report", "active");
      const existing = get().issues.find((iss) => iss.taskId === taskId && iss.state !== "closed");
      if (!existing) get().fileIssue(taskId, buildIssueDraft(get, task));
      markStage(set, taskId, "report", "done");
      if (auto) scheduleNext(set, get, taskId, "report", 900);
      return;
    }

    case "devfix": {
      markStage(set, taskId, "devfix", "active");
      // Dev comments on the filed issue (flips status → verifying); we then
      // re-verify that issue and close it if the fix holds.
      get().simulateDevFix(taskId);
      get().runTestPlan(taskId, "verify", () => {
        markStage(set, taskId, "devfix", "done");
        // Gate: smoke + regression only run once every issue is closed.
        const openIssues = get().issues.filter((iss) => iss.taskId === taskId && iss.state !== "closed");
        if (openIssues.length === 0) {
          appendActivity(set, taskId, "check", "All issues closed ✓ — cleared to run smoke &amp; regression");
          if (auto) scheduleNext(set, get, taskId, "devfix", 700);
        } else {
          // Fix didn't hold — hold at devfix for another dev comment.
          markStage(set, taskId, "devfix", "paused");
          appendActivity(set, taskId, "flag", `${openIssues.length} issue(s) still open — awaiting another dev fix`);
        }
      });
      return;
    }

    case "smoke": {
      // Guard: never run smoke while an issue is still open.
      const stillOpen = get().issues.filter((iss) => iss.taskId === taskId && iss.state !== "closed");
      if (stillOpen.length > 0) {
        markStage(set, taskId, "devfix", "paused");
        return;
      }
      markStage(set, taskId, "smoke", "active");
      get().runTestPlan(taskId, "verify", () => {
        mutatePipeline(set, taskId, (p) => ({ ...p, smokePassed: true }));
        markStage(set, taskId, "smoke", "done");
        if (auto) scheduleNext(set, get, taskId, "smoke");
      });
      return;
    }

    case "regression": {
      markStage(set, taskId, "regression", "active");
      get().runTestPlan(taskId, "verify", () => {
        mutatePipeline(set, taskId, (p) => ({ ...p, regressionPassed: true }));
        markStage(set, taskId, "regression", "done");
        if (auto) setTimeout(() => runStage(set, get, taskId, "verified", true), STORE_SET_DELAY);
      });
      return;
    }

    case "verified": {
      markStage(set, taskId, "verified", "active");
      postPrReport(set, get, taskId, "verified");
      return;
    }
  }
}
