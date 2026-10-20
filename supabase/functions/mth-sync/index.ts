// Mark Talks Health: tell the email service about a new list sign-up or account.
// POST { action: "list_join", email }            (anyone; only works for someone who just joined the list)
// POST { action: "signup" }                       (signed-in member; uses their own email)
// POST { action: "status" | "test" }              (admin only)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { providers, syncContact } from "./sync.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const SB_URL = Deno.env.get("SUPABASE_URL")!, SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!, SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` };

async function member(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth) return null;
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json(); return u && u.id ? { id: u.id as string, email: String(u.email || "").toLowerCase(), auth } : null;
}
async function isAdmin(auth: string) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/mth_is_admin`, { method: "POST", headers: { apikey: SB_ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
async function contact(email: string) {
  const r = await fetch(`${SB_URL}/rest/v1/mth_contacts?select=email,name,source,list_opt_in,first_touch,updated_at&email=eq.${encodeURIComponent(email)}`, { headers: svc });
  const rows = r.ok ? await r.json() : []; return rows[0] || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");
    if (action === "list_join") {
      const email = String(b.email || "").trim().toLowerCase();
      const c = email && await contact(email);
      if (!c || !c.list_opt_in || Date.now() - Date.parse(c.updated_at) > 15 * 60 * 1000) return json({ ok: false, reason: "not_recent" });
      const out = await syncContact({ email, name: c.name, event: "list_join", source: c.source, utm: c.first_touch });
      return json({ ok: true, synced: out.length });
    }
    const me = await member(req);
    if (!me) return json({ error: "sign_in_required" }, 401);
    if (action === "signup") {
      const c = await contact(me.email);
      const out = await syncContact({ email: me.email, name: c?.name, event: "signup", source: c?.source, utm: c?.first_touch });
      return json({ ok: true, synced: out.length });
    }
    if (!(await isAdmin(me.auth))) return json({ error: "admins_only" }, 403);
    if (action === "status") return json({ providers: providers(), hook: !!(Deno.env.get("HOOK_SECRET") || "").trim(), stripe: !!(Deno.env.get("STRIPE_SECRET_KEY") || "").trim(), stripe_webhook: !!(Deno.env.get("STRIPE_WEBHOOK_SECRET") || "").trim(), live_allowed: Deno.env.get("ALLOW_LIVE") === "true" });
    if (action === "test") return json({ results: await syncContact({ email: me.email, name: "Mark", event: "test", source: "admin-test" }) });
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e); return json({ error: "server" }, 500);
  }
});
