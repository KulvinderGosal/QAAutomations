import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileEdit,
  FilePlus2,
  GitPullRequest,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card } from "@/components/ui/primitives";
import {
  analyzeSkbPr,
  composeSkbDoc,
  createSkbDraft,
  fetchSkbIndex,
  fetchSkbStatus,
  FEATURE_AREAS,
  type ComposedDoc,
  type DocPlanItem,
  type DocShot,
  type KbIndex,
  type PrAnalysis,
  type PullRequest,
  type SkbStatus,
} from "@/lib/skbDocs";

// A doc the author has chosen to draft (from the analysis "toCreate"/"impacted").
type Draftable = { key: string; item: DocPlanItem; bucket: "new" | "impacted" };
type DocSource = { mode: "pr" | "area"; ref: string; area: string };

export default function SkbDocs() {
  const pushToast = useStore((s) => s.pushToast);
  const [status, setStatus] = useState<SkbStatus | null>(null);
  const [index, setIndex] = useState<KbIndex | null>(null);
  const [indexBusy, setIndexBusy] = useState(false);

  const [mode, setMode] = useState<"pr" | "area">("pr");
  const [areaKey, setAreaKey] = useState<string>(FEATURE_AREAS[0].key);
  const currentArea = FEATURE_AREAS.find((a) => a.key === areaKey) ?? FEATURE_AREAS[0];

  const [prInput, setPrInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [analysis, setAnalysis] = useState<PrAnalysis | null>(null);
  const [chosen, setChosen] = useState<Draftable[]>([]);
  // In area mode, chosen is driven directly by the selected feature area.
  const areaChosen: Draftable[] = currentArea.docs.map((item, i) => ({ key: `area-${i}`, item, bucket: "new" as const }));
  const [areaSkip, setAreaSkip] = useState<Set<string>>(new Set());
  const docSource: DocSource =
    mode === "area" ? { mode: "area", ref: "", area: currentArea.product } : { mode: "pr", ref: prInput.trim(), area: "" };
  const draftList = mode === "area" ? areaChosen.filter((d) => !areaSkip.has(d.key)) : chosen;

  useEffect(() => {
    fetchSkbStatus().then(setStatus).catch(() => {});
    fetchSkbIndex(false).then(setIndex).catch(() => {});
  }, []);

  const refreshIndex = () => {
    setIndexBusy(true);
    fetchSkbIndex(true)
      .then((i) => {
        setIndex(i);
        pushToast({ icon: "sync", title: "KB index refreshed", subtitle: `${i.articles.length} articles · ${i.source}` });
      })
      .catch((e) => pushToast({ icon: "issue", title: "Index refresh failed", subtitle: (e as Error).message }))
      .finally(() => setIndexBusy(false));
  };

  const analyze = () => {
    if (!prInput.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setPr(null);
    setChosen([]);
    analyzeSkbPr(prInput.trim())
      .then(({ pr, analysis }) => {
        setPr(pr);
        setAnalysis(analysis);
        // pre-select every new + impacted doc
        const pre: Draftable[] = [
          ...analysis.toCreate.map((item, i) => ({ key: `new-${i}`, item, bucket: "new" as const })),
          ...analysis.impacted.map((item, i) => ({ key: `imp-${i}`, item, bucket: "impacted" as const })),
        ];
        setChosen(pre);
        pushToast({ icon: "generate", title: `Analyzed PR #${pr.number}`, subtitle: analysis.summary.slice(0, 80) });
      })
      .catch((e) => {
        setAnalyzeError((e as Error).message);
        pushToast({ icon: "issue", title: "Analyze failed", subtitle: (e as Error).message });
      })
      .finally(() => setAnalyzing(false));
  };

  const toggle = (key: string, item: DocPlanItem, bucket: "new" | "impacted") =>
    setChosen((c) => (c.some((d) => d.key === key) ? c.filter((d) => d.key !== key) : [...c, { key, item, bucket }]));

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-xl">SKB Docs</h1>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Turn a tested PR into ready-to-publish Support Knowledge Base articles at{" "}
          <a href="https://skb.pushengage.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">
            skb.pushengage.com
          </a>
          . Every article is created as a <strong>Draft</strong> for you to review &amp; approve.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
          <StatusChip ok={!!status?.aiReady} label={status?.aiReady ? "AI ready" : "AI not configured"} />
          <StatusChip
            ok={!!status?.skbReady}
            label={status?.skbReady ? "One-click create ready" : "Create: paste mode (no App Password)"}
            warn={!status?.skbReady}
          />
          {index && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-muted-foreground">
              KB index: {index.articles.length} articles · {index.source}
              <button onClick={refreshIndex} disabled={indexBusy} className="ml-1 hover:text-foreground" title="Refresh index">
                <RefreshCw className={`h-3.5 w-3.5 ${indexBusy ? "animate-spin" : ""}`} />
              </button>
            </span>
          )}
        </div>
        {status && !status.skbReady && (
          <div className="mt-3 flex items-start gap-2 rounded-control border border-[color-mix(in_srgb,var(--caution)_35%,transparent)] bg-[var(--caution)]/10 p-2.5 text-[12px]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--caution)]" />
            <span>
              The KB index and one-click create both need a WP <strong>Application Password</strong> (the whole skb site is
              login-gated). Add <code>SKB_WP_USER</code> + <code>SKB_WP_APP_PASSWORD</code> to <code>.env</code> (create one at
              skb → Profile → Application Passwords). Without it you can still analyze a PR and draft articles, then use{" "}
              <strong>Copy HTML</strong> to paste into a new Heroic article.
            </span>
          </div>
        )}
      </header>

      {/* Mode toggle — document a single PR, or a whole feature area */}
      <div className="mb-4 inline-flex rounded-control border border-border bg-surface-2 p-0.5 text-[12.5px]">
        <button
          onClick={() => setMode("pr")}
          className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 font-medium transition-colors ${mode === "pr" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <GitPullRequest className="h-3.5 w-3.5" /> From a PR
        </button>
        <button
          onClick={() => setMode("area")}
          className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 font-medium transition-colors ${mode === "area" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BookOpen className="h-3.5 w-3.5" /> By feature area
        </button>
      </div>

      {/* Step 1 (feature area) — pick an area, draft docs for ALL its features */}
      {mode === "area" && (
        <Card className="p-4">
          <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">Feature area</label>
          <select
            value={areaKey}
            onChange={(e) => {
              setAreaKey(e.target.value);
              setAreaSkip(new Set());
            }}
            className="h-9 w-full rounded-control border border-border bg-card px-3 text-[13px] outline-none focus:border-primary"
          >
            {FEATURE_AREAS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label} — {a.product}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Documents every feature in this area — not tied to a single PR. Uncheck any you don't need, then draft below.
          </p>
          <div className="mt-3 space-y-2">
            {currentArea.docs.map((item, i) => {
              const key = `area-${i}`;
              return (
                <PlanRow
                  key={key}
                  item={item}
                  checked={!areaSkip.has(key)}
                  onToggle={() =>
                    setAreaSkip((s) => {
                      const n = new Set(s);
                      if (n.has(key)) n.delete(key);
                      else n.add(key);
                      return n;
                    })
                  }
                />
              );
            })}
          </div>
        </Card>
      )}

      {/* Step 1 — PR */}
      {mode === "pr" && (
      <Card className="p-4">
        <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
          <GitPullRequest className="mr-1 inline h-3.5 w-3.5" /> PR number or URL
        </label>
        <div className="flex gap-2">
          <input
            value={prInput}
            onChange={(e) => setPrInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder={status?.ghRepo ? `#211  or  github.com/${status.ghRepo}/pull/211` : "github.com/owner/repo/pull/211"}
            className="h-9 flex-1 rounded-control border border-border bg-card px-3 text-[13px] outline-none focus:border-primary"
          />
          <Button variant="primary" onClick={analyze} disabled={analyzing || !prInput.trim()}>
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Analyze
          </Button>
        </div>
        {analyzing && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Fetching the PR from GitHub, then asking Claude to map the doc impact — this usually takes ~10–15s.
          </p>
        )}
        {pr && (
          <div className="mt-3 rounded-control border border-border bg-surface-2 p-3 text-[12.5px]">
            <div className="flex items-center gap-2">
              <a href={pr.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                #{pr.number} {pr.title}
              </a>
              {pr.merged && <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[11px] text-[var(--success)]">merged</span>}
            </div>
            <div className="mt-1 text-muted-foreground">
              {pr.changedFiles} files · {pr.head} → {pr.base}
              {pr.labels.length > 0 && <> · {pr.labels.join(", ")}</>}
            </div>
          </div>
        )}
        {analyzeError && (
          <div className="mt-3 rounded-control border border-[color-mix(in_srgb,var(--destructive)_35%,transparent)] bg-destructive-surface p-3 text-[12.5px]">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" /> Analyze failed
            </div>
            <p className="mt-1 text-foreground">{analyzeError}</p>
            {/credit|balance|402|unfunded|billing/i.test(analyzeError) && (
              <p className="mt-2 text-muted-foreground">
                The PR + KB index loaded fine — only the AI step is blocked. Fund the Anthropic key (or set{" "}
                <code>ANTHROPIC_API_KEY</code> to a funded key), or run <code>ant auth login</code> with a funded Claude
                account, then click Analyze again. No code change needed.
              </p>
            )}
          </div>
        )}
      </Card>
      )}

      {/* Step 2 — Analysis */}
      {analysis && (
        <div className="mt-5 space-y-4">
          <div className="rounded-control border border-border bg-surface-2 p-3 text-[13px]">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-medium">Impact</span>
              {analysis.heuristic ? (
                <span className="rounded-full bg-[var(--caution)]/15 px-2 py-0.5 text-[11px] text-[var(--caution)]">
                  heuristic · AI unfunded
                </span>
              ) : (
                <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[11px] text-[var(--success)]">
                  AI analysis
                </span>
              )}
              <span className="text-muted-foreground">— {analysis.product}</span>
            </div>
            {analysis.summary}
            {analysis.heuristic && (
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                This is a keyword-based plan so you can proceed now. Fund the Anthropic key (or <code>ant auth login</code>) for a
                precise, impact-aware analysis that also fills the “impacted products” list.
              </p>
            )}
          </div>

          {analysis.existing.length > 0 && (
            <Section icon={FileEdit} title="Existing docs affected" subtitle="Already in the KB — review / update these">
              {analysis.existing.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-control border border-border bg-card p-3">
                  <div>
                    <div className="text-[13px] font-medium">{e.title}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{e.reason}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{e.action}</span>
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noreferrer" className="text-primary hover:underline" title="Open in KB">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {analysis.toCreate.length > 0 && (
            <Section icon={FilePlus2} title="New docs to create" subtitle="Select which to draft">
              {analysis.toCreate.map((item, i) => (
                <PlanRow key={`new-${i}`} item={item} checked={chosen.some((d) => d.key === `new-${i}`)} onToggle={() => toggle(`new-${i}`, item, "new")} />
              ))}
            </Section>
          )}

          {analysis.impacted.length > 0 && (
            <Section icon={AlertTriangle} title="Impacted products / features" subtitle="Related docs this PR ripples into">
              {analysis.impacted.map((item, i) => (
                <PlanRow key={`imp-${i}`} item={item} impacted checked={chosen.some((d) => d.key === `imp-${i}`)} onToggle={() => toggle(`imp-${i}`, item, "impacted")} />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Step 3 — Composers */}
      {(mode === "area" ? true : !!pr) && draftList.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Draft {draftList.length} article{draftList.length > 1 ? "s" : ""}
          </h2>
          <div className="space-y-4">
            {draftList.map((d) => (
              <DocComposer key={d.key} source={docSource} item={d.item} canCreate={!!status?.skbReady} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  const color = ok ? "var(--success)" : warn ? "var(--caution)" : "var(--destructive)";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof FileEdit;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        <span className="text-[12px] text-muted-foreground">{subtitle}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PlanRow({
  item,
  checked,
  onToggle,
  impacted,
}: {
  item: DocPlanItem;
  checked: boolean;
  onToggle: () => void;
  impacted?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-control border border-border bg-card p-3 hover:bg-surface-2">
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
          {item.title}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-normal text-muted-foreground">{item.category}</span>
          {item.audience === "internal" && (
            <span className="rounded-full bg-[var(--caution)]/15 px-2 py-0.5 text-[11px] font-normal text-[var(--caution)]">internal</span>
          )}
          {impacted && item.relatesTo && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-normal text-muted-foreground">↝ {item.relatesTo}</span>
          )}
        </div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">{item.reason}</div>
      </div>
    </label>
  );
}

// ─── Per-doc composer ──────────────────────────────────────────────────────────
function DocComposer({ source, item, canCreate }: { source: DocSource; item: DocPlanItem; canCreate: boolean }) {
  const pushToast = useStore((s) => s.pushToast);
  const [highlights, setHighlights] = useState("");
  const [shots, setShots] = useState<DocShot[]>([]);
  const [composing, setComposing] = useState(false);
  const [doc, setDoc] = useState<ComposedDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ editUrl: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () =>
        setShots((s) => [...s, { name: f.name, label: f.name.replace(/\.[a-z]+$/i, ""), dataUrl: String(reader.result) }]);
      reader.readAsDataURL(f);
    });
  };

  const compose = () => {
    setComposing(true);
    setCreated(null);
    composeSkbDoc({
      pr: source.ref,
      mode: source.mode,
      area: source.area,
      item,
      highlights,
      screenshotLabels: shots.map((s) => s.label || s.name),
    })
      .then(({ doc }) => {
        setDoc(doc);
        pushToast({ icon: "generate", title: "Draft composed", subtitle: doc.title });
      })
      .catch((e) => pushToast({ icon: "issue", title: "Compose failed", subtitle: (e as Error).message }))
      .finally(() => setComposing(false));
  };

  const create = () => {
    if (!doc) return;
    setCreating(true);
    createSkbDraft({
      title: doc.title,
      contentHtml: doc.contentHtml,
      category: doc.category,
      tags: doc.tags,
      excerpt: doc.excerpt,
      images: shots.map((s) => ({ name: s.name, dataUrl: s.dataUrl })),
    })
      .then(({ result }) => {
        setCreated({ editUrl: result.editUrl });
        pushToast({ icon: "check", title: "Draft created in skb", subtitle: `${result.uploaded} screenshot(s) uploaded` });
      })
      .catch((e) => pushToast({ icon: "issue", title: "Create failed — use Copy HTML", subtitle: (e as Error).message }))
      .finally(() => setCreating(false));
  };

  const copyHtml = () => {
    if (!doc) return;
    navigator.clipboard.writeText(doc.contentHtml).then(() =>
      pushToast({ icon: "check", title: "HTML copied", subtitle: "Paste into a new Heroic article (Draft)" }),
    );
  };

  // preview: swap <!--SHOT:n--> markers for a visible placeholder chip
  const previewHtml = useMemo(() => {
    if (!doc) return "";
    return doc.contentHtml.replace(/<!--SHOT:(\d+)-->/g, (_m, n) => {
      const s = shots[Number(n)];
      return `<div style="border:1px dashed var(--border);border-radius:8px;padding:10px;margin:10px 0;color:var(--muted-foreground);font-size:12px">🖼 Screenshot ${Number(n) + 1}${s ? `: ${s.label}` : ""}</div>`;
    });
  }, [doc, shots]);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13.5px] font-semibold">{item.title}</span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">{item.category}</span>
      </div>

      {/* highlights */}
      <label className="mt-3 block text-[12px] font-medium text-muted-foreground">Points to highlight</label>
      <textarea
        value={highlights}
        onChange={(e) => setHighlights(e.target.value)}
        rows={2}
        placeholder="e.g. the new Targeting Rule dropdown, the 402 credit gate, the mobile-responsive edit modal…"
        className="mt-1 w-full rounded-control border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary"
      />

      {/* screenshots */}
      <div className="mt-3 flex items-center justify-between">
        <label className="text-[12px] font-medium text-muted-foreground">Screenshots ({shots.length}) — placed in order</label>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-3.5 w-3.5" /> Add
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>
      {shots.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shots.map((s, i) => (
            <div key={i} className="rounded-control border border-border bg-surface-2 p-1.5">
              <div className="relative">
                <img src={s.dataUrl} alt={s.label} className="h-20 w-full rounded object-cover" />
                <button
                  onClick={() => setShots((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white hover:bg-black/70"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <span className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[10px] text-white">{i + 1}</span>
              </div>
              <input
                value={s.label}
                onChange={(e) => setShots((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className="mt-1 w-full rounded border border-border bg-card px-1.5 py-1 text-[11px] outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button variant="magic" onClick={compose} disabled={composing}>
          {composing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {doc ? "Re-draft" : "Draft article"}
        </Button>
      </div>

      {/* composed preview */}
      {doc && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-semibold">{doc.title}</div>
            {doc.heuristic && (
              <span className="rounded-full bg-[var(--caution)]/15 px-2 py-0.5 text-[11px] text-[var(--caution)]">
                scaffold · AI unfunded
              </span>
            )}
          </div>
          {doc.heuristic && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              A fill-in Heroic-format skeleton (structure, your key points, screenshot slots). Fund the Anthropic key (or{" "}
              <code>ant auth login</code>) and click Re-draft for a fully written article.
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted-foreground">{doc.category}</span>
            {doc.tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[12.5px] italic text-muted-foreground">{doc.excerpt}</p>
          <div
            className="skb-preview mt-3 max-h-[420px] overflow-auto rounded-control border border-border bg-card p-4 text-[13px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canCreate ? (
              <Button variant="primary" onClick={create} disabled={creating || !!created}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Create draft in skb
              </Button>
            ) : (
              <span className="text-[12px] text-muted-foreground">
                One-click create is off (no App Password) — use Copy HTML and paste into a new Heroic article.
              </span>
            )}
            <Button variant="outline" onClick={copyHtml}>
              <ClipboardCopy className="h-4 w-4" /> Copy HTML
            </Button>
            {created && (
              <a
                href={created.editUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--success)] hover:underline"
              >
                <CheckCircle2 className="h-4 w-4" /> Draft created — open in skb <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
