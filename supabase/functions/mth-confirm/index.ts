// Mark Talks Health: after Stripe sends the member back, confirm the payment and unlock the protocol.
// POST { session_id }  (signed-in member's token in Authorization)  ->  { ok: true, product }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { syncContact } from "./sync.ts";
import { accountForEmail, checkoutEmail } from "./guest.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function member(req: Request) {
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: req.headers.get("Authorization") || "" } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id as string } : null;
}
function stripeKey(): { key?: string; err?: string } {
  const key = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!key) return { err: "stripe_not_configured" };
  if (/^(sk|rk)_live_/.test(key) && Deno.env.get("ALLOW_LIVE") !== "true") return { err: "live_key_blocked" };
  return { key };
}
async function grant(s: Record<string, any>) {
  const product = s.metadata?.product;
  let uid = s.client_reference_id || s.metadata?.user_id, tokenHash: string | null = null;
  if (!product) throw new Error("session missing product");
  if (!uid) { const a = await accountForEmail(checkoutEmail(s)); uid = a.id; tokenHash = a.tokenHash; }   // guest checkout
  const r = await fetch(`${SB_URL}/rest/v1/mth_enrollments?on_conflict=user_id,product`, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: uid, product, source: "stripe", livemode: !!s.livemode, stripe_session: s.id, payment_intent: s.payment_intent || null, amount_cents: s.amount_total, currency: s.currency, active: true }),
  });
  if (!r.ok && r.status !== 409) throw new Error("grant " + r.status + " " + (await r.text()));
  const email = String(s.customer_details?.email || s.customer_email || "").toLowerCase();
  if (email) { try { await syncContact({ email, name: s.customer_details?.name || null, event: "purchase", product, source: "stripe" }); } catch (_) { /* email service is best-effort */ } }
  return { product: product as string, uid: uid as string, tokenHash };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const me = await member(req);   // null when a guest comes back from Stripe
    const { session_id } = await req.json().catch(() => ({}));
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(String(session_id || ""))) return json({ error: "bad_session" }, 400);
    const sk = stripeKey();
    if (sk.err) return json({ error: sk.err }, 503);
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, { headers: { Authorization: `Bearer ${sk.key}` } });
    const s = await r.json();
    if (!r.ok) return json({ error: "stripe_error", message: s?.error?.message || "" }, 502);
    const guest = !s.client_reference_id && s.metadata?.guest === "1";
    if (!guest && (!me || s.client_reference_id !== me.id)) return json({ error: me ? "not_yours" : "sign_in_required" }, me ? 403 : 401);
    if (s.payment_status !== "paid") return json({ error: "not_paid", status: s.payment_status }, 402);
    const g = await grant(s);
    const email = checkoutEmail(s);
    if (!guest || (me && me.id === g.uid)) return json({ ok: true, product: g.product, email, test: !s.livemode });
    // Guest: sign them straight in, once, and only soon after paying. Otherwise they sign in with the checkout email.
    const fresh = Date.now() / 1000 - Number(s.created || 0) < 6 * 3600;
    const svc = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" };
    let token: string | null = null;
    if (fresh && g.tokenHash) {
      const u = await fetch(`${SB_URL}/rest/v1/mth_enrollments?stripe_session=eq.${s.id}&autologin_at=is.null&select=id`, { method: "PATCH", headers: svc, body: JSON.stringify({ autologin_at: new Date().toISOString() }) });
      const rows = u.ok ? await u.json() : [];
      if (rows.length) token = g.tokenHash;
    }
    return json({ ok: true, product: g.product, email, token_hash: token, sign_in: !token, test: !s.livemode });
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
});
