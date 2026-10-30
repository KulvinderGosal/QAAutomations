import { useState } from "react";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Avatar, Button, Card, EyebrowLabel } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { hasPassword, makePasswordHash, ROLE_LABEL, ROLE_ORDER } from "@/lib/users";
import type { AppUser, Role } from "@/types";

const inputCls =
  "w-full rounded-control border border-border bg-surface-1 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";

export function Users() {
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const updateUser = useStore((s) => s.updateUser);
  const addUser = useStore((s) => s.addUser);
  const removeUser = useStore((s) => s.removeUser);

  const me = users.find((u) => u.id === currentUserId);
  const isAdmin = me?.role === "admin";
  // Count only ACTIVE admins — a deactivated admin can't sign in, so they don't
  // keep the "last admin" guard satisfied.
  const adminCount = users.filter((u) => u.role === "admin" && u.active).length;

  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<AppUser | null>(null);
  const [draft, setDraft] = useState<{ name: string; email: string; role: Role; title: string; password: string }>({
    name: "",
    email: "",
    role: "dev",
    title: "",
    password: "",
  });
  // Per-row password reset (admin provisioning). pwFor = the user id being edited.
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwVal, setPwVal] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const pwTooShort = !!draft.password && draft.password.length < 6;

  const submitAdd = async () => {
    if (!draft.name.trim() || pwTooShort) return;
    const pw = draft.password.trim();
    const passwordHash = pw ? await makePasswordHash(pw) : undefined;
    addUser({ name: draft.name.trim(), email: draft.email.trim(), role: draft.role, title: draft.title.trim() || ROLE_LABEL[draft.role], active: true, passwordHash });
    setDraft({ name: "", email: "", role: "dev", title: "", password: "" });
    setAdding(false);
  };

  const savePassword = async (id: string) => {
    if (pwVal.trim().length < 6) return;
    setPwBusy(true);
    try {
      const hash = await makePasswordHash(pwVal.trim());
      updateUser(id, { passwordHash: hash });
      setPwFor(null);
      setPwVal("");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-bold tracking-tight">Users &amp; Team</h1>
          <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
            Manage QA engineers and developers, their roles, and your own profile.
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={() => setAdding((v) => !v)}>
            <UserPlus size={15} /> Add teammate
          </Button>
        )}
      </div>

      {/* Your profile */}
      {me && (
        <Card className="mb-5 p-4">
          <EyebrowLabel className="mb-3">Your profile</EyebrowLabel>
          <div className="flex items-start gap-4">
            <Avatar name={me.name} size={52} />
            <div className="grid flex-1 grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Name</span>
                <input className={inputCls} value={me.name} onChange={(e) => updateUser(me.id, { name: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Title</span>
                <input className={inputCls} value={me.title} onChange={(e) => updateUser(me.id, { title: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Email</span>
                <input className={inputCls} value={me.email} onChange={(e) => updateUser(me.id, { email: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Role</span>
                <input className={`${inputCls} opacity-70`} value={ROLE_LABEL[me.role]} readOnly />
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* Add form */}
      {isAdmin && adding && (
        <Card className="mb-5 p-4">
          <EyebrowLabel className="mb-3">New teammate</EyebrowLabel>
          <div className="grid grid-cols-4 gap-3">
            <input className={inputCls} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input className={inputCls} placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            <input className={inputCls} placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <select className={inputCls} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            <input
              className={`${inputCls} ${pwTooShort ? "border-destructive" : ""}`}
              type="password"
              autoComplete="new-password"
              placeholder="Initial password (min 6)"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
            <p className="col-span-3 self-center text-[11.5px] text-muted-foreground">
              Optional. If blank, the teammate can't sign in until they set one via &ldquo;Forgot password?&rdquo; or you reset it here.
            </p>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={!draft.name.trim() || pwTooShort} onClick={submitAdd}>
              Add
            </Button>
          </div>
        </Card>
      )}

      {/* Team */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <h2 className="m-0 text-[13.5px] font-semibold">Team</h2>
          <span className="text-[11.5px] text-muted-foreground">{users.length} people</span>
        </div>
        <div className="flex flex-col">
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            // Only an ACTIVE last admin is protected. An inactive admin can't be the
            // one keeping admin access alive, so it stays freely removable/demotable
            // (matching the store's leavesNoActiveAdmin guard).
            const lastAdmin = u.role === "admin" && u.active && adminCount <= 1;
            return (
              <div key={u.id} className="border-b border-border last:border-b-0">
                <div className="flex items-center gap-3 px-4 py-3">
                <Avatar name={u.name} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-1">
                    {u.name}
                    {isSelf && <span className="rounded-chip bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">You</span>}
                    {!u.active && <span className="rounded-chip bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">Inactive</span>}
                    {!hasPassword(u) && <span className="rounded-chip bg-[var(--caution)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--caution)]" title="This teammate can't sign in until a password is set">No password</span>}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {u.title} · {u.email}
                  </div>
                </div>

                {isAdmin ? (
                  <select
                    value={u.role}
                    disabled={lastAdmin || isSelf}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}
                    className="rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1 outline-none disabled:opacity-60"
                    title={isSelf ? "Change your own role from your profile card above" : lastAdmin ? "Can't change the only admin's role" : "Change role"}
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-chip bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-ink-2">{ROLE_LABEL[u.role]}</span>
                )}

                {isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        setPwFor(pwFor === u.id ? null : u.id);
                        setPwVal("");
                      }}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control border text-muted-foreground hover:bg-surface-2 ${pwFor === u.id ? "border-primary text-primary" : "border-border"}`}
                      title={hasPassword(u) ? "Reset password" : "Set password"}
                    >
                      <KeyRound size={13} />
                    </button>
                    <button
                      onClick={() => updateUser(u.id, { active: !u.active })}
                      disabled={isSelf || (u.active && lastAdmin)}
                      className="rounded-control border border-border px-2 py-1 text-[11.5px] font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40"
                      title={isSelf ? "You can't deactivate yourself" : u.active && lastAdmin ? "Can't deactivate the only admin" : u.active ? "Deactivate" : "Activate"}
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(u)}
                      disabled={isSelf || lastAdmin}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border text-muted-foreground hover:bg-surface-2 disabled:opacity-40"
                      title={isSelf ? "You can't remove yourself" : lastAdmin ? "Can't remove the only admin" : "Remove"}
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
                </div>
                {isAdmin && pwFor === u.id && (
                  <div className="flex items-center gap-2 px-4 pb-3">
                    <KeyRound size={13} className="shrink-0 text-muted-foreground" />
                    <input
                      className={`${inputCls} max-w-[260px]`}
                      type="password"
                      autoComplete="new-password"
                      placeholder={`New password for ${u.name.split(" ")[0]} (min 6)`}
                      value={pwVal}
                      onChange={(e) => setPwVal(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && savePassword(u.id)}
                      autoFocus
                    />
                    <Button variant="primary" size="sm" disabled={pwVal.trim().length < 6 || pwBusy} onClick={() => savePassword(u.id)}>
                      {hasPassword(u) ? "Reset" : "Set"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setPwFor(null); setPwVal(""); }}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {!isAdmin && (
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Only admins can add, remove, or change roles. You can edit your own profile above.
        </p>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
        title="Remove teammate"
        destructive
        confirmLabel="Remove"
        message={
          <>
            Remove <b className="font-semibold text-ink-1">{confirmRemove?.name}</b> ({confirmRemove?.email}) from the
            team? They'll lose access and any work assigned to them stays put. This can't be undone.
          </>
        }
        onConfirm={() => {
          if (confirmRemove) removeUser(confirmRemove.id);
          setConfirmRemove(null);
        }}
      />
    </div>
  );
}
