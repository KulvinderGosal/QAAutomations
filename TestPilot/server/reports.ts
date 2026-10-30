// Server helpers for the Reports page: index the smoke-report files each
// framework's suite writes to <framework>/smoke-reports/, and read one back.
// Read-only; scoped strictly to those dirs.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { FRAMEWORKS, RunnerError } from "./runner";

export type SmokeReport = {
  framework: string;
  frameworkLabel: string;
  file: string; // absolute path (opaque handle for the read endpoint)
  name: string;
  env: string | null;
  verdict: string | null; // PASSED | FAILED | NO TESTS RUN
  taskRef: string | null; // the PR/task the report was generated for, if any
  mtime: string; // ISO
  sizeKb: number;
};

function reportDirs(): { id: string; label: string; dir: string }[] {
  return FRAMEWORKS.map((fw) => ({ id: fw.id, label: fw.label, dir: path.join(fw.dir, "smoke-reports") }));
}

/** List every timestamped HTML smoke report across all frameworks, newest first. */
export function listSmokeReports(): SmokeReport[] {
  const out: SmokeReport[] = [];
  for (const { id, label, dir } of reportDirs()) {
    if (!existsSync(dir)) continue;
    let files: string[] = [];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of files) {
      if (!name.endsWith(".html")) continue; // index the HTML reports
      if (name.startsWith("latest")) continue; // skip the rolling alias (dupes a timestamped file)
      const file = path.join(dir, name);
      let mtime = "";
      let sizeKb = 0;
      let verdict: string | null = null;
      let env: string | null = null;
      let taskRef: string | null = null;
      try {
        const st = statSync(file);
        mtime = st.mtime.toISOString();
        sizeKb = Math.round(st.size / 1024);
        const head = readFileSync(file, "utf8").slice(0, 6000);
        // Prefer the explicit top-of-file markers the reporter emits — reliable,
        // and immune to matching CSS class names like `.badge.passed` in <head>.
        verdict = /smoke-verdict:\s*([A-Za-z ]+?)\s*-->/i.exec(head)?.[1]?.trim().toUpperCase() ?? null;
        env = /smoke-env:\s*([^\n]*?)\s*-->/i.exec(head)?.[1]?.trim() || null;
        taskRef = /smoke-taskref:\s*([^\n]*?)\s*-->/i.exec(head)?.[1]?.trim() || null;
        // Fallback for reports written before the markers existed: match the
        // UPPERCASE verdict word only (CSS classes / KPI labels are lower/title-case).
        if (!verdict) {
          const body = readFileSync(file, "utf8").replace(/[^\x20-\x7e]/g, " ");
          verdict = /\b(PASSED|FAILED|NO TESTS RUN)\b/.exec(body)?.[1] ?? null;
        }
        if (!env) env = /env:\s*([^\s·<]+)/i.exec(head)?.[1] ?? null;
      } catch {
        /* skip unreadable */
      }
      out.push({ framework: id, frameworkLabel: label, file, name, env, verdict, taskRef, mtime, sizeKb });
    }
  }
  return out.sort((a, b) => b.mtime.localeCompare(a.mtime));
}

/** Read a report file — guarded to the frameworks' smoke-reports dirs only. */
export function readSmokeReport(file: string): { name: string; html: string } {
  const resolved = path.resolve(file);
  const allowed = reportDirs().some((d) => resolved.startsWith(path.resolve(d.dir) + path.sep));
  if (!allowed) throw new RunnerError(403, "path not allowed");
  if (!existsSync(resolved)) throw new RunnerError(404, "report not found");
  if (!/\.(html|md)$/.test(resolved)) throw new RunnerError(400, "unsupported file");
  return { name: path.basename(resolved), html: readFileSync(resolved, "utf8") };
}
