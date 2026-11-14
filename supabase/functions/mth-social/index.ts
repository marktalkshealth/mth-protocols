// Mark Talks Health: mth-social — auto-posting + comment auto-DMs (the engine itself is in core.ts).
// Called three ways:
//   * pg_cron every 2 minutes  -> { action: "tick" } with the x-mth-cron secret (only while a switch is on)
//   * the Admin screen         -> admin-only actions (status, connect, switches, run now, retry)
//   * Google's sign-in page    -> GET ?code=...&state=... when Mark connects YouTube
// Tokens are kept encrypted in Supabase Vault (never in the browser, never in a table an admin screen can read).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ApiError, makeEngine, type DmRow, type Json, type Keyword, type Post, type Settings, type Store } from "./core.ts";
import { makeLab, type AutoRef, type Item, type LabStore } from "./lab.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!, SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!, SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
const SELF = `${SB_URL}/functions/v1/mth-social`;
const ADMIN = "https://marktalkshealth.com/admin.html";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const must = <T>(r: { data: T; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data; };

const store: Store = {
  async settings() { return must(await db.from("mth_social_settings").select("*").eq("id", 1).single()) as Settings; },
  async saveSettings(patch) { must(await db.from("mth_social_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1)); },
  async secret(name) { return (must(await db.rpc("mth_social_secret_get", { p_name: name })) as string | null) || null; },
  async setSecret(name, value) { must(await db.rpc("mth_social_secret_set", { p_name: name, p_value: value || "" })); },
  async duePosts(nowIso, sinceIso) {
    return (must(await db.from("mth_posts").select("id,title,status,format,platforms,publish_at,caption,captions,hashtags,cta,slug,media_urls,first_comment,youtube_title,auto_publish,publish_state")
      .eq("auto_publish", true).in("status", ["ready", "scheduled"]).lte("publish_at", nowIso).gte("publish_at", sinceIso).order("publish_at").limit(20)) || []) as Post[];
  },
  async savePost(id, patch) { must(await db.from("mth_posts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id)); },
  async keywords() { return (must(await db.from("mth_dm_keywords").select("*").eq("active", true)) || []) as Keyword[]; },
  async seenComments(platform, ids) {
    if (!ids.length) return new Set();
    const rows = must(await db.from("mth_dm_log").select("comment_id").eq("platform", platform).in("comment_id", ids)) || [];
    return new Set((rows as { comment_id: string }[]).map((r) => r.comment_id));
  },
  async claimDm(row: DmRow) {
    const r = await db.from("mth_dm_log").insert({ ...row, detail: "sending" });
    if (r.error) { if (r.error.code === "23505") return false; throw new Error(r.error.message); }
    return true;
  },
  async finishDm(platform, comment_id, patch) { must(await db.from("mth_dm_log").update(patch).eq("platform", platform).eq("comment_id", comment_id)); },
  async keywordHit(id) { await db.rpc("mth_dm_keyword_hit", { p_id: id }); },
  async log(row) { await db.from("mth_sync_log").insert({ email: null, event: row.event, provider: row.provider, ok: row.ok, detail: row.detail.slice(0, 500) }); },
};
// the testing lab's own reads and writes (results over time, comments)
const ITEM_COLS = "id,platform,external_id,posted_at,last_snap_at,via,post_id,comments,comments_pulled,duration_sec";
const labStore: LabStore = {
  settings: store.settings, saveSettings: store.saveSettings, secret: store.secret,
  async autoRefs(sinceIso) {
    const rows = must(await db.from("mth_posts").select("id,publish_state,experiment_id,variant").eq("auto_publish", true).gte("publish_at", sinceIso).limit(500)) || [];
    const out: Record<string, AutoRef> = {};
    for (const r of rows as { id: number; publish_state: Record<string, { id?: string }> | null; experiment_id: number | null; variant: string | null }[])
      for (const [pl, st] of Object.entries(r.publish_state || {})) if (st && st.id) out[`${pl}:${st.id}`] = { post_id: r.id, experiment_id: r.experiment_id, variant: r.variant };
    return out;
  },
  async items(platform, sinceIso) { return (must(await db.from("mth_social_items").select(ITEM_COLS).eq("platform", platform).eq("gone", false).gte("posted_at", sinceIso).order("posted_at", { ascending: false }).limit(300)) || []) as Item[]; },
  async addItems(rows) { must(await db.from("mth_social_items").upsert(rows, { onConflict: "platform,external_id", ignoreDuplicates: true })); },
  async linkItem(id, ref) { must(await db.from("mth_social_items").update({ via: "auto", post_id: ref.post_id, experiment_id: ref.experiment_id, variant: ref.variant }).eq("id", id)); },
  async snapshot(item, nums, raw, ageHours, nowIso) {
    must(await db.from("mth_social_snapshots").insert({ item_id: item.id, captured_at: nowIso, age_hours: Math.round(ageHours * 100) / 100, ...nums, raw }));
    const latest: Json = { last_snap_at: nowIso };
    for (const [k, v] of Object.entries(nums)) if (v !== null && v !== undefined) latest[k] = v;   // a number the platform didn't send this time keeps its last value
    must(await db.from("mth_social_items").update(latest).eq("id", item.id));
  },
  async saveComments(rows) { must(await db.from("mth_social_comments").upsert(rows, { onConflict: "platform,comment_id", ignoreDuplicates: true })); },
  async markPulled(id, count) { must(await db.from("mth_social_items").update({ comments_pulled: count }).eq("id", id)); },
};
// deno-lint-ignore prefer-const
let lab: ReturnType<typeof makeLab>;
const engine = makeEngine({ store, fetch: (...a) => fetch(...a), now: () => Date.now(), env: (k) => (Deno.env.get(k) || "").trim(), after: (until) => lab.run(until) });
lab = makeLab({ store: labStore, engine, now: () => Date.now() });

async function isAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const a = await fetch(`${SB_URL}/rest/v1/rpc/mth_is_admin`, { method: "POST", headers: { apikey: SB_ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  return a.ok && (await a.json()) === true;
}
const has = async (name: string) => !!(await store.secret(name));

async function status() {
  const s = await store.settings() as Settings & Json;
  const [meta, ytClient, ytRefresh] = await Promise.all([has("mth_social_fb_page_token"), has("mth_social_yt_client_id"), has("mth_social_yt_refresh")]);
  const { tick_lock_until: _l, ...safe } = s as Json;
  return { ok: true, settings: safe, meta_connected: meta && !!s.fb_page_id, yt_client: ytClient, yt_connected: ytRefresh && !!s.yt_channel_id, redirect_uri: SELF };
}

const CRON_PAUSED = true;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Google sends Mark back here after he says yes to YouTube
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    const back = (msg: string, ok: boolean) => Response.redirect(`${ADMIN}?yt=${ok ? "ok" : "error"}&m=${encodeURIComponent(msg)}#autopost`, 302);
    if (q.get("error")) return back(q.get("error") || "cancelled", false);
    if (!q.get("code")) return json({ ok: true, service: "mth-social" });
    try { const r = await engine.ytCallback(String(q.get("code")), String(q.get("state") || ""), SELF); return back(String(r.channel || "connected"), true); }
    catch (e) { return back(String((e as Error).message || e).slice(0, 200), false); }
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");

    // PAUSED Nov 14 2026 (Supabase Disk IO budget ran out): the 2-minute background tick does nothing.
    // To resume: set CRON_PAUSED = false below and redeploy.
    if (action === "tick" && CRON_PAUSED) return json({ ok: true, paused: true });
    if (action === "tick") {
      const { data: ok } = await db.rpc("mth_mail_cron_ok", { p_secret: String(req.headers.get("x-mth-cron") || "") });
      if (!ok) return json({ error: "bad_secret" }, 401);
      const { data: mine } = await db.rpc("mth_social_claim_tick", { p_seconds: 170 });
      if (!mine) return json({ ok: true, skipped: "already_running" });
      return json(await engine.tick());
    }

    if (!(await isAdmin(req))) return json({ error: "admins_only" }, 403);
    try {
      switch (action) {
        case "status": return json(await status());
        case "meta_connect": return json(await engine.connectMeta(String(b.token || "")));
        case "meta_pick_page": return json(await engine.pickPage(String(b.page_id || "")));
        case "meta_test": return json(await engine.testMeta());
        case "meta_disconnect": return json(await engine.disconnectMeta());
        case "set_switch": {
          const s = await store.settings(), patch: Json = {};
          if (typeof b.posting === "boolean") {
            if (b.posting && !(await has("mth_social_fb_page_token"))) return json({ error: "Connect your Facebook Page and Instagram first." }, 400);
            patch.enabled = b.posting;
          }
          if (typeof b.dms === "boolean") {
            if (b.dms && !(await has("mth_social_fb_page_token")) && !s.yt_channel_id) return json({ error: "Connect Meta or YouTube first." }, 400);
            patch.dm_enabled = b.dms;
            if (b.dms && !s.dm_enabled) patch.dm_enabled_at = new Date().toISOString();   // only comments from now on get answered
          }
          await store.saveSettings(patch);
          return json(await status());
        }
        case "run_now": {
          const { data: mine } = await db.rpc("mth_social_claim_tick", { p_seconds: 170 });
          if (!mine) return json({ error: "It’s already running. Try again in a minute." }, 409);
          return json({ ok: true, result: await engine.tick() });
        }
        case "lab_run": {   // "Refresh the numbers now" on the Tests & results screen
          const { data: mine } = await db.rpc("mth_social_claim_tick", { p_seconds: 170 });
          if (!mine) return json({ error: "It’s already running. Try again in a minute." }, 409);
          try { return json({ ok: true, result: await lab.run(Date.now() + 100e3, true) }); }
          finally { await store.saveSettings({ tick_lock_until: null }); }
        }
        case "set_metrics": { await store.saveSettings({ metrics_enabled: !!b.on }); return json(await status()); }
        case "retry": {
          const r = await db.from("mth_posts").select("id,publish_state").eq("id", Number(b.post_id)).single();
          if (r.error || !r.data) return json({ error: "Post not found." }, 404);
          return json(await engine.retry(r.data as unknown as Post, String(b.platform || "")));
        }
        case "yt_save_client": {
          const id = String(b.client_id || "").trim(), secret = String(b.client_secret || "").trim();
          if (!/\.apps\.googleusercontent\.com$/.test(id) || secret.length < 10) return json({ error: "Paste both the client ID (ends in .apps.googleusercontent.com) and the client secret." }, 400);
          await store.setSecret("mth_social_yt_client_id", id); await store.setSecret("mth_social_yt_client_secret", secret);
          return json(await status());
        }
        case "yt_auth_url": return json(await engine.ytAuthUrl(SELF));
        case "yt_disconnect": return json(await engine.ytDisconnect());
        default: return json({ error: "unknown_action" }, 400);
      }
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, 400);
      throw e;
    }
  } catch (e) {
    console.error(e);
    return json({ error: "server", message: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
