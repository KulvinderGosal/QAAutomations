import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { BrandFilter } from "@/types";
import { SegmentedControl } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";
import { NOTIF_ICON } from "@/components/layout/notifIcons";
import { SessionBadge } from "@/components/layout/SessionBadge";

const CRUMBS: Record<string, string> = {
  "/": "Dashboard",
  "/tests": "Test Cases",
  "/tests/plans": "Test Plans",
  "/tests/runs": "Test Runs",
  "/tests/requirements": "Requirements",
  "/tests/risks": "Risks",
  "/tests/releases": "Releases",
  "/tests/defects": "Defects",
  "/tests/traceability": "Traceability",
  "/overview": "Overview",
  "/queue": "QA Queue",
  "/runner": "Test Runner",
  "/pipelines": "Pipelines",
  "/schedule": "Scheduler",
  "/manual": "Manual Test",
  "/qa-log": "QA Log",
  "/fixtures": "Fixtures",
  "/reports": "Reports",
  "/users": "Users & Team",
  "/database": "Database",
  "/integrations": "Integrations",
};

export function Header({ onMenu }: { onMenu?: () => void } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const brand = useStore((s) => s.brand);
  const setBrand = useStore((s) => s.setBrand);
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const notifOpen = useStore((s) => s.notifOpen);
  const toggleNotif = useStore((s) => s.toggleNotif);
  const closeNotif = useStore((s) => s.closeNotif);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close the notifications popover on any click outside it (sidebar, search,
  // brand toggle, empty header space) — not just clicks in the page body.
  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) closeNotif();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [notifOpen, closeNotif]);
  const markAllRead = useStore((s) => s.markAllRead);
  const notifications = useStore((s) => s.notifications);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const unread = notifications.filter((n) => n.unread).length;

  const crumb = useMemo(() => {
    if (location.pathname.startsWith("/queue/")) return "Task detail";
    return CRUMBS[location.pathname] ?? "TestPilot";
  }, [location.pathname]);

  return (
    <header className="relative z-20 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenu}
          aria-label="Open menu"
          title="Menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-surface-2 lg:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="hidden whitespace-nowrap text-[13px] font-medium text-muted-foreground sm:block">{crumb}</div>
        <div className="hidden h-5 w-px bg-border sm:block" />
        <SegmentedControl<BrandFilter>
          value={brand}
          onChange={setBrand}
          options={[
            { value: "all", label: "All" },
            { value: "PushEngage", label: "PushEngage" },
            { value: "LedgerPort", label: "LedgerPort" },
          ]}
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden h-[34px] items-center gap-2 rounded-control border border-border bg-surface-2 px-3 text-[13px] text-muted-foreground md:flex md:min-w-[200px] lg:min-w-[240px]">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, issues…"
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink-1 outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="flex shrink-0 cursor-pointer border-none bg-none p-0 text-muted-foreground">
              <X size={14} />
            </button>
          )}
        </div>
        <SessionBadge />
        <div className="relative" ref={notifRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleNotif();
            }}
            className="relative flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-control border border-border bg-card text-muted-foreground hover:bg-surface-2"
          >
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-destructive px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="cp-pop-in absolute right-0 top-[42px] z-40 w-[360px] overflow-hidden rounded-card border border-border bg-card shadow-[0_10px_20px_-6px_rgba(15,23,42,0.12),0_4px_8px_-2px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
                <div className="text-[14px] font-semibold">Notifications</div>
                <button onClick={markAllRead} className="cursor-pointer border-none bg-none text-[12px] font-medium text-primary hover:underline">
                  Mark all read
                </button>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="p-6 text-center text-[12.5px] text-muted-foreground">No notifications.</div>
                )}
                {notifications.map((n) => {
                  const Icon = NOTIF_ICON[n.kind];
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        closeNotif();
                        navigate(n.route);
                      }}
                      className={`flex w-full cursor-pointer items-start gap-2.5 border-b border-border px-3.5 py-2.5 text-left hover:bg-surface-1 ${
                        n.unread ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-2">
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-[12.5px] leading-[1.4] text-ink-1"
                          dangerouslySetInnerHTML={{ __html: n.html }}
                        />
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(n.at)}</span>
                      </span>
                      {n.unread && <span className="mt-1 h-[7px] w-[7px] shrink-0 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-control border border-border bg-card text-muted-foreground hover:bg-surface-2"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}
