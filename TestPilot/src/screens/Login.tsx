import { useState } from "react";
import { KeyRound, Loader2, Lock, LogIn, Mail } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/primitives";
import { PushEngageLogo } from "@/components/icons/PushEngageLogo";
import { hasPassword, makePasswordHash, verifyPassword } from "@/lib/users";

// Sign-in gate. Email + password against the local user store. Passwords are
// checked against a salted hash (see lib/users). NOT a real backend — a local,
// "secure enough" gate for this browser-only tool.
export function Login() {
  const allUsers = useStore((s) => s.users);
  const users = allUsers.filter((u) => u.active);
  const signIn = useStore((s) => s.signIn);
  const updateUser = useStore((s) => s.updateUser);

  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputCls =
    "w-full rounded-control border border-border bg-surface-1 py-2.5 pl-9 pr-3 text-[13.5px] text-ink-1 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

  const findUser = () => users.find((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());

  const submit = async () => {
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const user = findUser();
      if (!user) {
        setError("No active account with that email.");
        return;
      }
      if (!hasPassword(user)) {
        setError('This account has no password yet. Use "Forgot password?" below to set one, or ask an admin to set it in Users & Team.');
        return;
      }
      const ok = await verifyPassword(user, password);
      if (!ok) {
        setError("Incorrect password. Try again or reset it below.");
        return;
      }
      signIn(user.id);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    setError(null);
    setNotice(null);
    const user = findUser();
    if (!user) {
      setError("No active account with that email.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const hash = await makePasswordHash(newPassword);
      updateUser(user.id, { passwordHash: hash });
      setNewPassword("");
      setPassword("");
      setMode("signin");
      setNotice("Password updated — sign in with your new password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-background p-6">
      <div className="w-full max-w-[400px]">
        {/* Logo + heading */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-card text-white shadow-[0_8px_24px_-8px_var(--primary)]"
            style={{ background: "var(--primary)" }}
          >
            <PushEngageLogo size={30} />
          </div>
          <h1 className="m-0 text-[26px] font-extrabold tracking-tight text-ink-1">TestPilot</h1>
          <p className="m-0 mt-1 text-[13px] text-muted-foreground">
            {mode === "signin" ? "Sign in to the QA Automation cockpit" : "Reset your password"}
          </p>
        </div>

        <div className="rounded-card border border-border bg-card p-6 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.35)]">
          {notice && (
            <div className="mb-4 rounded-control border border-[color-mix(in_srgb,var(--primary)_40%,transparent)] bg-primary/10 px-3 py-2 text-[12.5px] text-primary">
              {notice}
            </div>
          )}

          <div className="flex flex-col gap-3.5">
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-semibold text-ink-2">Email</span>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={inputCls}
                  type="email"
                  autoComplete="username"
                  placeholder="you@awesomemotive.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (mode === "signin" ? submit() : reset())}
                />
              </div>
            </label>

            {mode === "signin" ? (
              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-semibold text-ink-2">Password</span>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className={inputCls}
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </div>
              </label>
            ) : (
              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-semibold text-ink-2">New password</span>
                <div className="relative">
                  <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className={inputCls}
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && reset()}
                  />
                </div>
              </label>
            )}

            {error && <div className="text-[12px] font-medium text-destructive">{error}</div>}

            {mode === "signin" ? (
              <>
                <Button variant="primary" className="mt-1 w-full justify-center" disabled={busy} onClick={submit}>
                  {busy ? <Loader2 size={15} className="cp-spin" /> : <LogIn size={15} />} Sign in
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setError(null);
                    setNotice(null);
                  }}
                  className="mx-auto text-[12px] font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </>
            ) : (
              <>
                <Button variant="primary" className="mt-1 w-full justify-center" disabled={busy} onClick={reset}>
                  {busy ? <Loader2 size={15} className="cp-spin" /> : <KeyRound size={15} />} Set new password
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className="mx-auto text-[12px] font-medium text-muted-foreground hover:text-ink-2"
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Local sign-in for this QA tool — credentials are stored in your browser only.
        </p>
      </div>
    </div>
  );
}
