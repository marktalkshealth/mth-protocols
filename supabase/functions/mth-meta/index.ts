// Mark Talks Health: Meta (Facebook / Instagram) Conversions API.
// Every 15 minutes (pg_cron) this sends new sign-ups and purchases to Meta so ads can be measured.
// Privacy by design: only the event type, a hashed email, the ad-click ids and the sale value are sent.
// No product names, page names, symptoms or intake answers ever leave the site.
//   Lead                 ← someone joins the email list
//   CompleteRegistration ← someone creates an account
//   Purchase             ← someone buys (value in USD)
// Each one is ALSO sent as a neutral custom event (mth_signup, mth_account, mth_order). Meta can restrict
// health & wellness accounts from optimising for standard events like Lead and Purchase, but custom events
// stay usable, so ads can be optimised for "mth_signup" / "mth_order" if that ever happens.
// Admin actions: status (for the Connections card), run_now,
//   ads_report (spend per campaign / ad set / ad, read with META_ADS_TOKEN), set_status (pause / turn on), set_budget (daily budget).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!, SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!, SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const env = (k: string) => (Deno.env.get(k) || "").trim();
const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
const PIXEL = env("META_PIXEL_ID") || "986888890506760";
const API = "https://graph.facebook.com/v24.0";
const AD_ACCOUNT = "act_" + (env("META_AD_ACCOUNT") || "1447695620902736").replace(/^act_/, "");
const SITE = "https://marktalkshealth.com/";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MAP: Record<string, string> = { list_join: "Lead", signup: "CompleteRegistration", purchase: "Purchase" };
const CUSTOM: Record<string, string> = { list_join: "mth_signup", signup: "mth_account", purchase: "mth_order" };

async function sha(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toLowerCase()));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
type Ev = { id: number; anon_id: string | null; email: string | null; event: string; utm: Record<string, string> | null; value_cents: number | null; created_at: string };

/* find the ad-click ids for this person: this event, their other visits, or their contact record */
async function clickIds(e: Ev) {
  const pick = (u: Record<string, string> | null | undefined) => u && (u.fbc || u.fbp) ? u : null;
  let u = pick(e.utm);
  if (!u && e.anon_id) {
    const { data } = await db.from("mth_events").select("utm").eq("anon_id", e.anon_id).not("utm", "is", null).order("id", { ascending: false }).limit(30);
    u = (data || []).map((r) => pick(r.utm)).find(Boolean) || null;
  }
  if (!u && e.email) {
    const { data } = await db.from("mth_contacts").select("first_touch").eq("email", e.email).maybeSingle();
    u = pick(data?.first_touch);
  }
  return u || {};
}

