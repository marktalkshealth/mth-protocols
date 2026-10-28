// Mark Talks Health: course videos on Cloudflare Stream.
// Videos are uploaded straight from the admin page to Cloudflare (resumable, any size) and saved as
// "stream:<id>" in mth_videos (any number per course section, in Mark's order; older lesson videos in
// mth_lesson_media still play). Every video requires a signed link: only signed-in members who own the
// course (or admins) get a player link, and each link expires after 6 hours.
// Secrets: CF_ACCOUNT_ID, CF_STREAM_TOKEN (API token with "Stream: Edit").
// POST { action: "check" }                                    anyone: is Stream set up? (yes/no only)
// POST { action: "status" }                                   admin: is Stream set up?
// POST { action: "upload", size, name, product, lesson_id }   admin: a one-time upload link
// POST { action: "state", uid }                               admin: processing progress
// POST { action: "delete", uid }                              admin: remove a video from Cloudflare (only if nothing uses it)
// POST { action: "play", product, video_id }                  member: a signed player link (section video)
// POST { action: "play", product, lesson_id }                 member: a signed player link (older lesson video)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Expose-Headers": "Location" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const SB_URL = Deno.env.get("SUPABASE_URL")!, SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ACC = () => (Deno.env.get("CF_ACCOUNT_ID") || "").trim();
const TOKEN = () => (Deno.env.get("CF_STREAM_TOKEN") || "").trim();
const CF = () => `https://api.cloudflare.com/client/v4/accounts/${ACC()}/stream`;
const cfh = () => ({ Authorization: `Bearer ${TOKEN()}` });

