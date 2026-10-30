import { useMemo, useState } from "react";
import { Database as DatabaseIcon, Download, Lock, ShieldCheck, Unlock } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card, EyebrowLabel } from "@/components/ui/primitives";
import { verifyPassword } from "@/lib/users";

// Admin-only viewer over the app's local data (browser state + localStorage).
// Route-gated to admin AND unlocked with the admin's password (defence in depth).
// This is a browser-only tool — the data lives in localStorage, so this is a
// convenient admin console, not a hardened database. Read-only.

type TabKey = "users" | "tasks" | "issues" | "saved" | "storage";

const TABS: { key: TabKey; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "tasks", label: "Tasks" },
  { key: "issues", label: "Issues" },
  { key: "saved", label: "Saved tests" },
  { key: "storage", label: "Storage" },
];

const cellCls = "px-3 py-2 text-[12px] text-ink-2 align-top";
const headCls = "px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground";

function Table({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-control border border-border">
      <table className="w-full border-collapse">
        <thead className="border-b border-border bg-surface-2">
          <tr>
            {columns.map((c) => (
              <th key={c} className={headCls}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={cellCls} colSpan={columns.length}>
                <span className="text-muted-foreground">No rows.</span>
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-b-0 hover:bg-surface-1">
                {r.map((v, j) => (
                  <td key={j} className={cellCls}>
                    {String(v)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Database() {
  // zustand: select raw slices, derive in render (never return .find() from a selector).
  const usersAll = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const tasks = useStore((s) => s.tasks);
  const issues = useStore((s) => s.issues);
  const savedTests = useStore((s) => s.savedTests);
  const me = usersAll.find((u) => u.id === currentUserId);

  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("users");

  const unlock = async () => {
    if (busy || !me) return;
    // verifyPassword() returns true for accounts with no hash (demo default), which
    // would let an in-app-created admin unlock with ANY password. Fail closed here.
    if (!me.passwordHash) {
      setErr("Set a password on your account (Users & Team → your profile) before accessing the Database.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const ok = await verifyPassword(me, pw);
      if (ok) {
        setUnlocked(true);
        setPw("");
      } else {
        setErr("Incorrect password.");
      }
    } finally {
      setBusy(false);
    }
  };

  const storageRows = useMemo(() => {
    const rows: (string | number)[][] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("testpilot.")) continue;
        const val = localStorage.getItem(key) ?? "";
        rows.push([key, `${(val.length / 1024).toFixed(1)} KB`, val.length > 80 ? `${val.slice(0, 80)}…` : val]);
      }
    } catch {
      /* ignore */
    }
    return rows;
  }, [unlocked]);

  const exportSnapshot = () => {
    const snapshot: Record<string, unknown> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("testpilot.")) continue;
        const raw = localStorage.getItem(key) ?? "";
        try {
          const parsed = JSON.parse(raw);
          // Never export password material — redact it just like the on-screen table.
          if (key === "testpilot.users" && Array.isArray(parsed)) {
            snapshot[key] = parsed.map((u) =>
              u && typeof u === "object" ? { ...u, passwordHash: u.passwordHash ? "set" : "not set" } : u,
            );
          } else {
            snapshot[key] = parsed;
          }
        } catch {
          snapshot[key] = raw;
        }
      }
    } catch {
      /* ignore */
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "testpilot-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!unlocked) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="w-full max-w-[380px] p-6">
          <div className="mb-4 flex flex-col items-center text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-card bg-primary/10 text-primary">
              <Lock size={20} />
            </div>
            <h1 className="m-0 text-[19px] font-bold tracking-tight">Database access</h1>
            <p className="m-0 mt-1 text-[12.5px] text-muted-foreground">
              Admin-only. Re-enter your password to view the app data.
            </p>
          </div>
          <input
            type="password"
            autoFocus
            value={pw}
            placeholder="Your password"
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            className="w-full rounded-control border border-border bg-surface-1 px-3 py-2.5 text-[13.5px] text-ink-1 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
          {err && <div className="mt-2 text-[12px] font-medium text-destructive">{err}</div>}
          <Button variant="primary" className="mt-3 w-full justify-center" disabled={busy} onClick={unlock}>
            <Unlock size={15} /> Unlock
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseIcon size={20} className="text-primary" />
            <h1 className="m-0 text-[24px] font-bold tracking-tight">Database</h1>
          </div>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Local application data (browser storage). Admin-only, read-only.
          </p>
        </div>
        <Button variant="outline" onClick={exportSnapshot}>
          <Download size={14} /> Export JSON
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2.5 rounded-control border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-primary/5 px-3.5 py-2.5 text-[12px] text-ink-2">
        <ShieldCheck size={15} className="shrink-0 text-primary" />
        This tool has no backend — data lives in your browser's localStorage. This view is convenient admin access, not a
        hardened database. Passwords are shown only as "set / not set", never in plaintext.
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "rounded-control bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground"
                : "rounded-control border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:bg-surface-2"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <EyebrowLabel className="mb-3">
          {TABS.find((t) => t.key === tab)?.label} ·{" "}
          {tab === "users"
            ? usersAll.length
            : tab === "tasks"
              ? tasks.length
              : tab === "issues"
                ? issues.length
                : tab === "saved"
                  ? savedTests.length
                  : storageRows.length}{" "}
          rows
        </EyebrowLabel>

        {tab === "users" && (
          <Table
            columns={["Name", "Email", "Role", "Active", "Password"]}
            rows={usersAll.map((u) => [u.name, u.email, u.role, u.active ? "yes" : "no", u.passwordHash ? "set" : "not set"])}
          />
        )}
        {tab === "tasks" && (
          <Table
            columns={["ID", "Title", "Origin", "Status", "Ownership"]}
            rows={tasks.map((t) => [t.id, t.title, t.origin, t.status, t.ownership])}
          />
        )}
        {tab === "issues" && (
          <Table columns={["Number", "Title", "State"]} rows={issues.map((i) => [`#${i.number}`, i.title, i.state])} />
        )}
        {tab === "saved" && (
          <Table
            columns={["Name", "URL", "Env", "Browser", "Saved"]}
            rows={savedTests.map((s) => [s.name, s.url, s.env ?? "—", s.project ?? "—", new Date(s.savedAt).toLocaleString()])}
          />
        )}
        {tab === "storage" && <Table columns={["Key", "Size", "Preview"]} rows={storageRows} />}
      </Card>
    </div>
  );
}
