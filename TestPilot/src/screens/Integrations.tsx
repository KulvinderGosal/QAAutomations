import { type ComponentType, useEffect, useState } from "react";
import { ExternalLink, Loader2, Plug, RefreshCw, Sparkles, Store } from "lucide-react";
import { fetchAiStatus } from "@/lib/ai";
import { GithubMark } from "@/components/icons/GithubMark";
import { AsanaLogo } from "@/components/icons/AsanaLogo";
import { SlackLogo } from "@/components/icons/SlackLogo";
import { Button, Card, Chip } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { useStore, type AsanaConnState } from "@/store/useStore";
import { TEST_STORES, PARTNER_STORES_URL } from "@/data/stores";

type IconType = ComponentType<{ size?: number; className?: string }>;

type EnvField = { key: string; label: string; optional?: boolean; example?: string };

type Connector = {
  name: string;
  icon: IconType;
  description: string;
  endpoint: string;
  state: AsanaConnState;
  user: string | null;
  error: string | null;
  load: () => void;
  env: EnvField[];
};

// Human-readable status derived from the same connection state the loaders set.
function statusOf(state: AsanaConnState): { label: string; tone: { color: string; surface: string } } {
  switch (state) {
    case "connected":
      return { label: "Connected", tone: { color: "var(--success)", surface: "var(--success-surface)" } };
    case "loading":
      return { label: "Connecting…", tone: { color: "var(--emphasis)", surface: "oklch(0.95 0.03 255)" } };
    case "error":
      return { label: "Error", tone: { color: "var(--destructive)", surface: "oklch(0.95 0.03 20)" } };
    case "no_token":
      return { label: "Sample data", tone: { color: "var(--warning)", surface: "oklch(0.96 0.05 85)" } };
    default:
      return { label: "Not connected", tone: { color: "var(--muted-foreground)", surface: "oklch(0.95 0 0)" } };
  }
}

