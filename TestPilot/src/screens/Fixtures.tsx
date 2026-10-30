import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, RefreshCw, Search, Share2 } from "lucide-react";
import { Button, Card, Chip, SegmentedControl } from "@/components/ui/primitives";
import { cn, timeAgo } from "@/lib/utils";
import { fetchFixtures, type FixtureView, type FixturesResponse } from "@/lib/fixtures";

// D4 — read-only view of the QA fixture registry (~/QA-Automations/config/fixtures.json).
// Loaded server-side through qa-core loadFixtures (GET /api/fixtures); identifiers only.
// Nothing here writes: the registry is edited by hand, then this view reloads.

type EnvFilter = "all" | "staging" | "production" | "local";

const ENV_ORDER: Record<string, number> = { local: 0, staging: 1, production: 2 };

const TONE = {
  warning: { color: "var(--warning)", surface: "var(--warning-surface)" },
  destructive: { color: "var(--destructive)", surface: "var(--destructive-surface)" },
  success: { color: "var(--success)", surface: "var(--success-surface)" },
  info: { color: "var(--info)", surface: "var(--info-surface)" },
  caution: { color: "var(--caution)", surface: "var(--caution-surface)" },
  muted: { color: "var(--ink-2)", surface: "var(--surface-3)" },
};

function EnvBadge({ env }: { env: string }) {
  const tone = env === "production" ? TONE.destructive : env === "staging" ? TONE.info : TONE.muted;
  return (
    <Chip tone={tone} className="text-[11px] font-bold uppercase tracking-[0.04em]">
      {env || "?"}
    </Chip>
  );
}

function FixtureBadges({ f }: { f: FixtureView }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {f.placeholder && (
        <Chip tone={TONE.warning} icon={<AlertTriangle size={12} />} className="text-[11px] font-bold">
          Needs provisioning
        </Chip>
      )}
      {f.destructiveOk ? (
        <Chip tone={TONE.success} className="text-[11px] font-semibold">
          destructiveOk
        </Chip>
      ) : (
        <Chip tone={TONE.muted} className="text-[11px] font-semibold">
          Read-only (destructiveOk: false)
        </Chip>
      )}
      {f.singleUse && (
        <Chip tone={TONE.caution} className="text-[11px] font-semibold">
          singleUse
        </Chip>
      )}
      {f.sharedWith.length > 0 && (
        <Chip tone={TONE.info} icon={<Share2 size={11} />} className="text-[11px] font-semibold">
          Shared with {f.sharedWith.length}
        </Chip>
      )}
    </div>
  );
}

function Ident({ label, value, mono = true }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className={cn("truncate text-[12.5px] text-ink-1", mono && "font-mono")} title={value}>
        {value}
      </div>
    </div>
  );
}

