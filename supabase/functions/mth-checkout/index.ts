// Mark Talks Health: start a Stripe Checkout for a protocol.
// POST { product: "gut", return_base: "https://…/www/" }  (signed-in member's token in Authorization)
// Returns { url } to send the member to Stripe, or { already: true } if they own it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PRODUCTS: Record<string, { name: string; cents: number; desc: string }> = {
  gut: { name: "The Gut Health Protocol", cents: 9700, desc: "Personalised healing app, 7-part course and ebooks. Lifetime access." },
};
const OK_HOSTS = ["raw.githack.com", "marktalkshealth.github.io", "marktalkshealth.com", "www.marktalkshealth.com", "localhost", "127.0.0.1"];
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function member(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id as string, email: (u.email || "") as string } : null;
}
function stripeKey(): { key?: string; err?: string } {
  const key = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!key) return { err: "stripe_not_configured" };
  // Safety: live payments stay off until ALLOW_LIVE=true is added on purpose.
  if (/^(sk|rk)_live_/.test(key) && Deno.env.get("ALLOW_LIVE") !== "true") return { err: "live_key_blocked" };
  return { key };
}
async function owns(uid: string, product: string) {
  const r = await fetch(`${SB_URL}/rest/v1/mth_enrollments?select=id&user_id=eq.${uid}&product=eq.${product}`,
    { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
  const rows = r.ok ? await r.json() : [];
  return rows.length > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const me = await member(req);
    if (!me) return json({ error: "sign_in_required" }, 401);
    const body = await req.json().catch(() => ({}));
    const product = String(body.product || "gut");
    const P = PRODUCTS[product];
    if (!P) return json({ error: "unknown_product" }, 400);
    let base: URL;
    try { base = new URL(String(body.return_base || "")); } catch { return json({ error: "bad_return" }, 400); }
    if (!OK_HOSTS.includes(base.hostname) || (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1")) return json({ error: "bad_return" }, 400);
    if (!base.pathname.endsWith("/")) base.pathname = base.pathname.replace(/[^/]*$/, "");
    if (await owns(me.id, product)) return json({ already: true });
    const sk = stripeKey();
    if (sk.err) return json({ error: sk.err }, 503);

    const f = new URLSearchParams();
    f.set("mode", "payment");
    f.set("line_items[0][quantity]", "1");
    f.set("line_items[0][price_data][currency]", "usd");
    f.set("line_items[0][price_data][unit_amount]", String(P.cents));
    f.set("line_items[0][price_data][product_data][name]", P.name);
    f.set("line_items[0][price_data][product_data][description]", P.desc);
    f.set("client_reference_id", me.id);
    if (me.email) f.set("customer_email", me.email);
    f.set("metadata[product]", product);
    f.set("metadata[user_id]", me.id);
    f.set("allow_promotion_codes", "true");
    f.set("success_url", new URL("welcome.html", base).href + "?session_id={CHECKOUT_SESSION_ID}");
    f.set("cancel_url", new URL("gut.html", base).href + "?checkout=cancelled#checkout");
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", body: f,
      headers: { Authorization: `Bearer ${sk.key}`, "Content-Type": "application/x-www-form-urlencoded" },
    });
    const s = await r.json();
    if (!r.ok) { console.error("stripe", s); return json({ error: "stripe_error", message: s?.error?.message || "" }, 502); }
    return json({ url: s.url, test: !s.livemode });
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
});
