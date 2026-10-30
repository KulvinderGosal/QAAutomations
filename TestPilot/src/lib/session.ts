// Per-page-load write nonce (G3 API hardening).
//
// The server's four direct third-party WRITE routes (/api/asana/comment,
// /api/asana/complete-task, /api/github/close-issue, /api/github/comment) require
// an X-TP-Nonce header issued by GET /api/session/nonce. We fetch it once per page
// load (module-level cache) and attach it to those calls only. If the server was
// restarted (nonces are in-memory) it answers 403 {code:"bad-nonce"}; we then
// fetch a fresh nonce and retry ONCE — the server refused before doing anything,
// so the retry cannot double-write.

let noncePromise: Promise<string> | null = null;

export function getSessionNonce(refresh = false): Promise<string> {
  if (refresh || !noncePromise) {
    noncePromise = fetch("/api/session/nonce", { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => {
        const b = (await r.json().catch(() => ({}))) as { nonce?: string; error?: string };
        if (!r.ok || !b.nonce) throw new Error(b.error || `Could not get a TestPilot session nonce (${r.status})`);
        return b.nonce;
      })
      .catch((e: unknown) => {
        noncePromise = null; // let the next write try again
        throw e;
      });
  }
  return noncePromise;
}

/** fetch() for a nonce-gated write route: sends X-TP-Nonce, refreshes + retries once on a stale nonce. */
export async function fetchWithNonce(input: string, init: RequestInit = {}): Promise<Response> {
  const send = async (nonce: string) => {
    const headers = new Headers(init.headers);
    headers.set("X-TP-Nonce", nonce);
    return fetch(input, { ...init, headers });
  };
  const r = await send(await getSessionNonce());
  if (r.status !== 403) return r;
  const b = (await r
    .clone()
    .json()
    .catch(() => null)) as { code?: string } | null;
  if (b?.code !== "bad-nonce") return r;
  return send(await getSessionNonce(true));
}
