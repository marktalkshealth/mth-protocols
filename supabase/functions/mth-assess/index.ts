// Mark Talks Health: free assessment quiz -> email list + emailed assessment.
// POST { product: "gut", email, name?, answers: {...}, source?, anon?, utm? }   (anyone; anon key)
// Saves the contact (email list, CRM tags + a note with their answers), syncs Kit, and emails the
// assessment through Resend when RESEND_API_KEY is set. Everything in the email is built here from
// the answer codes, so nobody can use this to send their own text.
// Optional secrets: RESEND_FROM (default "Mark Talks Health <mark@marktalkshealth.com>"), SITE_URL (default https://marktalkshealth.com)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "./quiz-core.js";
import { syncContact } from "./sync.ts";

const Core = (globalThis as any).MTHQuizCore;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const SB_URL = Deno.env.get("SUPABASE_URL")!, SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" };
const env = (k: string) => (Deno.env.get(k) || "").trim();
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// keep only answer codes that exist in the quiz
function clean(product: string, raw: any) {
  const C = Core.QUIZ[product]; const out: Record<string, unknown> = {};
  for (const q of C.questions) {
    const ok = new Set(q.o.map((o: string[]) => o[0])); const v = raw?.[q.id];
    if (q.type === "multi") out[q.id] = (Array.isArray(v) ? v : []).filter((x: unknown) => ok.has(String(x))).slice(0, 20);
    else if (ok.has(String(v))) out[q.id] = String(v);
  }
  return out;
}
function label(product: string, a: Record<string, any>) {
  const C = Core.QUIZ[product];
  return C.questions.map((q: any) => {
    const m = Object.fromEntries(q.o); const v = a[q.id];
    const t = Array.isArray(v) ? v.map((x: string) => m[x]).join(", ") : v ? m[v] : "";
    return t ? `${q.q} ${t}` : "";
  }).filter(Boolean).join("\n");
}

