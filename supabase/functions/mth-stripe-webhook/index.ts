// Mark Talks Health: Stripe webhook (backup to mth-confirm, e.g. if a member closes the tab before returning).
// Stripe dashboard -> Developers -> Webhooks -> endpoint .../functions/v1/mth-stripe-webhook, event checkout.session.completed.
// Needs the STRIPE_WEBHOOK_SECRET (whsec_…) secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function grant(s: Record<string, any>) {
  const product = s.metadata?.product, uid = s.client_reference_id || s.metadata?.user_id;
  if (!product || !uid) throw new Error("session missing product or member");
  const r = await fetch(`${SB_URL}/rest/v1/mth_enrollments?on_conflict=user_id,product`, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: uid, product, source: "stripe", livemode: !!s.livemode, stripe_session: s.id, amount_cents: s.amount_total, currency: s.currency }),
  });
  if (!r.ok && r.status !== 409) throw new Error("grant " + r.status + " " + (await r.text()));
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
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
