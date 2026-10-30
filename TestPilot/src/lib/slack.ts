// Client-side Slack helpers: fetch from our same-origin /api/slack/* proxy and
// map QA-handoff messages onto TestPilot's Task model. No token ever lives here.
import type { Dev, Product, SlackLink, Task } from "@/types";
import { inferProductId } from "@/lib/asana";

export type RawSlackMessage = {
  ts: string;
  text: string;
  author: string;
  authorId: string;
  permalink: string;
  channel: string;
  channelId: string;
  createdAt: string;
};

export type SlackTasksResp =
  | { connected: false; reason?: string; error?: string }
  | {
      connected: true;
      team: string;
      channel: string;
      messages: RawSlackMessage[];
    };

export type SlackStatusResp =
  | { connected: false; reason?: string; error?: string }
  | { connected: true; team: string; channel: string };

export async function fetchSlackStatus(): Promise<SlackStatusResp> {
  const r = await fetch("/api/slack/me");
  return (await r.json()) as SlackStatusResp;
}

export async function fetchSlackMessages(): Promise<SlackTasksResp> {
  const r = await fetch("/api/slack/tasks");
  return (await r.json()) as SlackTasksResp;
}

function inferType(text: string): Task["type"] {
  const n = text.toLowerCase();
  if (/\b(bug|fix|regression|broken|error|crash|fails?)\b/.test(n)) return "Bug fix";
  if (/\b(refactor|cleanup|migrate)\b/.test(n)) return "Refactor";
  if (/\b(chore|bump|upgrade|deps|dependency)\b/.test(n)) return "Chore";
  return "Feature";
}

// First line (trimmed) makes the task title; the rest becomes the description.
function splitTitle(text: string): { title: string; description: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const first = lines[0] ?? "Slack QA request";
  const title = first.length > 90 ? `${first.slice(0, 87)}…` : first;
  return { title, description: lines.join("\n") };
}

function parsePr(text: string): number {
  const m = text.match(/github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/i);
  return m ? Number(m[1]) : 0;
}

export function slackMessageToTask(raw: RawSlackMessage, products: Product[], devs: Dev[]): Task {
  const { title, description } = splitTitle(raw.text);
  const productId = inferProductId(`${raw.channel} ${raw.text}`, products);
  const dev = raw.author ? devs.find((d) => d.name.toLowerCase() === raw.author.toLowerCase()) : undefined;
  const prUrl = raw.text.match(/https?:\/\/github\.com\/\S+\/pull\/\d+/i)?.[0] ?? "";
  const slack: SlackLink = {
    channel: raw.channel,
    channelId: raw.channelId,
    ts: raw.ts,
    permalink: raw.permalink,
    author: raw.author,
  };

  return {
    id: `slack-${raw.channelId}-${raw.ts.replace(".", "")}`,
    title,
    description,
    acceptanceCriteria: "",
    type: inferType(raw.text),
    priority: /\b(urgent|asap|critical|p0|high)\b/i.test(raw.text) ? "High" : "Medium",
    productId,
    pr: parsePr(raw.text),
    branch: "",
    environment: "staging",
    devId: dev?.id ?? "",
    createdAt: raw.createdAt,
    status: "assigned",
    failIndex: null,
    tests: [],
    activity: [
      {
        id: `a-slack-${raw.ts}`,
        icon: "assign",
        html: `Assigned in <b>Slack</b> ${raw.channel}${raw.author ? ` · by ${raw.author}` : ""}`,
        at: raw.createdAt,
      },
    ],
    issue: null,
    devResponded: null,
    run: { running: false, progress: 0, currentTestId: null },
    ownership: "unclaimed",
    pickedUpAt: null,
    clearedAt: null,
    testArtifacts: { plan: false, scenarios: false, cases: false },
    origin: "slack",
    slack,
    links: {
      slackThread: raw.permalink,
      pullRequest: prUrl || raw.permalink,
      branchUrl: prUrl || raw.permalink,
      repository: prUrl ? prUrl.split("/pull/")[0] : "",
    },
  };
}