async function rpc(req: Request, name: string, args: unknown = {}) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth) return null;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: SB_ANON, Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  return r.ok ? await r.json() : null;
}
// read rows as the caller (row-level security means members only see courses they own)
async function rows(req: Request, path: string) {
  const auth = req.headers.get("Authorization") || "";
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_ANON, Authorization: auth } });
  return r.ok ? await r.json() : [];
}
const enc = encodeURIComponent;
async function lessonVideo(req: Request, product: string, lesson: string) {
  const r = await rows(req, `mth_lesson_media?select=video_url&product=eq.${enc(product)}&lesson_id=eq.${enc(lesson)}`);
  return String(r?.[0]?.video_url || "");
}
async function sectionVideo(req: Request, product: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return "";
  const r = await rows(req, `mth_videos?select=video_url&product=eq.${enc(product)}&id=eq.${enc(id)}`);
  return String(r?.[0]?.video_url || "");
}
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
let customer = ""; // the account's player address, e.g. customer-abc123.cloudflarestream.com
async function playerHost(uid: string) {
  if (customer) return customer;
  const r = await fetch(`${CF()}/${uid}`, { headers: cfh() });
  const j = await r.json().catch(() => ({}));
  const m = /https:\/\/(customer-[a-z0-9]+\.cloudflarestream\.com)/.exec(String(j?.result?.preview || j?.result?.playback?.hls || ""));
  if (m) customer = m[1];
  return customer;
}
async function cfCheck() {
  const r = await fetch(`${CF()}?limit=1`, { headers: cfh() });
  const j = await r.json().catch(() => ({}));
  return r.ok && j?.success ? "" : `Cloudflare said ${r.status}: ${(j?.errors || []).map((e: { code: number; message: string }) => e.code + " " + e.message).join("; ") || "no details"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");
    const ready = !!(ACC() && TOKEN());

    if (action === "check") {
      const out: Record<string, unknown> = { hasAccount: !!ACC(), hasToken: !!TOKEN(), accountLooksRight: /^[a-f0-9]{32}$/.test(ACC()) };
      if (ready) { const p = await cfCheck(); out.cloudflare = p || "ok"; }
      return json(out);
    }

    if (action === "play") {
      const product = String(b.product || "");
      const owns = (await rpc(req, "mth_has", { p_product: product })) === true || (await rpc(req, "mth_is_admin")) === true;
      if (!owns) return json({ error: "not_yours" }, 403);
      const v = b.video_id ? await sectionVideo(req, product, String(b.video_id)) : await lessonVideo(req, product, String(b.lesson_id || ""));
      const uid = (/^stream:([a-f0-9]{32})$/i.exec(v) || [])[1];
      if (!uid) return json({ error: "no_video" }, 404);
      if (!ready) return json({ error: "stream_not_set_up" }, 500);
      const t = await fetch(`${CF()}/${uid}/token`, { method: "POST", headers: { ...cfh(), "Content-Type": "application/json" }, body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 6 * 3600 }) });
      const tj = await t.json().catch(() => ({}));
      const token = tj?.result?.token;
      if (!token) return json({ error: "token_failed", detail: tj?.errors?.[0]?.message || "" }, 502);
      const host = await playerHost(uid);
      const src = host ? `https://${host}/${token}/iframe?primaryColor=%23c0623f&letterboxColor=transparent` : `https://iframe.videodelivery.net/${token}?primaryColor=%23c0623f`;
      return json({ src });
    }

    if ((await rpc(req, "mth_is_admin")) !== true) return json({ error: "admins_only" }, 403);
    if (action === "status") {
      if (!ready) return json({ ready: false, problem: !ACC() ? "CF_ACCOUNT_ID is missing in Supabase secrets." : "CF_STREAM_TOKEN is missing in Supabase secrets." });
      const p = await cfCheck();
      return json({ ready: !p, problem: p });
    }
    if (!ready) return json({ error: "Cloudflare Stream isn't connected yet: add CF_ACCOUNT_ID and CF_STREAM_TOKEN in Supabase secrets." }, 400);

    if (action === "upload") {
      const size = Number(b.size) || 0;
      if (!size) return json({ error: "no_size" }, 400);
      const name = `${String(b.product || "")}/${String(b.lesson_id || "")} ${String(b.name || "")}`.slice(0, 200);
      // one-time resumable (tus) upload link; the video always needs a signed link to play
      const r = await fetch(`${CF()}?direct_user=true`, {
        method: "POST",
        headers: { ...cfh(), "Tus-Resumable": "1.0.0", "Upload-Length": String(size), "Upload-Metadata": `name ${b64(name)},requiresignedurls,maxdurationseconds ${b64("21600")}` },
      });
      const url = r.headers.get("Location"), uid = r.headers.get("stream-media-id");
      if (!r.ok || !url || !uid) return json({ error: "Cloudflare refused the upload: " + (await r.text()).slice(0, 240) }, 502);
      return json({ url, uid });
    }
    if (action === "state") {
      const uid = String(b.uid || "");
      if (!/^[a-f0-9]{32}$/i.test(uid)) return json({ error: "bad_uid" }, 400);
      const r = await fetch(`${CF()}/${uid}`, { headers: cfh() });
      const j = await r.json().catch(() => ({}));
      const st = j?.result?.status || {};
      return json({ ready: !!j?.result?.readyToStream, state: st.state || "", pct: Number(st.pctComplete || 0), minutes: Math.round((Number(j?.result?.duration) || 0) / 6) / 10, error: st.errorReasonText || "" });
    }
    if (action === "delete") {
      const uid = String(b.uid || "");
      if (!/^[a-f0-9]{32}$/i.test(uid)) return json({ error: "bad_uid" }, 400);
      const ref = enc(`stream:${uid}`);
      const used = (await rows(req, `mth_videos?select=id&video_url=eq.${ref}`)).length + (await rows(req, `mth_lesson_media?select=lesson_id&video_url=eq.${ref}`)).length;
      if (used) return json({ kept: true });
      const r = await fetch(`${CF()}/${uid}`, { method: "DELETE", headers: cfh() });
      return json({ deleted: r.ok || r.status === 404 });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e); return json({ error: "server: " + String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
