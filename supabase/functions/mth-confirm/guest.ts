// Mark Talks Health: buy first, account after.
// A guest checkout has no member attached, so after payment we find (or create) the account for the
// email the buyer typed at Stripe, and mint a one-time sign-in token for the welcome page.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" };

export async function accountForEmail(email: string): Promise<{ id: string; tokenHash: string | null; created: boolean }> {
  email = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("checkout has no usable email");
  let created = false;
  const c = await fetch(`${SB_URL}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email, email_confirm: true }) });
  if (c.ok) created = true;
  else {
    const t = await c.text();
    if (!/already|exists|registered/i.test(t)) throw new Error("create account " + c.status + " " + t);
  }
  // generate_link does not send an email; it returns the account and a one-time token
  const g = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email }) });
  const j = await g.json().catch(() => ({}));
  if (!g.ok) throw new Error("generate_link " + g.status + " " + JSON.stringify(j));
  const id = j.id || j.user?.id;
  if (!id) throw new Error("generate_link returned no account");
  return { id, tokenHash: j.hashed_token || j.properties?.hashed_token || null, created };
}

export function checkoutEmail(s: Record<string, any>) {
  return String(s.customer_details?.email || s.customer_email || "").trim().toLowerCase();
}
