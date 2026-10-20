// Mark Talks Health: send a contact to whichever email services are switched on.
// Switch one on by adding its secret in Supabase -> Edge Functions -> Secrets:
//   KIT_API_KEY                      Kit (ConvertKit): subscriber + tags
//   RESEND_API_KEY (+ RESEND_SEGMENT_ID)  Resend contacts (optionally into a segment)
//   MAILERLITE_API_KEY (+ MAILERLITE_GROUP_ID) MailerLite subscriber (optionally into a group)
//   OUTBOUND_WEBHOOK_URL (+ OUTBOUND_WEBHOOK_SECRET)  any other tool (Zapier, Make, ManyChat, n8n…)
// Every attempt is written to mth_sync_log so the admin can see what happened.

export type SyncEvent = { email: string; name?: string | null; event: "list_join" | "signup" | "purchase" | "test"; product?: string | null; source?: string | null; utm?: Record<string, string> | null };
type Result = { provider: string; ok: boolean; detail: string };

const env = (k: string) => (Deno.env.get(k) || "").trim();
export function providers() {
  return {
    kit: !!env("KIT_API_KEY"),
    resend: !!env("RESEND_API_KEY"),
    mailerlite: !!env("MAILERLITE_API_KEY"),
    webhook: !!env("OUTBOUND_WEBHOOK_URL"),
  };
}
export function tagsFor(ev: SyncEvent): string[] {
  const t: string[] = [];
  if (ev.event === "list_join") t.push("mth-list");
  if (ev.event === "signup") t.push("mth-account");
  if (ev.event === "purchase") { t.push("mth-customer"); if (ev.product) t.push("mth-" + ev.product + "-customer"); }
  if (ev.event === "test") t.push("mth-test");
  if (ev.utm?.utm_source) t.push("src-" + String(ev.utm.utm_source).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30));
  return t;
}
const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || undefined;

let kitTags: Record<string, number> | null = null;
async function kitTagId(name: string, key: string): Promise<number | null> {
  if (!kitTags) {
    kitTags = {};
    const r = await fetch("https://api.kit.com/v4/tags?per_page=1000", { headers: { "X-Kit-Api-Key": key } });
    if (r.ok) { const j = await r.json(); for (const t of j.tags || []) kitTags[String(t.name).toLowerCase()] = t.id; }
  }
  if (kitTags[name]) return kitTags[name];
  const c = await fetch("https://api.kit.com/v4/tags", { method: "POST", headers: { "X-Kit-Api-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  if (!c.ok) return null;
  const j = await c.json(); const id = j.tag?.id; if (id) kitTags[name] = id; return id || null;
}
async function kit(ev: SyncEvent): Promise<Result> {
  const key = env("KIT_API_KEY");
  const r = await fetch("https://api.kit.com/v4/subscribers", { method: "POST", headers: { "X-Kit-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ email_address: ev.email, first_name: firstName(ev.name) ?? null }) });
  if (!r.ok) return { provider: "kit", ok: false, detail: "subscriber " + r.status + " " + (await r.text()).slice(0, 160) };
  const done: string[] = [];
  for (const t of tagsFor(ev)) {
    const id = await kitTagId(t, key); if (!id) continue;
    const x = await fetch(`https://api.kit.com/v4/tags/${id}/subscribers`, { method: "POST", headers: { "X-Kit-Api-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ email_address: ev.email }) });
    if (x.ok) done.push(t);
  }
  return { provider: "kit", ok: true, detail: "tags: " + (done.join(", ") || "none") };
}
async function resend(ev: SyncEvent): Promise<Result> {
  const body: Record<string, unknown> = { email: ev.email, unsubscribed: false };
  const fn = firstName(ev.name); if (fn) body.first_name = fn;
  if (env("RESEND_SEGMENT_ID")) body.segments = [{ id: env("RESEND_SEGMENT_ID") }];
  body.properties = { mth_tags: tagsFor(ev).join(" ") };
  const r = await fetch("https://api.resend.com/contacts", { method: "POST", headers: { Authorization: "Bearer " + env("RESEND_API_KEY"), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  if (r.ok || /already exists/i.test(t)) return { provider: "resend", ok: true, detail: r.ok ? "contact added" : "already a contact" };
  return { provider: "resend", ok: false, detail: r.status + " " + t.slice(0, 160) };
}
async function mailerlite(ev: SyncEvent): Promise<Result> {
  const body: Record<string, unknown> = { email: ev.email };
  const fn = firstName(ev.name); if (fn) body.fields = { name: fn };
  if (env("MAILERLITE_GROUP_ID")) body.groups = [env("MAILERLITE_GROUP_ID")];
  const r = await fetch("https://connect.mailerlite.com/api/subscribers", { method: "POST", headers: { Authorization: "Bearer " + env("MAILERLITE_API_KEY"), "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  if (r.ok) return { provider: "mailerlite", ok: true, detail: r.status === 201 ? "subscriber added" : "subscriber updated" };
  return { provider: "mailerlite", ok: false, detail: r.status + " " + (await r.text()).slice(0, 160) };
}
async function webhook(ev: SyncEvent): Promise<Result> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (env("OUTBOUND_WEBHOOK_SECRET")) h["X-MTH-Secret"] = env("OUTBOUND_WEBHOOK_SECRET");
  const r = await fetch(env("OUTBOUND_WEBHOOK_URL"), { method: "POST", headers: h,
    body: JSON.stringify({ event: ev.event, email: ev.email, name: ev.name || null, product: ev.product || null, tags: tagsFor(ev), source: ev.source || null, utm: ev.utm || null, at: new Date().toISOString() }) });
  return { provider: "webhook", ok: r.ok, detail: "HTTP " + r.status };
}

export async function syncContact(ev: SyncEvent): Promise<Result[]> {
  const p = providers(), jobs: Promise<Result>[] = [];
  const safe = (name: string, f: () => Promise<Result>) => f().catch((e) => ({ provider: name, ok: false, detail: String(e?.message || e).slice(0, 160) }));
  if (p.kit) jobs.push(safe("kit", () => kit(ev)));
  if (p.resend) jobs.push(safe("resend", () => resend(ev)));
  if (p.mailerlite) jobs.push(safe("mailerlite", () => mailerlite(ev)));
  if (p.webhook) jobs.push(safe("webhook", () => webhook(ev)));
  const out = await Promise.all(jobs);
  // log (service role)
  try {
    const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rows = (out.length ? out : [{ provider: "none", ok: false, detail: "no email service switched on yet" }]).map((r) => ({ email: ev.email, event: ev.event, provider: r.provider, ok: r.ok, detail: r.detail }));
    await fetch(`${url}/rest/v1/mth_sync_log`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(rows) });
  } catch (_) { /* logging is best-effort */ }
  return out;
}
