import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Overview } from "@/screens/Overview";
import { TmDashboard } from "@/screens/tm/Dashboard";
import { TestCases } from "@/screens/tm/TestCases";
import { TestPlans } from "@/screens/tm/TestPlans";
import { TestRuns } from "@/screens/tm/TestRuns";
import { Requirements } from "@/screens/tm/Requirements";
import { Risks } from "@/screens/tm/Risks";
import { Releases } from "@/screens/tm/Releases";
import { Defects } from "@/screens/tm/Defects";
import { Traceability } from "@/screens/tm/Traceability";
import { Performance } from "@/screens/tm/Performance";
import { QaQueue } from "@/screens/QaQueue";
import { TaskDetail } from "@/screens/TaskDetail";
import { Integrations } from "@/screens/Integrations";
import { TestRunner } from "@/screens/TestRunner";
import { Pipelines } from "@/screens/Pipelines";
import { Schedule } from "@/screens/Schedule";
import { Reports } from "@/screens/Reports";
import SkbDocs from "@/screens/SkbDocs";
import { RunStory } from "@/screens/RunStory";
import { ManualTest } from "@/screens/ManualTest";
import { Login } from "@/screens/Login";
import { Users } from "@/screens/Users";
import { Database } from "@/screens/Database";
import { QaLog } from "@/screens/QaLog";
import { Fixtures } from "@/screens/Fixtures";
import { useStore } from "@/store/useStore";
import { canAccess } from "@/lib/users";
import type { Role } from "@/types";

function Guard({ path, role, children }: { path: string; role: Role | undefined; children: ReactNode }) {
  return canAccess(path, role) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const currentUserId = useStore((s) => s.currentUserId);
  const role = useStore((s) => s.users.find((u) => u.id === s.currentUserId)?.role);
  const loadAsana = useStore((s) => s.loadAsana);
  const loadGithub = useStore((s) => s.loadGithub);
  const loadSlack = useStore((s) => s.loadSlack);

  useEffect(() => {
    if (!currentUserId) return; // only sync connectors once signed in
    void loadAsana();
    void loadGithub();
    void loadSlack();
  }, [currentUserId, loadAsana, loadGithub, loadSlack]);

  if (!currentUserId) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Test Management — TestPilot's primary surface */}
        <Route path="/" element={<TmDashboard />} />
        <Route path="/tests" element={<Guard path="/tests" role={role}><TestCases /></Guard>} />
        <Route path="/tests/plans" element={<Guard path="/tests" role={role}><TestPlans /></Guard>} />
        <Route path="/tests/runs" element={<Guard path="/tests" role={role}><TestRuns /></Guard>} />
        <Route path="/tests/requirements" element={<Guard path="/tests" role={role}><Requirements /></Guard>} />
        <Route path="/tests/risks" element={<Guard path="/tests" role={role}><Risks /></Guard>} />
        <Route path="/tests/releases" element={<Guard path="/tests" role={role}><Releases /></Guard>} />
        <Route path="/tests/defects" element={<Guard path="/tests" role={role}><Defects /></Guard>} />
        <Route path="/tests/traceability" element={<Guard path="/tests" role={role}><Traceability /></Guard>} />
        <Route path="/tests/performance" element={<Guard path="/tests" role={role}><Performance /></Guard>} />
        {/* Automation & delivery */}
        <Route path="/overview" element={<Overview />} />
        <Route path="/queue" element={<Guard path="/queue" role={role}><QaQueue /></Guard>} />
        <Route path="/queue/:taskId" element={<Guard path="/queue" role={role}><TaskDetail /></Guard>} />
        <Route path="/runner" element={<Guard path="/runner" role={role}><TestRunner /></Guard>} />
        <Route path="/pipelines" element={<Guard path="/pipelines" role={role}><Pipelines /></Guard>} />
        <Route path="/schedule" element={<Guard path="/schedule" role={role}><Schedule /></Guard>} />
        <Route path="/reports" element={<Guard path="/reports" role={role}><Reports /></Guard>} />
        <Route path="/skb-docs" element={<Guard path="/skb-docs" role={role}><SkbDocs /></Guard>} />
        <Route path="/runs/:id" element={<Guard path="/reports" role={role}><RunStory /></Guard>} />
        <Route path="/manual" element={<Guard path="/manual" role={role}><ManualTest /></Guard>} />
        <Route path="/qa-log" element={<Guard path="/qa-log" role={role}><QaLog /></Guard>} />
        <Route path="/fixtures" element={<Guard path="/fixtures" role={role}><Fixtures /></Guard>} />
        <Route path="/users" element={<Guard path="/users" role={role}><Users /></Guard>} />
        <Route path="/database" element={<Guard path="/database" role={role}><Database /></Guard>} />
        <Route path="/integrations" element={<Guard path="/integrations" role={role}><Integrations /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
