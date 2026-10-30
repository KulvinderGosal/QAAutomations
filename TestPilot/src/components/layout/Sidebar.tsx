import type { ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Boxes, Bug, CalendarClock, ClipboardCheck, ClipboardList, Database as DatabaseIcon, FileBarChart2, FileText, FlaskConical, Gauge, Globe, Inbox, LayoutDashboard, ListChecks, LogOut, Network, PlayCircle, Plug, Rocket, Users as UsersIcon, Workflow, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/primitives";
import { PushEngageLogo } from "@/components/icons/PushEngageLogo";
import { ROLE_LABEL, canAccess } from "@/lib/users";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; badge?: "queue" };

// Test Management is TestPilot's primary surface.
const TM_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tests", label: "Test Cases", icon: ListChecks },
  { to: "/tests/plans", label: "Test Plans", icon: ClipboardList },
  { to: "/tests/runs", label: "Test Runs", icon: PlayCircle },
  { to: "/tests/requirements", label: "Requirements", icon: FileText },
  { to: "/tests/traceability", label: "Traceability", icon: Network },
  { to: "/tests/releases", label: "Releases", icon: Rocket },
  { to: "/tests/defects", label: "Defects", icon: Bug },
  { to: "/tests/performance", label: "Performance", icon: Gauge },
  // Risks stays hidden (2026-07-27, low use — the QA-process model uses defects +
  // traceability, not a separate risk register). Route/screen/store/data all still
  // exist — to restore, un-comment + re-add the AlertTriangle import. See CLAUDE.md.
  // { to: "/tests/risks", label: "Risks", icon: AlertTriangle },
];

// Automation + delivery (the connector/runner cockpit) sits below.
const OPS_NAV: NavItem[] = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/queue", label: "QA Queue", icon: Inbox, badge: "queue" },
  { to: "/runner", label: "Test Runner", icon: FlaskConical },
  { to: "/pipelines", label: "Pipelines", icon: Workflow },
  { to: "/schedule", label: "Scheduler", icon: CalendarClock },
  { to: "/manual", label: "Manual Test", icon: Globe },
  { to: "/qa-log", label: "QA Log", icon: ClipboardCheck },
  { to: "/fixtures", label: "Fixtures", icon: Boxes },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/skb-docs", label: "SKB Docs", icon: BookOpen },
];

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void } = {}) {
  const location = useLocation();
  const tasks = useStore((s) => s.tasks);
  // Select raw, stable refs and derive `me` in render — a selector that returns
  // s.users.find(...) hands back a fresh object shape at mount and trips React's
  // getSnapshot cache warning (see CLAUDE.md).
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const signOut = useStore((s) => s.signOut);
  const me = users.find((u) => u.id === currentUserId);
  const role = me?.role;

  const queueCount = tasks.filter((t) =>
    ["assigned", "tests-missing", "ready", "reported", "verifying"].includes(t.status),
  ).length;
  const badgeCount = { queue: queueCount };

  const tmNav = TM_NAV.filter((n) => canAccess(n.to, role));
  const opsNav = OPS_NAV.filter((n) => canAccess(n.to, role));

  const isActive = (to: string) => (to === "/queue" ? location.pathname.startsWith("/queue") : location.pathname === to);

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-border bg-card",
        // Off-canvas drawer below lg (phone + iPad portrait); static column at lg+.
        "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-border px-4">
        <div
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-control text-white"
          style={{ background: "#3B43FF" }}
        >
          <PushEngageLogo size={18} />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">TestPilot</div>
          <div className="text-[10.5px] font-medium text-muted-foreground">Test Management</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close menu"
          title="Close"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-control text-muted-foreground hover:bg-surface-2 lg:hidden"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
        {tmNav.length > 0 && (
          <div className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Test Management
          </div>
        )}
        {tmNav.map((n) => (
          <NavButton key={n.to} to={n.to} label={n.label} icon={n.icon} active={isActive(n.to)} />
        ))}
        {opsNav.length > 0 && (
          <div className="mt-3 px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Automation &amp; Delivery
          </div>
        )}
        {opsNav.map((n) => (
          <NavButton
            key={n.to}
            to={n.to}
            label={n.label}
            icon={n.icon}
            active={isActive(n.to)}
            badge={n.badge ? badgeCount[n.badge] : undefined}
          />
        ))}
      </div>

      <div className="border-t border-border p-2.5">
        {canAccess("/integrations", role) && (
          <NavButton to="/integrations" label="Integrations" icon={Plug} active={location.pathname.startsWith("/integrations")} />
        )}
        {canAccess("/users", role) && (
          <NavButton to="/users" label="Users & Team" icon={UsersIcon} active={location.pathname.startsWith("/users")} />
        )}
        {canAccess("/database", role) && (
          <NavButton to="/database" label="Database" icon={DatabaseIcon} active={location.pathname.startsWith("/database")} />
        )}
        <div className="mt-1 flex items-center gap-2 px-2 py-1">
          <Avatar name={me?.name ?? ""} size={30} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-semibold">{me?.name ?? "Signed out"}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {me ? `${ROLE_LABEL[me.role]} · ${me.title}` : ""}
            </div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border text-muted-foreground hover:bg-surface-2"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavButton({
  to,
  label,
  icon: Icon,
  active,
  badge,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  active?: boolean;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-ink-2 hover:bg-surface-2",
      )}
    >
      <Icon size={17} />
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10.5px] font-bold",
            active ? "bg-primary text-white" : "bg-surface-3 text-ink-2",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
