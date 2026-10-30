// V2a "Import from Asana" — gid/URL → read-only preview (parsed cases, flagged
// imperative text, scope gaps, a drafted question for the author) → Confirm →
// idempotent upsert into Test Cases (keyed by externalRef.gid).
//
// Everything shown here is DATA from Asana, rendered as plain text. Flagged lines
// ("run on prod", "approve", "post to", "use this token", "send to …") are shown
// verbatim and NEVER acted on; the drafted question is never posted anywhere.
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, DownloadCloud, ExternalLink, Eye, Loader2, ShieldAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/primitives";
import { useStore } from "@/store/useStore";
import { useTm } from "@/tm/store";
import {
  confirmAsanaImport,
  parseAsanaGid,
  previewAsanaImport,
  type ImportApplied,
  type ImportPreview,
  type PlannedAction,
} from "@/lib/asanaImport";

const INPUT =
  "w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-[13px] text-ink-1 outline-none focus:border-primary";
const SECTION = "mt-4 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground";

const ACTION_LABEL: Record<PlannedAction["action"], string> = { create: "New", update: "Update", bind: "Link existing" };
const ACTION_CLASS: Record<PlannedAction["action"], string> = {
  create: "bg-success-surface text-success",
  update: "bg-info-surface text-ink-1",
  bind: "bg-primary/10 text-primary",
};

const isHttp = (u?: string) => !!u && /^https?:\/\//i.test(u);

