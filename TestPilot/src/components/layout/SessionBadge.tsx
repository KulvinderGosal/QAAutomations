import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { fetchSessions, SESSIONS_CHANGED_EVENT } from "@/lib/sessions";
import { canAccess } from "@/lib/users";
import { useStore } from "@/store/useStore";

// I1 header badge: a red pill with the number of test sessions that need a human
// (block severity — missing / expired / wrong-account …). Reads the CACHED probe
// state (never spawns probes); the canary + Sessions panel keep that fresh.
// Hidden when every session is usable, and for roles that cannot open the Test Runner. Click → Test Runner → Test sessions.
export function SessionBadge() {
  const navigate = useNavigate();
  // Select raw slices (zustand gotcha) and derive the role in render.
  const users = useStore((st) => st.users);
  const currentUserId = useStore((st) => st.currentUserId);
  const allowed = canAccess("/runner", users.find((u) => u.id === currentUserId)?.role);
  const [blocking, setBlocking] = useState(0);
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    const load = () =>
      fetchSessions(true)
        .then((r) => {
          if (!alive) return;
          setBlocking(r.blocking);
          setNames(r.sessions.filter((s) => s.probe?.severity === "block").map((s) => s.persona));
        })
        .catch(() => {});
    void load();
    const t = setInterval(load, 60_000);
    window.addEventListener(SESSIONS_CHANGED_EVENT, load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener(SESSIONS_CHANGED_EVENT, load);
    };
  }, [allowed]);

  if (!allowed || blocking <= 0) return null;
  return (
    <button
      onClick={() => navigate("/runner")}
      title={`Test sessions needing a human: ${names.join(", ") || blocking}`}
      className="flex h-[34px] cursor-pointer items-center gap-1.5 rounded-control border border-[color-mix(in_srgb,var(--destructive)_45%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-2.5 text-[12px] font-semibold text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_16%,transparent)]"
    >
      <KeyRound size={14} />
      {blocking} session{blocking === 1 ? "" : "s"}
    </button>
  );
}
