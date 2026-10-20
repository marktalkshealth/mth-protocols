// Mark Talks Health: Stripe webhook (backup to mth-confirm, e.g. if a member closes the tab before returning).
// Stripe dashboard -> Developers -> Webhooks -> endpoint .../functions/v1/mth-stripe-webhook, events checkout.session.completed and charge.refunded.
// Needs the STRIPE_WEBHOOK_SECRET (whsec_…) secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { syncContact } from "./sync.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function grant(s: Record<string, any>) {
  const product = s.metadata?.product, uid = s.client_reference_id || s.metadata?.user_id;
  if (!product || !uid) throw new Error("session missing product or member");
  const r = await fetch(`${SB_URL}/rest/v1/mth_enrollments?on_conflict=user_id,product`, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: uid, product, source: "stripe", livemode: !!s.livemode, stripe_session: s.id, payment_intent: s.payment_intent || null, amount_cents: s.amount_total, currency: s.currency, active: true }),
  });
  if (!r.ok && r.status !== 409) throw new Error("grant " + r.status + " " + (await r.text()));
  const email = String(s.customer_details?.email || s.customer_email || "").toLowerCase();
  if (email) { try { await syncContact({ email, name: s.customer_details?.name || null, event: "purchase", product, source: "stripe" }); } catch (_) { /* email service is best-effort */ } }
}
// A full refund in Stripe closes access to that protocol (it can be given back in the admin).
async function refund(ch: Record<string, any>) {
  if (!/^pi_[A-Za-z0-9]+$/.test(String(ch.payment_intent || "")) || !ch.refunded) return;   // partial refunds keep access
  const svc = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" };
  const patch = JSON.stringify({ active: false, refunded_at: new Date().toISOString() });
  let r = await fetch(`${SB_URL}/rest/v1/mth_enrollments?payment_intent=eq.${ch.payment_intent}&select=product`, { method: "PATCH", headers: svc, body: patch });
  let rows = r.ok ? await r.json() : [];
  if (!rows.length) {
    // older purchases: find the checkout through Stripe
    const key = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
    if (key) {
      const s = await fetch(`https://api.stripe.com/v1/checkout/sessions?payment_intent=${ch.payment_intent}&limit=1`, { headers: { Authorization: `Bearer ${key}` } });
      const j = s.ok ? await s.json() : {}; const cs = j.data?.[0]?.id;
      if (cs) { r = await fetch(`${SB_URL}/rest/v1/mth_enrollments?stripe_session=eq.${cs}&select=product`, { method: "PATCH", headers: svc, body: patch }); rows = r.ok ? await r.json() : []; }
    }
  }
  const email = String(ch.billing_details?.email || ch.receipt_email || "").toLowerCase();
  if (email && rows.length) { try { await syncContact({ email, name: ch.billing_details?.name || null, event: "refund", product: rows[0].product, source: "stripe" }); } catch (_) { /* best-effort */ } }
}
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
function same(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function verify(body: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2)).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = header.split(",").filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${body}`)));
  return sigs.some((s) => same(s, mac));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const secret = (Deno.env.get("STRIPE_WEBHOOK_SECRET") || "").trim();
  if (!secret) return new Response("webhook secret not set", { status: 503 });
  const body = await req.text();
  if (!(await verify(body, req.headers.get("stripe-signature") || "", secret))) return new Response("bad signature", { status: 400 });
  const ev = JSON.parse(body);
  if (ev.livemode && Deno.env.get("ALLOW_LIVE") !== "true") return new Response("live events ignored", { status: 200 });
  try {
    if ((ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") && ev.data?.object?.payment_status === "paid") {
      await grant(ev.data.object);
    }
    if (ev.type === "charge.refunded") await refund(ev.data?.object || {});
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