function FixtureRow({ f }: { f: FixtureView }) {
  return (
    <div
      className={cn(
        "border-b border-border px-4 py-3 last:border-b-0",
        f.placeholder && "border-l-4 border-l-[var(--warning)] bg-warning-surface",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-mono text-[13px] font-semibold text-ink-1">{f.id}</span>
            {f.plan && <span className="text-[11.5px] text-muted-foreground">· {f.plan}</span>}
          </div>
          <p className="m-0 mt-1 text-[13px] text-ink-2">{f.purpose}</p>
        </div>
        <FixtureBadges f={f} />
      </div>

      {f.placeholder && (
        <div className="mt-2 rounded-control border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-card px-3 py-2 text-[12.5px]">
          <div className="font-semibold text-warning">{f.status}</div>
          {f.blockedMessage && (
            <div className="mt-1 break-words font-mono text-[11.5px] text-ink-2">{f.blockedMessage}</div>
          )}
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        <Ident label="Owner persona" value={f.ownerPersona} />
        <Ident label="Store / host" value={f.store} />
        <Ident label="Site id" value={f.siteId} />
        <Ident label="Site key" value={f.siteKeyPrefix} />
        <Ident label="Account id" value={f.accountId} />
        <Ident label="Business id" value={f.businessId} />
        <Ident label="QB realm id" value={f.realmId} />
        <Ident label="Identity label" value={f.identityLabel} mono={false} />
      </div>

      {f.capabilities.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {f.capabilities.map((c) => (
            <span key={c} className="rounded-chip bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
              {c}
            </span>
          ))}
        </div>
      )}

      {f.sharedWith.length > 0 && (
        <div className="mt-2 text-[12px] text-ink-2">
          <span className="font-semibold">Shared with:</span>{" "}
          {f.sharedWith.map((s, i) => (
            <span key={s}>
              {i > 0 && ", "}
              <span className="font-mono text-[11.5px]">{s}</span>
            </span>
          ))}
        </div>
      )}

      {f.verifyHint && (
        <div className="mt-1.5 text-[12px] text-muted-foreground">
          <span className="font-semibold text-ink-2">Verify:</span> {f.verifyHint}
        </div>
      )}
      {f.notes && <div className="mt-1 text-[12px] text-muted-foreground">{f.notes}</div>}
      {f.extraKeys.length > 0 && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          Not shown here: {f.extraKeys.join(", ")}
        </div>
      )}
    </div>
  );
}

export function Fixtures() {
  const [data, setData] = useState<FixturesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [env, setEnv] = useState<EnvFilter>("all");
  const [q, setQ] = useState("");
  const [todoOnly, setTodoOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchFixtures());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fixtures = useMemo(() => data?.fixtures ?? [], [data]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const visible = fixtures.filter((f) => {
      if (env !== "all" && f.env !== env) return false;
      if (todoOnly && !f.placeholder) return false;
      if (!needle) return true;
      return [f.id, f.product, f.purpose, f.store, f.siteId, f.accountId, f.businessId, f.realmId, f.ownerPersona, ...f.capabilities]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle));
    });
    const map = new Map<string, { product: string; env: string; items: FixtureView[] }>();
    for (const f of visible) {
      const key = `${f.product}\u0000${f.env}`;
      if (!map.has(key)) map.set(key, { product: f.product, env: f.env, items: [] });
      map.get(key)!.items.push(f);
    }
    return [...map.values()]
      .map((g) => ({ ...g, items: [...g.items].sort((a, b) => Number(b.placeholder) - Number(a.placeholder) || a.id.localeCompare(b.id)) }))
      .sort((a, b) => a.product.localeCompare(b.product) || (ENV_ORDER[a.env] ?? 9) - (ENV_ORDER[b.env] ?? 9));
  }, [fixtures, env, q, todoOnly]);

  const placeholders = fixtures.filter((f) => f.placeholder);
  const shown = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Boxes size={20} className="text-primary" />
            <h1 className="m-0 text-[24px] font-bold tracking-tight">Fixtures</h1>
          </div>
          <p className="m-0 mt-1.5 max-w-[760px] text-[14px] text-muted-foreground">
            The QA fixture registry: the stores, sites, accounts and QuickBooks realms tests run against. Read-only —
            edit <span className="font-mono text-[12.5px]">{data?.file ?? "config/fixtures.json"}</span> by hand
            (identifiers only, never secrets), then reload.
          </p>
        </div>
        <Button size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={cn(loading && "animate-spin")} /> Reload
        </Button>
      </div>

      {error && (
        <Card className="mb-4 border-l-4 border-l-[var(--destructive)] px-4 py-3 text-[13px] text-destructive">
          Could not load the fixture registry: {error}
        </Card>
      )}

      {data && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { label: "Fixtures", value: data.counts.total, tone: TONE.muted },
              { label: "Needs provisioning", value: data.counts.placeholders, tone: data.counts.placeholders ? TONE.warning : TONE.muted },
              { label: "destructiveOk", value: data.counts.destructiveOk, tone: TONE.success },
              { label: "singleUse", value: data.counts.singleUse, tone: TONE.caution },
              { label: "Production (read-only)", value: data.counts.production, tone: TONE.destructive },
            ].map((k) => (
              <Card key={k.label} className="flex min-w-[130px] flex-1 flex-col px-3.5 py-2.5">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{k.label}</span>
                <span className="text-[22px] font-bold" style={{ color: k.tone.color }}>
                  {k.value}
                </span>
              </Card>
            ))}
          </div>

          {placeholders.length > 0 && (
            <Card className="mb-4 border-l-4 border-l-[var(--warning)] bg-warning-surface px-4 py-3">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-warning">
                <AlertTriangle size={15} /> {placeholders.length} fixture{placeholders.length === 1 ? "" : "s"} need
                provisioning
              </div>
              <p className="m-0 mt-1 text-[12.5px] text-ink-2">
                Tests that ask for these get <span className="font-mono">BLOCKED:FIXTURE/not-provisioned</span> until a
                person creates them and fills in the identifiers:
              </p>
              <ul className="m-0 mt-1.5 list-disc pl-5 text-[12.5px] text-ink-1">
                {placeholders.map((f) => (
                  <li key={f.id}>
                    <span className="font-mono">{f.id}</span> — {f.purpose}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SegmentedControl<EnvFilter>
              value={env}
              onChange={setEnv}
              options={[
                { value: "all", label: "All envs" },
                { value: "staging", label: "Staging" },
                { value: "production", label: "Production" },
                { value: "local", label: "Local" },
              ]}
            />
            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-control border border-border bg-card px-2.5 sm:max-w-[320px]">
              <Search size={14} className="shrink-0 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search id, store, site, capability…"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-ink-2">
              <input type="checkbox" checked={todoOnly} onChange={(e) => setTodoOnly(e.target.checked)} />
              Needs provisioning only
            </label>
            <span className="ml-auto text-[11.5px] text-muted-foreground">
              {shown} of {data.counts.total} · loaded {timeAgo(data.loadedAt)}
              {data.updated ? ` · registry updated ${data.updated}` : ""}
            </span>
          </div>

          {groups.length === 0 ? (
            <Card className="px-4 py-12 text-center text-[13px] text-muted-foreground">No fixtures match.</Card>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <Card key={`${g.product}-${g.env}`} className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
                    <h2 className="m-0 font-mono text-[13.5px] font-semibold">{g.product}</h2>
                    <EnvBadge env={g.env} />
                    <span className="text-[11.5px] text-muted-foreground">
                      {g.items.length} fixture{g.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {g.items.map((f) => (
                    <FixtureRow key={f.id} f={f} />
                  ))}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {!data && !error && <Card className="px-4 py-12 text-center text-[13px] text-muted-foreground">Loading…</Card>}
    </div>
  );
}