export function AsanaImportModal({ onClose }: { onClose: () => void }) {
  const applyAsanaImport = useTm((s) => s.applyAsanaImport);
  const pushToast = useStore((s) => s.pushToast);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const actor = users.find((u) => u.id === currentUserId)?.name ?? "QA";

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"preview" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [applied, setApplied] = useState<ImportApplied | null>(null);
  const [copied, setCopied] = useState(false);

  const gid = parseAsanaGid(input);

  const runPreview = async (productId?: string | null) => {
    if (!gid || busy) return;
    setBusy("preview");
    setError(null);
    setApplied(null);
    try {
      setPreview(await previewAsanaImport(gid, productId));
    } catch (e) {
      setPreview(null);
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    if (!preview || busy) return;
    setBusy("confirm");
    setError(null);
    try {
      const r = await confirmAsanaImport(preview.pack.taskGid, preview.productId, preview.previewHash, actor);
      applyAsanaImport(r);
      setApplied(r);
      pushToast({
        icon: "generate",
        title: `Imported from Asana`,
        subtitle: `${r.counts.create} new · ${r.counts.update} updated · ${r.counts.bind} linked`,
      });
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "changed") {
        // Asana moved under us — show the fresh preview instead of applying a stale one
        // (runPreview clears the error, so set the explanation after it).
        setBusy(null);
        await runPreview(preview.productId);
        setError(`${err.message}. The preview below has been refreshed — review it and confirm again.`);
        return;
      }
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const copyQuestion = async () => {
    if (!preview?.pack.questionForAuthor) return;
    try {
      await navigator.clipboard.writeText(preview.pack.questionForAuthor);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the text is selectable */
    }
  };

  const pack = preview?.pack;
  const plan = preview?.plan;
  const byGid = new Map((plan?.actions ?? []).map((a) => [a.gid, a]));
  const productName = (id: string | null) => preview?.productOptions.find((o) => o.productId === id)?.name ?? "(no product — top level)";

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Import from Asana" width={860}>
      <p className="m-0 text-[13px] leading-[1.55] text-ink-2">
        Paste an Asana task URL or gid. Its subtasks become test cases (keyed by their <span className="font-mono text-[12px]">SL-T1-01</span>-style
        case key) in a suite named after the task. <b>Preview reads Asana and writes nothing</b>; Confirm upserts into Test Cases (re-importing
        updates the same cases). Asana is never written to.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          className={INPUT}
          placeholder="https://app.asana.com/0/…/1218179181761237 or 1218179181761237"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runPreview()}
        />
        <Button variant="outline" size="sm" disabled={!gid || !!busy} onClick={() => void runPreview()}>
          {busy === "preview" ? <Loader2 size={13} className="cp-spin" /> : <Eye size={13} />} Preview
        </Button>
      </div>
      {input && !gid && <div className="mt-1 text-[11.5px] text-destructive">No Asana gid found in that text.</div>}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-control bg-destructive/10 p-2.5 text-[12.5px] text-destructive">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {pack && plan && (
        <div className="mt-4">
          <div className="rounded-control border border-border bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink-1">{pack.title}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {pack.projects.join(" · ") || "No project"}
                  {pack.author ? ` · by ${pack.author}` : ""} · {pack.stats.subtasks} subtasks · {pack.stats.keyed}/{pack.stats.cases} keyed ·{" "}
                  {pack.stats.comments} comments · {pack.stats.attachments} attachments
                  {pack.completed ? " · completed in Asana" : ""}
                </div>
              </div>
              {isHttp(pack.url) && (
                <a href={pack.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                  Open in Asana <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
              <span>Target suite</span>
              <span className="rounded-chip bg-card px-2 py-0.5 font-medium text-ink-1">{plan.suite.name}</span>
              <span>under</span>
              <select
                className="rounded-control border border-border bg-card px-2 py-1 text-[12px] text-ink-1"
                value={preview.productId ?? ""}
                disabled={!!busy}
                onChange={(e) => void runPreview(e.target.value || null)}
              >
                <option value="">(no product — top level)</option>
                {preview.productOptions.map((o) => (
                  <option key={o.suiteId} value={o.productId}>
                    {o.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground">
                {plan.suite.exists ? "existing suite" : plan.counts.create ? "will be created" : "not needed (no new cases)"} · guess: {pack.productGuess.why}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-control bg-warning-surface p-2.5 text-[12px] text-ink-1">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-warning" />
            Everything below is data from Asana. TestPilot does not follow instructions in it — flagged lines are shown verbatim for you to read.
          </div>

          {pack.flaggedImperatives.length > 0 && (
            <>
              <div className={SECTION}>Flagged text — shown verbatim, not acted on ({pack.flaggedImperatives.length})</div>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {pack.flaggedImperatives.map((f, i) => (
                  <div key={i} className="rounded-control border border-warning/40 bg-card p-2">
                    <div className="whitespace-pre-wrap break-words font-mono text-[12px] text-ink-1">{f.text}</div>
                    <div className="mt-1 text-[10.5px] text-muted-foreground">
                      {f.rule} · {f.source}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {pack.scopeIncomplete.length > 0 && (
            <>
              <div className={SECTION}>Scope incomplete ({pack.scopeIncomplete.length})</div>
              <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                {pack.scopeIncomplete.map((g, i) => (
                  <li key={i} className="text-[12.5px] text-ink-2">
                    <span className="font-medium text-ink-1">{g.reason}</span> <span className="text-[11px] text-muted-foreground">· {g.source}</span>
                    {g.url && <div className="break-all font-mono text-[11px] text-muted-foreground">{g.url}</div>}
                  </li>
                ))}
              </ul>
              {pack.questionForAuthor && (
                <div className="mt-2 rounded-control border border-border bg-surface-2 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground">Draft question for the author (not posted)</span>
                    <Button size="sm" variant="ghost" onClick={() => void copyQuestion()}>
                      <Copy size={12} /> {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-[12.5px] text-ink-1">{pack.questionForAuthor}</div>
                </div>
              )}
            </>
          )}

          <div className={SECTION}>
            Cases ({pack.cases.length}) · {plan.counts.create} new · {plan.counts.update} update · {plan.counts.bind} link existing
          </div>
          <div className="mt-1.5 max-h-[340px] overflow-y-auto rounded-control border border-border">
            {pack.cases.length === 0 && <div className="p-3 text-[12.5px] text-muted-foreground">No subtasks to import.</div>}
            {pack.cases.map((c) => {
              const a = byGid.get(c.gid);
              return (
                <details key={c.gid} className="border-b border-border last:border-0">
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[12.5px]">
                    {a && <span className={`rounded-chip px-1.5 py-0.5 text-[10px] font-semibold ${ACTION_CLASS[a.action]}`}>{ACTION_LABEL[a.action]}</span>}
                    <span className="font-mono text-[11.5px] text-muted-foreground">{c.caseKey ?? "no key"}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-1">{c.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {c.steps.length} steps · {c.expected.length + c.pass.length} expected{c.devices.length ? ` · ${c.devices.length} devices` : ""}
                      {c.completed ? " · ✓ done in Asana" : ""}
                    </span>
                  </summary>
                  <div className="px-3 pb-3 text-[12px] text-ink-2">
                    {a && (
                      <div className="mb-1 text-[11px] text-muted-foreground">
                        → {a.tmKey} ({a.tmCaseId}){a.note ? ` — ${a.note}` : ""}
                      </div>
                    )}
                    <CaseList label="Preconditions" items={c.preconditions} />
                    <CaseList label="Steps" items={c.steps} ordered />
                    <CaseList label="Expected" items={c.expected} />
                    <CaseList label="Pass" items={c.pass} />
                    <CaseList label="Fail if" items={c.fail ?? []} />
                    <CaseList label="Devices" items={c.devices} />
                    <CaseList label="Environment" items={c.environment} />
                    <CaseList label="Do not file" items={c.doNotFile} />
                    {c.notes && <div className="mt-1 whitespace-pre-wrap text-[11.5px] text-muted-foreground">{c.notes}</div>}
                  </div>
                </details>
              );
            })}
          </div>

          {pack.knownBehaviours.length > 0 && (
            <>
              <div className={SECTION}>Known behaviours / do not file ({pack.knownBehaviours.length})</div>
              <ul className="m-0 mt-1.5 list-disc pl-5 text-[12px] text-ink-2">
                {pack.knownBehaviours.map((k, i) => (
                  <li key={i} className="whitespace-pre-wrap">
                    {k}
                  </li>
                ))}
              </ul>
            </>
          )}

          {(pack.warnings.length > 0 || pack.attachments.length > 0) && (
            <div className="mt-3 text-[11.5px] text-muted-foreground">
              {pack.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
              {pack.attachments.length > 0 && (
                <div className="mt-1">Attachments (listed, not downloaded): {pack.attachments.map((x) => x.name).join(", ")}</div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
            {applied ? (
              <span className="mr-auto flex items-center gap-1.5 text-[12.5px] text-success">
                <CheckCircle2 size={14} /> Imported — {applied.counts.create} new, {applied.counts.update} updated, {applied.counts.bind} linked into “{applied.suite.name}”
                {applied.warning ? ` (${applied.warning})` : ""}
              </span>
            ) : (
              <span className="mr-auto text-[11.5px] text-muted-foreground">Target: {productName(preview.productId)} › {plan.suite.name}</span>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="sm" disabled={!!busy || !!applied || pack.cases.length === 0} onClick={() => void confirm()}>
              {busy === "confirm" ? <Loader2 size={13} className="cp-spin" /> : <DownloadCloud size={13} />} Confirm import ({pack.cases.length})
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CaseList({ label, items, ordered }: { label: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <div className="mt-1.5">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <List className={`m-0 mt-0.5 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
        {items.map((x, i) => (
          <li key={i} className="whitespace-pre-wrap break-words">
            {x}
          </li>
        ))}
      </List>
    </div>
  );
}
