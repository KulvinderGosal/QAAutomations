// Server-side Slack Web API client.
// Runs inside the Vite dev server (Node) — never in the browser — so the bot
// token stays on this side of the wire and is never bundled into client code.
//
// Reads a QA channel's recent messages and surfaces the ones that look like a
// developer handing a build/PR to QA. Requires a bot token (xoxb-…) with the
// scopes: channels:read, channels:history (or groups:* for private), users:read.
const BASE = "https://slack.com/api";

export class SlackError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "SlackError";
  }
}

// Slack always replies 200 with { ok: false, error } on failure, so we inspect
// the body rather than the HTTP status.
async function slackGet<T = Record<string, unknown>>(
  token: string,
  path: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (e) {
    throw new SlackError(502, `Could not reach Slack: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T;
  if (!res.ok) throw new SlackError(res.status, res.statusText || "Slack request failed");
  if (!body.ok) {
    const err = body.error || "slack_error";
    const friendly =
      err === "invalid_auth" || err === "not_authed"
        ? "Invalid or expired Slack bot token"
        : err === "not_in_channel"
          ? "The bot isn't a member of that channel — /invite it to the QA channel"
          : err === "channel_not_found"
            ? "QA channel not found — check SLACK_QA_CHANNEL"
            : err;
    throw new SlackError(400, friendly);
  }
  return body;
}

// POST counterpart of slackGet — for write methods (chat.postMessage). Same
// {ok:false,error} inspection. The bot token needs `chat:write` (and to be a
// member of the target channel).
async function slackPost<T = Record<string, unknown>>(
  token: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<T & { ok?: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new SlackError(502, `Could not reach Slack: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T;
  if (!body.ok) {
    const err = body.error || "slack_error";
    const friendly =
      err === "invalid_auth" || err === "not_authed"
        ? "Invalid or expired Slack bot token"
        : err === "missing_scope"
          ? "Slack bot token is missing the chat:write scope"
          : err === "not_in_channel"
            ? "The bot isn't a member of that channel — /invite it to the QA channel"
            : err === "channel_not_found"
              ? "QA channel not found — check SLACK_QA_CHANNEL"
              : err;
    throw new SlackError(400, friendly);
  }
  return body;
}

/**
 * Post a plain message to a channel (name like "qa-automation"/"#qa-automation"
 * or a channel ID). Returns the message ts. Used for scheduled-run failure
 * alerts. Requires chat:write + the bot to be in the channel.
 */
export async function postMessage(
  token: string,
  channel: string,
  text: string,
): Promise<{ ts: string; channel: string }> {
  if (!token) throw new SlackError(400, "No Slack bot token configured (SLACK_BOT_TOKEN)");
  const chan = await resolveChannel(token, channel);
  const r = await slackPost<{ ts: string; channel: string }>(token, "/chat.postMessage", {
    channel: chan.id,
    text,
    unfurl_links: false,
    unfurl_media: false,
  });
  return { ts: r.ts, channel: r.channel };
}

export type SlackTeam = { name: string; url: string; teamId: string; userId: string };

export type NormalizedSlackMessage = {
  ts: string;
  text: string;
  author: string;
  authorId: string;
  permalink: string;
  channel: string;
  channelId: string;
  createdAt: string;
};

// A message reads as a QA hand-off if it explicitly mentions QA / testing /
// shipping a build, or carries a GitHub PR link.
const QA_HINT = /\b(qa|ready for test|please test|test this|ready for review|ship(ped)?|build\s*v?\d|deploy(ed)?|pull request|\bpr\b)\b/i;
const PR_LINK = /github\.com\/[\w.-]+\/[\w.-]+\/(?:pull|compare)\//i;

function looksLikeAssignment(text: string): boolean {
  return QA_HINT.test(text) || PR_LINK.test(text);
}

export async function getTeam(token: string): Promise<SlackTeam> {
  const r = await slackGet<{ team: string; url: string; team_id: string; user_id: string }>(
    token,
    "/auth.test",
  );
  return { name: r.team, url: r.url, teamId: r.team_id, userId: r.user_id };
}

async function resolveChannel(token: string, channel: string): Promise<{ id: string; name: string }> {
  const clean = channel.replace(/^#/, "").trim();
  if (/^[CG][A-Z0-9]{6,}$/.test(channel)) return { id: channel, name: clean };
  const r = await slackGet<{ channels: { id: string; name: string }[] }>(
    token,
    "/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=1000",
  );
  const found = (r.channels || []).find((c) => c.name === clean);
  if (!found) throw new SlackError(404, `QA channel #${clean} not found or bot lacks access`);
  return found;
}

export async function listQaMessages(
  token: string,
  channel: string,
): Promise<{ team: SlackTeam; channel: string; channelId: string; messages: NormalizedSlackMessage[] }> {
  const team = await getTeam(token);
  const chan = await resolveChannel(token, channel);

  const history = await slackGet<{
    messages: { type?: string; subtype?: string; bot_id?: string; user?: string; text?: string; ts: string }[];
  }>(token, `/conversations.history?channel=${chan.id}&limit=50`);

  // One users.list call → id→name map, so we never fan out per-message.
  const users = await slackGet<{ members: { id: string; real_name?: string; name?: string }[] }>(
    token,
    "/users.list?limit=1000",
  ).catch(() => ({ members: [] as { id: string; real_name?: string; name?: string }[] }));
  const nameById = new Map((users.members || []).map((m) => [m.id, m.real_name || m.name || ""]));

  const base = team.url.replace(/\/$/, "");
  const messages: NormalizedSlackMessage[] = (history.messages || [])
    .filter((m) => !m.bot_id && !m.subtype && (m.type ?? "message") === "message" && m.text)
    .filter((m) => looksLikeAssignment(m.text!))
    .map((m) => ({
      ts: m.ts,
      text: (m.text || "").replace(/<([^|>]+)\|([^>]+)>/g, "$2").replace(/<([^>]+)>/g, "$1"),
      author: (m.user && nameById.get(m.user)) || "Slack teammate",
      authorId: m.user || "",
      permalink: `${base}/archives/${chan.id}/p${m.ts.replace(".", "")}`,
      channel: `#${chan.name}`,
      channelId: chan.id,
      createdAt: new Date(Number(m.ts.split(".")[0]) * 1000).toISOString(),
    }));

  return { team, channel: `#${chan.name}`, channelId: chan.id, messages };
}