function emailHtml(r: any, name: string, site: string, product: string) {
  const C = Core.QUIZ[product];
  const buy = `${site}/${C.sales}?utm_source=email&utm_medium=assessment&utm_campaign=quiz#checkout`;
  const T = "#c0623f", INK = "#2b2724", MUT = "#6e6259", BG = "#f7f1e7", LINE = "#e7dccb";
  const bar = (p: number, c: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe5d6;border-radius:6px"><tr><td width="${p}%" style="background:${c};height:10px;border-radius:6px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table>`;
  const h = (t: string) => `<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;color:${INK};margin:28px 0 12px">${t}</h2>`;
  return `<!doctype html><html><body style="margin:0;background:${BG};font-family:Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffcf7;border:1px solid ${LINE};border-radius:18px"><tr><td style="padding:28px 26px">
<div style="font-family:Georgia,serif;font-size:20px">Mark Talks <em style="color:${T}">Health</em></div>
<div style="font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${T};margin-top:24px">Your gut assessment</div>
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:36px;line-height:1.1;margin:8px 0 10px">${name ? esc(name) + ", your" : "Your"} first impression: ${esc(r.impression)}</h1>
<p style="color:${MUT};font-size:15px;margin:0 0 6px">Gut stress: <b style="color:${INK}">${esc(r.stress)}</b> &middot; Suggested start: <b style="color:${INK}">${esc(r.levelName)}</b></p>
${bar(r.pct, T)}
${r.patterns.length ? h("Areas to focus on") + r.patterns.map((p: any) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5"><b>${esc(p.label)}</b><br><span style="color:${MUT}">${esc(p.text)}</span></p>`).join("") : ""}
${h("Your 7 healing steps, ranked for you")}
${r.plan.map((b: any) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td style="font-size:14px;padding-bottom:4px">${esc(b.step)}</td><td align="right" style="font-size:13px;color:${MUT};padding-bottom:4px">${b.pct}%</td></tr><tr><td colspan="2">${bar(b.pct, "#b8924a")}</td></tr></table>`).join("")}
${h("Your first 7 days")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r.arc.map((d: any) => `<tr><td valign="top" style="width:64px;padding:8px 0;border-top:1px solid ${LINE};font-weight:bold;font-size:14px">Day ${d.d}</td><td style="padding:8px 0;border-top:1px solid ${LINE};font-size:14px"><b>${esc(d.t)}</b><br><span style="color:${MUT}">${esc(d.n)}</span></td></tr>`).join("")}</table>
<div style="margin-top:28px;padding:22px;background:#efe5d6;border-radius:14px;text-align:center">
<p style="margin:0 0 14px;color:${MUT};font-size:15px;line-height:1.5">Your full protocol builds on this with your test results, a day-by-day plan, high-protein meals and the 7-part course.</p>
<a href="${buy}" style="display:inline-block;background:${T};color:#fff;text-decoration:none;font-weight:bold;font-size:16px;padding:15px 28px;border-radius:999px">Start ${esc(C.name)} &middot; $97</a></div>
<p style="color:${MUT};font-size:15px;line-height:1.5;margin:24px 0 0">Talk soon,<br>Mark</p>
<p style="color:#a8998b;font-size:11px;line-height:1.5;margin:24px 0 0">An educational assessment based on your answers, not a medical diagnosis. Talk to your doctor before fasting or changing medication. You're receiving this because you asked for your assessment at marktalkshealth.com.</p>
</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const product = Core.QUIZ[String(b.product)] ? String(b.product) : "gut";
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return json({ error: "bad_email" }, 400);
    const name = String(b.name || "").trim().replace(/[<>]/g, "").slice(0, 60);
    const answers = clean(product, b.answers);
    const r = Core.score(product, answers);
    if (!r.answered) return json({ error: "no_answers" }, 400);

    // at most 3 assessments per email per day
    const since = new Date(Date.now() - 864e5).toISOString();
    const c = await fetch(`${SB_URL}/rest/v1/mth_events?select=id&email=eq.${encodeURIComponent(email)}&event=eq.quiz&created_at=gte.${since}`, { headers: svc });
    const recent = c.ok ? await c.json() : [];
    if (recent.length >= 3) return json({ ok: true, emailed: false, error: "rate_limited" });

    // contact + list opt-in (same rules as every other sign-up form)
    const utm = b.utm && typeof b.utm === "object" ? b.utm : null;
    await fetch(`${SB_URL}/rest/v1/rpc/mth_join`, { method: "POST", headers: svc, body: JSON.stringify({ p_email: email, p_name: name || null, p_source: String(b.source || "quiz").slice(0, 40), p_anon: String(b.anon || "").slice(0, 64) || null, p_utm: utm }) });
    // CRM tags + note with their answers
    const tags = ["quiz", `quiz-${product}`, ...r.patterns.map((p: any) => "pattern-" + p.id), `stress-${r.stress}`];
    const cur = await fetch(`${SB_URL}/rest/v1/mth_contacts?select=tags&email=eq.${encodeURIComponent(email)}`, { headers: svc });
    const old = cur.ok ? ((await cur.json())[0]?.tags || []) : [];
    await fetch(`${SB_URL}/rest/v1/mth_contacts?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", headers: svc, body: JSON.stringify({ tags: [...new Set([...old, ...tags])] }) });
    await fetch(`${SB_URL}/rest/v1/mth_notes`, { method: "POST", headers: svc, body: JSON.stringify({ email, body: `Quiz (${C(product)}): ${r.impression}, gut stress ${r.stress} (${r.pct}%).\n` + label(product, answers) }) });
    await fetch(`${SB_URL}/rest/v1/mth_events`, { method: "POST", headers: svc, body: JSON.stringify({ email, anon_id: String(b.anon || "").slice(0, 64) || null, event: "quiz", page: String(b.source || "quiz").slice(0, 120), product, utm }) });

    // email service (Kit etc.), with pattern tags
    try { await syncContact({ email, name: name || null, event: "quiz", product, source: "quiz", utm, tags: r.patterns.map((p: any) => "pattern-" + p.id) }); } catch (_) { /* best-effort */ }

    // the assessment email
    let emailed = false;
    const key = env("RESEND_API_KEY");
    if (key) {
      const site = (env("SITE_URL") || "https://marktalkshealth.com").replace(/\/$/, "");
      const s = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env("RESEND_FROM") || "Mark Talks Health <mark@marktalkshealth.com>", to: [email], reply_to: "marktalkshealth@gmail.com",
          subject: `${name ? name + ", your" : "Your"} gut assessment: ${r.impression}`, html: emailHtml(r, name, site, product) }),
      });
      emailed = s.ok;
      if (!s.ok) console.error("resend", s.status, await s.text());
    }
    return json({ ok: true, emailed });
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
});
function C(product: string) { return Core.QUIZ[product]?.name || product; }
