import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Toasts } from "@/components/layout/Toasts";
import { useStore } from "@/store/useStore";
import { SpecEditorModal } from "@/components/modals/SpecEditorModal";
import { ArtifactViewerModal } from "@/components/modals/ArtifactViewerModal";

export function AppShell() {
  const closeNotif = useStore((s) => s.closeNotif);
  // Below lg the sidebar is an off-canvas drawer (phone + iPad portrait); at lg+
  // it's a static column. `navOpen` drives the drawer; it auto-closes on route
  // change so a nav tap doesn't leave the drawer covering the page.
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-app-background">
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />
      )}
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <main className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setNavOpen((v) => !v)} />
        <div onClick={closeNotif} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1200px] px-4 py-6 pb-20 sm:px-6 sm:py-7">
            <Outlet />
          </div>
        </div>
      </main>
      <Toasts />
      <SpecEditorModal />
      <ArtifactViewerModal />
    </div>
  );
}