async function run() {
  const token = env("META_CAPI_TOKEN");
  if (!token) return { ok: false, reason: "no_token" };
  const since = new Date(Date.now() - 6.5 * 864e5).toISOString();     // Meta accepts events up to 7 days old
  const { data: done } = await db.from("mth_meta_sent").select("event_id").gte("created_at", new Date(Date.now() - 8 * 864e5).toISOString());
  const seen = new Set((done || []).map((d) => d.event_id));
  const { data: admins } = await db.from("mth_admins").select("email");
  const skip = new Set([...(admins || []).map((a) => String(a.email).toLowerCase()), "markwalker9523@gmail.com", "marktalkshealth@gmail.com"]);   // Mark's own logins: tests never count
  const { data: evs } = await db.from("mth_events").select("id,anon_id,email,event,utm,value_cents,created_at")
    .in("event", Object.keys(MAP)).gte("created_at", since).order("id").limit(400);
  const todo = ((evs || []) as Ev[]).filter((e) => !seen.has(e.id) && e.email);
  if (!todo.length) return { ok: true, sent: 0 };
  const out: Record<string, unknown>[] = [], ids: number[] = [], skipped: number[] = [];
  for (const e of todo) {
    if (skip.has(String(e.email).toLowerCase())) { skipped.push(e.id); continue; }   // your own tests don't count
    const c = await clickIds(e);
    const user: Record<string, unknown> = { em: [await sha(e.email!)] };
    if (e.anon_id) user.external_id = [await sha(e.anon_id)];
    if (c.fbc) user.fbc = c.fbc;
    if (c.fbp) user.fbp = c.fbp;
    if (c.ua) user.client_user_agent = c.ua;
    const ev: Record<string, unknown> = {
      event_name: MAP[e.event], event_time: Math.floor(new Date(e.created_at).getTime() / 1000),
      event_id: "mth-" + e.id, action_source: "website", event_source_url: SITE, user_data: user,
    };
    if (e.event === "purchase") ev.custom_data = { currency: "USD", value: (e.value_cents || 0) / 100 };
    out.push(ev);
    out.push({ ...ev, event_name: CUSTOM[e.event], event_id: "mthc-" + e.id });   // the restriction-proof twin
    ids.push(e.id);
  }
  if (skipped.length) await db.from("mth_meta_sent").upsert(skipped.map((id) => ({ event_id: id, ok: true, detail: "skipped: admin test" })));
  if (!out.length) return { ok: true, sent: 0, skipped: skipped.length };
  const body: Record<string, unknown> = { data: out };
  if (env("META_TEST_CODE")) body.test_event_code = env("META_TEST_CODE");
  const r = await fetch(`${API}/${PIXEL}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const t = await r.text();
  const detail = r.ok ? "sent" : `${r.status} ${t.slice(0, 250)}`;
  // a bad token or a Meta outage: don't mark as done, retry next run (events stay valid for 7 days)
  if (r.ok) await db.from("mth_meta_sent").upsert(ids.map((id) => ({ event_id: id, ok: true, detail })));
  await db.from("mth_sync_log").insert(todo.filter((e) => ids.includes(e.id)).map((e) => ({ email: e.email, event: e.event, provider: "meta", ok: r.ok, detail: r.ok ? MAP[e.event] + " + " + CUSTOM[e.event] : detail })));
  return { ok: r.ok, sent: r.ok ? ids.length : 0, skipped: skipped.length, error: r.ok ? undefined : detail };
}


/* ---------------- Marketing API: the Ads screen ---------------- */
const ADS_TOKEN = () => env("META_ADS_TOKEN");
async function g(path: string, params: Record<string, string> = {}) {
  const u = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", ADS_TOKEN());
  const r = await fetch(u); const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.error_user_msg || j.error?.message || `Meta said ${r.status}`);
  return j;
}
async function all(path: string, params: Record<string, string>) {   // follow paging, max 2,000 rows
  const out: Record<string, unknown>[] = [];
  let j = await g(path, { limit: "500", ...params });
  for (let i = 0; i < 4; i++) {
    out.push(...(j.data || []));
    const next = j.paging?.next; if (!next) break;
    const r = await fetch(next); j = await r.json(); if (j.error) break;
  }
  return out;
}
const day = (d: Date) => d.toISOString().slice(0, 10);
async function adsReport(days: number) {
  if (!ADS_TOKEN()) return { connected: false };
  days = Math.min(Math.max(Number(days) || 30, 1), 365);
  const until = new Date(), since = new Date(Date.now() - (days - 1) * 864e5);
  const time_range = JSON.stringify({ since: day(since), until: day(until) });
  const [account, campaigns, adsets, ads, insights] = await Promise.all([
    g(AD_ACCOUNT, { fields: "name,currency,account_status,disable_reason,amount_spent,timezone_name" }),
    all(`${AD_ACCOUNT}/campaigns`, { fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget" }),
    all(`${AD_ACCOUNT}/adsets`, { fields: "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget" }),
    all(`${AD_ACCOUNT}/ads`, { fields: "id,name,status,effective_status,campaign_id,adset_id,creative{url_tags}" }),
    all(`${AD_ACCOUNT}/insights`, { level: "ad", time_range, fields: "ad_id,spend,impressions,reach,inline_link_clicks,ctr,cpm" }),
  ]);
  return { connected: true, days, since: day(since), until: day(until), account: { ...account, id: AD_ACCOUNT }, campaigns, adsets, ads, insights };
}
/* only objects inside Mark's own ad account can be changed */
async function mine(id: string) {
  if (!/^\d{5,25}$/.test(id)) throw new Error("bad id");
  const o = await g(id, { fields: "account_id" });
  if ("act_" + o.account_id !== AD_ACCOUNT) throw new Error("That isn’t in your Mark Talks Health ad account.");
}
async function post(id: string, body: Record<string, string>) {
  const f = new URLSearchParams({ ...body, access_token: ADS_TOKEN() });
  const r = await fetch(`${API}/${id}`, { method: "POST", body: f }); const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.error_user_msg || j.error?.message || `Meta said ${r.status}`);
  return j;
}

async function isAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const a = await fetch(`${SB_URL}/rest/v1/rpc/mth_is_admin`, { method: "POST", headers: { apikey: SB_ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  return a.ok && (await a.json()) === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");
    if (action === "tick") {
      const { data: ok } = await db.rpc("mth_mail_cron_ok", { p_secret: String(req.headers.get("x-mth-cron") || "") });
      if (!ok) return json({ error: "bad_secret" }, 401);
      return json(await run());
    }
    if (!(await isAdmin(req))) return json({ error: "admins_only" }, 403);
    if (action === "status") {
      const { count } = await db.from("mth_meta_sent").select("event_id", { count: "exact", head: true }).eq("ok", true).neq("detail", "skipped: admin test");
      return json({ token: !!env("META_CAPI_TOKEN"), ads_token: !!env("META_ADS_TOKEN"), pixel: PIXEL, test_mode: !!env("META_TEST_CODE"), sent: count || 0 });
    }
    if (action === "run_now") return json(await run());
    if (action === "ads_report") {
      try { return json(await adsReport(b.days)); } catch (e) { return json({ connected: true, error: String((e as Error).message).slice(0, 300) }); }
    }
    if (action === "set_status" || action === "set_budget") {
      if (!ADS_TOKEN()) return json({ error: "Connect the ads token first." }, 400);
      const id = String(b.id || "");
      try {
        await mine(id);
        if (action === "set_status") {
          const st = String(b.status); if (st !== "ACTIVE" && st !== "PAUSED") return json({ error: "bad status" }, 400);
          await post(id, { status: st });
          await db.from("mth_sync_log").insert({ email: null, event: `ad_${st.toLowerCase()}`, provider: "meta", ok: true, detail: `${id} → ${st}` });
          return json({ ok: true });
        }
        const cents = Math.round(Number(b.daily_budget_cents));
        if (!(cents >= 100 && cents <= 50000)) return json({ error: "Daily budget must be between $1 and $500." }, 400);
        await post(id, { daily_budget: String(cents) });
        await db.from("mth_sync_log").insert({ email: null, event: "ad_budget", provider: "meta", ok: true, detail: `${id} → $${(cents / 100).toFixed(2)}/day` });
        return json({ ok: true });
      } catch (e) { return json({ error: String((e as Error).message).slice(0, 300) }, 400); }
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server", message: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
