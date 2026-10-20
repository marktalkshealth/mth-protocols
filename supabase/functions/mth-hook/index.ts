// Mark Talks Health: receive leads from other tools (ManyChat "External Request", Zapier, Make, Metricool exports…).
// POST https://<project>.supabase.co/functions/v1/mth-hook
//   header  X-MTH-Secret: <HOOK_SECRET>      (or ?key=<HOOK_SECRET> in the address, for tools that can't set headers)
//   body    { "email": "...", "name": "...", "tags": ["manychat","gut"], "source": "manychat" }
// The person is added to the CRM (with tags) and sent on to the email service.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { syncContact } from "./sync.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const SB_URL = Deno.env.get("SUPABASE_URL")!, SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function same(a: string, b: string) { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const secret = (Deno.env.get("HOOK_SECRET") || "").trim();
  if (!secret) return json({ error: "hook_not_switched_on" }, 503);
  const given = req.headers.get("x-mth-secret") || new URL(req.url).searchParams.get("key") || "";
  if (!same(given, secret)) return json({ error: "bad_secret" }, 401);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || b.email_address || "").trim().toLowerCase();
  const name = String(b.name || b.first_name || "").trim() || null;
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : typeof b.tags === "string" ? b.tags.split(",") : [];
  const source = String(b.source || "webhook").slice(0, 40);
  const r = await fetch(`${SB_URL}/rest/v1/rpc/mth_hook_contact`, { method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_email: email, p_name: name, p_tags: tags, p_source: source, p_opt_in: b.opt_in !== false }) });
  const res = r.ok ? await r.json() : "error";
  if (res !== "ok") return json({ ok: false, error: res === "invalid" ? "invalid_email" : "save_failed" }, 400);
  await syncContact({ email, name, event: "list_join", source, utm: { utm_source: source, utm_medium: "dm" } });
  return json({ ok: true });
});