export function Integrations() {
  const asanaState = useStore((s) => s.asanaState);
  const asanaUser = useStore((s) => s.asanaUser);
  const asanaError = useStore((s) => s.asanaError);
  const loadAsana = useStore((s) => s.loadAsana);
  const githubState = useStore((s) => s.githubState);
  const githubUser = useStore((s) => s.githubUser);
  const githubError = useStore((s) => s.githubError);
  const loadGithub = useStore((s) => s.loadGithub);
  const slackState = useStore((s) => s.slackState);
  const slackUser = useStore((s) => s.slackUser);
  const slackError = useStore((s) => s.slackError);
  const loadSlack = useStore((s) => s.loadSlack);
  const autoAuthor = useStore((s) => s.autoAuthor);
  const setAutoAuthor = useStore((s) => s.setAutoAuthor);

  const [configuring, setConfiguring] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [aiSource, setAiSource] = useState<string | undefined>(undefined);
  useEffect(() => {
    let ok = true;
    fetchAiStatus()
      .then((s) => ok && (setAiReady(s.ready), setAiSource(s.source)))
      .catch(() => ok && setAiReady(false));
    return () => {
      ok = false;
    };
  }, []);

  const connectors: Connector[] = [
    {
      name: "Asana",
      icon: AsanaLogo,
      description:
        "Pulls tasks devs create & assign to you in Asana straight into the QA queue, and comments the verify/validate result back on the source task.",
      endpoint: "app.asana.com",
      state: asanaState,
      user: asanaUser,
      error: asanaError,
      load: () => void loadAsana(),
      env: [
        { key: "ASANA_ACCESS_TOKEN", label: "Personal access token", example: "2/12034…" },
        { key: "ASANA_WORKSPACE_GID", label: "Workspace GID", optional: true },
      ],
    },
    {
      name: "Slack",
      icon: SlackLogo,
      description:
        "Watches your QA channel and turns the build / PR hand-offs developers post there into QA tasks — no manual entry, the queue keeps itself current.",
      endpoint: "slack.com · Web API",
      state: slackState,
      user: slackUser,
      error: slackError,
      load: () => void loadSlack(),
      env: [
        { key: "SLACK_BOT_TOKEN", label: "Bot token", example: "xoxb-…" },
        { key: "SLACK_QA_CHANNEL", label: "QA channel", optional: true, example: "qa-automation" },
      ],
    },
    {
      name: "GitHub",
      icon: GithubMark,
      description:
        "Reads issues you own or filed into the queue, and files & labels new issues back to the dev when a QA run fails.",
      endpoint: "github.com · awesomemotive",
      state: githubState,
      user: githubUser,
      error: githubError,
      load: () => void loadGithub(),
      env: [
        { key: "GITHUB_TOKEN", label: "Access token", example: "gho_…" },
        { key: "GITHUB_REPO", label: "Scope to repo (owner/repo)", optional: true },
      ],
    },
  ];

  const active = connectors.find((c) => c.name === configuring) ?? null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="m-0 text-[24px] font-bold tracking-tight">Integrations</h1>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          The sources TestPilot watches to keep the QA queue current. Tokens live in <span className="font-mono">.env</span> and
          are only ever used server-side — never bundled to the browser.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {connectors.map((c) => {
          const status = statusOf(c.state);
          const isConnected = c.state === "connected";
          const detail =
            c.state === "connected"
              ? c.user
                ? `${c.endpoint} · ${c.user}`
                : c.endpoint
              : c.state === "error"
                ? c.error ?? "Connection error"
                : c.state === "no_token"
                  ? `Add ${c.env[0].key} to .env to connect`
                  : c.endpoint;
          return (
            <Card key={c.name} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-control bg-surface-2 text-ink-2">
                    <c.icon size={18} />
                  </span>
                  <div className="text-[14.5px] font-semibold">{c.name}</div>
                </div>
                <Chip tone={status.tone}>{status.label}</Chip>
              </div>
              <p className="m-0 mt-3 text-[12.5px] leading-[1.5] text-ink-2">{c.description}</p>
              <div className="mt-2.5 font-mono text-[11px] text-muted-foreground">{detail}</div>
              <div className="mt-3.5 flex gap-2">
                <Button
                  variant={isConnected ? "outline" : "primary"}
                  size="sm"
                  disabled={c.state === "loading"}
                  onClick={c.load}
                >
                  {c.state === "loading" ? (
                    <Loader2 size={13} className="cp-spin" />
                  ) : isConnected ? (
                    <RefreshCw size={13} />
                  ) : (
                    <Plug size={13} />
                  )}
                  {isConnected ? "Refresh" : "Connect"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfiguring(c.name)}>
                  Setup
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* AI QA authoring — auto-generate plan/scenarios/Playwright cases + Excel */}
      <Card className="mt-3.5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-magic-surface text-magic">
              <Sparkles size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[14.5px] font-semibold">AI QA authoring</div>
                <Chip
                  tone={
                    aiReady
                      ? { color: "var(--success)", surface: "var(--success-surface)" }
                      : aiReady === false
                        ? { color: "var(--warning)", surface: "var(--warning-surface)" }
                        : { color: "var(--muted-foreground)", surface: "var(--surface-2)" }
                  }
                >
                  {aiReady ? "Ready" : aiReady === false ? "Not configured" : "Checking…"}
                </Chip>
              </div>
              <p className="m-0 mt-1.5 max-w-[52ch] text-[12.5px] leading-[1.5] text-ink-2">
                When on, each newly synced task is read by Claude to author a test plan, corner-case scenarios, real
                Playwright specs (into the framework's <span className="font-mono">ai-generated/</span> folder), and an
                Excel record. You can also trigger it per task, or by handing a task to AI.
              </p>
              <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                {aiReady === false
                  ? "Add ANTHROPIC_API_KEY to .env or run: ant auth login"
                  : aiSource
                    ? `credential: ${aiSource}`
                    : "Anthropic · claude-opus-4-8"}
              </div>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={autoAuthor}
            onClick={() => setAutoAuthor(!autoAuthor)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-1 py-1 text-[12px] font-medium transition-colors ${
              autoAuthor ? "border-transparent bg-magic/15 text-magic" : "border-border bg-surface-2 text-muted-foreground"
            }`}
          >
            <span
              className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                autoAuthor ? "bg-magic" : "bg-[oklch(0.8_0_0)]"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white transition-transform ${autoAuthor ? "translate-x-4" : ""}`}
              />
            </span>
            <span className="pr-2">{autoAuthor ? "Auto-author on" : "Auto-author off"}</span>
          </button>
        </div>
      </Card>

      {/* QA test stores — Shopify-embedded apps for exploring/testing each product */}
      <div className="mb-4 mt-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-[18px] font-bold tracking-tight">
            <Store size={18} className="text-primary" /> Test stores
          </h2>
          <p className="m-0 mt-1 text-[13px] text-muted-foreground">
            Shopify apps set up for QA across staging + production. All on the Free plan — upgrade a subscription when a
            test needs a paid tier.
          </p>
        </div>
        <a
          href={PARTNER_STORES_URL}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-control border border-border px-3 py-2 text-[12.5px] font-semibold text-ink-2 hover:bg-surface-2"
        >
          <ExternalLink size={13} /> Partner dashboard
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {TEST_STORES.map((s) => {
          const brandTone =
            s.brand === "PushEngage"
              ? { color: "var(--brand-pushengage)", surface: "var(--brand-pushengage-surface)" }
              : { color: "var(--brand-ledgerport)", surface: "var(--brand-ledgerport-surface)" };
          const envTone =
            s.env === "production"
              ? { color: "var(--destructive)", surface: "var(--destructive-surface)" }
              : { color: "var(--info)", surface: "var(--info-surface)" };
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink-1">{s.brand}</span>
                  <span className="text-[12.5px] text-muted-foreground">{s.product}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Chip tone={envTone}>{s.env}</Chip>
                  <Chip tone={brandTone}>{s.plan}</Chip>
                </div>
              </div>
              <div className="mt-2.5 font-mono text-[11px] text-muted-foreground">{s.storeHandle}</div>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-control border border-border py-2 text-[12.5px] font-semibold text-ink-2 hover:bg-surface-2"
              >
                <ExternalLink size={13} /> Open app
              </a>
            </Card>
          );
        })}
      </div>

      <SetupModal connector={active} open={!!active} onClose={() => setConfiguring(null)} />
    </div>
  );
}

function SetupModal({ connector, open, onClose }: { connector: Connector | null; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={connector ? `Set up ${connector.name}` : ""} width={520}>
      {connector && (
        <>
          <p className="m-0 mb-4 text-[13px] leading-[1.5] text-muted-foreground">{connector.description}</p>
          <div className="rounded-control bg-surface-2 px-3.5 py-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Add to <span className="font-mono normal-case">.env</span>, then Connect
            </div>
            <div className="flex flex-col gap-2">
              {connector.env.map((f) => (
                <div key={f.key} className="text-[12.5px]">
                  <span className="font-mono font-semibold text-ink-1">{f.key}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {f.label}
                    {f.optional ? " (optional)" : ""}
                    {f.example ? ` · e.g. ${f.example}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="m-0 mt-3 text-[11.5px] leading-[1.5] text-muted-foreground">
            The Vite dev server reads these server-side and exposes only <span className="font-mono">/api/{connector.name.toLowerCase()}/*</span> to
            the browser — the token itself never reaches the bundle. Restart <span className="font-mono">npm run dev</span> after editing{" "}
            <span className="font-mono">.env</span>.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                connector.load();
                onClose();
              }}
            >
              <Plug size={13} /> Connect now
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
