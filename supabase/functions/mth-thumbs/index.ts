// Mark Talks Health: Thumbnail Studio (admin only).
// Calls Google's image model (Nano Banana) with Mark's face photos + a style recipe.
// Secret needed: GEMINI_API_KEY (Google AI Studio key, billing on). Optional: GEMINI_IMAGE_MODEL.
// Files live in the private storage bucket "mth-thumbs": face/… (Mark's photos), out/… (results).
// POST { action: "status" }
// POST { action: "faces" } | { action: "face_add", image } | { action: "face_del", path }
// POST { action: "generate", idea, text, style, ratio, count, face, ref }
// POST { action: "edit", path, instruction, ratio }
// POST { action: "history" } | { action: "delete", path }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const SB_URL = Deno.env.get("SUPABASE_URL")!, SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!, SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` };
const BUCKET = "mth-thumbs";
const KEY = () => (Deno.env.get("GEMINI_API_KEY") || "").trim();
const MODELS = () => [Deno.env.get("GEMINI_IMAGE_MODEL") || "", "gemini-nano-banana-2.1", "gemini-3-pro-image", "gemini-3.1-flash-image"].filter(Boolean);

async function isAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth) return false;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/mth_is_admin`, { method: "POST", headers: { apikey: SB_ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}

/* ---------- storage ---------- */
let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const r = await fetch(`${SB_URL}/storage/v1/bucket/${BUCKET}`, { headers: svc });
  if (!r.ok) await fetch(`${SB_URL}/storage/v1/bucket`, { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
  bucketReady = true;
}
const b64ToBytes = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
function bytesToB64(u: Uint8Array) { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }
function parseDataUrl(d: string) { const m = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(String(d || "")); return m ? { mime: m[1], data: m[2] } : null; }
async function put(path: string, bytes: Uint8Array, mime: string) {
  const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { ...svc, "Content-Type": mime, "x-upsert": "true" }, body: bytes });
  if (!r.ok) throw new Error("save_failed " + (await r.text()).slice(0, 200));
}
async function get(path: string) {
  const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, { headers: svc });
  if (!r.ok) return null;
  return { mime: r.headers.get("Content-Type") || "image/png", data: bytesToB64(new Uint8Array(await r.arrayBuffer())) };
}
async function list(prefix: string, limit = 100) {
  const r = await fetch(`${SB_URL}/storage/v1/object/list/${BUCKET}`, { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ prefix, limit, sortBy: { column: "created_at", order: "desc" } }) });
  const rows = r.ok ? await r.json() : [];
  return (rows as { name: string; id: string | null }[]).filter((x) => x.id).map((x) => `${prefix}/${x.name}`);
}
async function signed(paths: string[]) {
  if (!paths.length) return [];
  const r = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}`, { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ paths, expiresIn: 60 * 60 * 6 }) });
  const rows = r.ok ? await r.json() : [];
  return (rows as { path: string; signedURL: string }[]).map((x) => ({ path: x.path, url: x.signedURL ? `${SB_URL}/storage/v1${x.signedURL}` : "" }));
}
async function del(path: string) {
  await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, { method: "DELETE", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [path] }) });
}

/* ---------- style recipes ---------- */
const BASE = "Design a professional, high-end YouTube thumbnail (2026 top-creator quality, not a template, not stock, not Canva). " +
  "Photoreal, crisp, high contrast, one clear focal point, readable as a tiny image on a phone. Leave clean space so nothing important is cropped at the edges. " +
  "Never add channel logos, watermarks, play buttons, borders, UI or extra words that were not requested.";
const STYLES: Record<string, string> = {
  clean: "STYLE — Clean Creator (science-explainer look, like top health and science YouTubers): bright, airy, clean background (soft studio white, light gradient or a simple real setting), " +
    "the person large on one side with a natural, curious or surprised expression, one simple bold object or prop that tells the story, lots of breathing room, " +
    "text in a heavy modern sans-serif, dark ink on light or white on a single bold colour block. Calm, smart, trustworthy, premium.",
  loud: "STYLE — Loud Viral (biggest-creator challenge-video look): maximum drama and energy, saturated punchy colours, strong rim light and glow around the person, " +
    "exaggerated but believable shocked or excited expression, big dramatic scene or high-stakes object, deep depth of field, cinematic lighting, " +
    "huge chunky bold text with thick black outline and slight 3D, one bright accent colour (yellow, red or electric green). Must stop the scroll instantly.",
  vox: "STYLE — Documentary Explainer (Vox-style): editorial collage — cut-out photo of the person in black-and-white or duotone, torn paper edges, halftone dots, " +
    "layered archival photos and hand-drawn annotation marks (circles, arrows, underlines), muted paper textures with one strong accent colour, " +
    "text in a condensed editorial typeface on a paper strip or highlighter block. Smart, investigative, cinematic.",
  brand: "STYLE — Mark Talks Health luxury brand: warm, elegant, editorial wellness look. Palette strictly cream #f7f1e7, charcoal #2b2724, terracotta #c0623f, sage #7a8f6e and gold #b8924a. " +
    "Soft natural window light, warm skin tones, refined composition, real textures (linen, stone, plants, sunlight). Headline in a classic high-contrast serif (like Cormorant Garamond) " +
    "with one word in italic terracotta, or a clean bold sans in charcoal. Premium, calm, trustworthy, magazine-cover quality.",
  scroll: "STYLE — Mark Talks Health Scroll-Stopper: the brand's loud variant. Bold, high contrast and energetic but strictly in the brand palette (cream, charcoal, terracotta, sage, gold), " +
    "deep charcoal or terracotta background, dramatic warm rim light on the person, big expressive face, huge heavy cream or gold text with a charcoal outline, one striking health object or visual.",
};
const RATIO: Record<string, string> = { "16:9": "16:9", "9:16": "9:16", "4:5": "4:5", "1:1": "1:1" };

/* ---------- image model ---------- */
type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
async function callModel(parts: Part[], ratio: string): Promise<{ mime: string; data: string } | { error: string }> {
  let last = "no_model";
  for (const model of MODELS()) {
    for (const ver of ["v1beta", "v1"]) {
      const r = await fetch(`https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": KEY(), "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: ratio, imageSize: "2K" } } }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404) { last = `model_not_found ${model}`; continue; }
      if (!r.ok) {
        const msg = String(j?.error?.message || `http_${r.status}`);
        // imageSize not supported by this model: retry once without it
        if (/imageSize|image_size/i.test(msg)) {
          const r2 = await fetch(`https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent`, {
            method: "POST", headers: { "x-goog-api-key": KEY(), "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: ratio } } }),
          });
          const j2 = await r2.json().catch(() => ({}));
          const img2 = pick(j2); if (img2) return img2;
        }
        return { error: friendly(r.status, msg) };
      }
      const img = pick(j);
      if (img) return img;
      const why = j?.candidates?.[0]?.finishReason || j?.promptFeedback?.blockReason || "no_image";
      return { error: why === "SAFETY" || why === "IMAGE_SAFETY" || j?.promptFeedback?.blockReason ? "Google’s safety filter blocked this one. Try different wording." : "The model didn’t return a picture this time. Try again." };
    }
  }
  return { error: last };
}
function pick(j: any) {
  const parts = j?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) { const d = p.inlineData || p.inline_data; if (d?.data && !p.thought) return { mime: d.mimeType || d.mime_type || "image/png", data: d.data as string }; }
  return null;
}
function friendly(status: number, msg: string) {
  if (status === 400 && /API key/i.test(msg)) return "Your Google API key isn’t valid. Paste it again in Supabase secrets.";
  if (status === 403) return "Google refused the key. Check that billing is turned on for it in Google AI Studio.";
  if (status === 429) return /billing|free tier|limit: 0/i.test(msg) ? "Image generation needs billing turned on for your Google key (AI Studio → Billing)." : "Google says too many requests right now. Wait a minute and try again.";
  return msg.slice(0, 240);
}
const ext = (mime: string) => (mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    if (!(await isAdmin(req))) return json({ error: "admins_only" }, 403);
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");
    await ensureBucket();

    if (action === "status") return json({ key: !!KEY(), model: MODELS()[0] });
    if (action === "faces") return json({ faces: await signed(await list("face", 20)) });
    if (action === "face_add") {
      const img = parseDataUrl(b.image); if (!img) return json({ error: "bad_image" }, 400);
      const path = `face/${Date.now()}.${ext(img.mime)}`; await put(path, b64ToBytes(img.data), img.mime);
      return json({ ok: true, path });
    }
    if (action === "face_del" || action === "delete") {
      const path = String(b.path || ""); if (!/^(face|out)\/[\w.-]+$/.test(path)) return json({ error: "bad_path" }, 400);
      await del(path); return json({ ok: true });
    }
    if (action === "history") return json({ items: await signed(await list("out", 60)) });

    if (!KEY()) return json({ error: "no_key" }, 400);
    const ratio = RATIO[String(b.ratio)] || "16:9";

    if (action === "generate") {
      const idea = String(b.idea || "").trim().slice(0, 1200), text = String(b.text || "").trim().slice(0, 60);
      const style = STYLES[String(b.style)] || STYLES.clean, count = Math.max(1, Math.min(4, Number(b.count) || 4));
      if (!idea) return json({ error: "Type what the video is about first." }, 400);
      const parts: Part[] = [];
      let prompt = `${BASE}\n${style}\n\nVIDEO / THUMBNAIL IDEA: ${idea}\n`;
      prompt += text ? `TEXT ON THE THUMBNAIL: exactly "${text}" — spelled exactly like that, nothing else written anywhere. Large, perfectly legible, never overlapping the face.\n` : "TEXT: no words at all on the thumbnail.\n";
      prompt += `ASPECT RATIO: ${ratio}.\n`;
      const facePaths = b.face === false ? [] : (await list("face", 4));
      const faces = (await Promise.all(facePaths.map(get))).filter(Boolean) as { mime: string; data: string }[];
      if (faces.length) prompt += `THE PERSON: use the man in the ${faces.length} reference photo(s) as the main subject. Keep his face, features, hair, skin tone and build exactly recognisable as him — same person, natural and flattering, not a cartoon. Change his expression and pose to fit the idea.\n`;
      const ref = parseDataUrl(b.ref);
      if (ref) prompt += "LAYOUT REFERENCE: the LAST image is a thumbnail whose look I like. Borrow its composition, lighting, colour mood and text treatment, but do NOT copy its person, its words, its logos or any brand from it — build a new, original thumbnail for my idea.\n";
      parts.push({ text: prompt });
      faces.forEach((f) => parts.push({ inline_data: { mime_type: f.mime, data: f.data } }));
      if (ref) parts.push({ inline_data: { mime_type: ref.mime, data: ref.data } });
      const stamp = Date.now();
      const results = await Promise.all(Array.from({ length: count }, (_, i) =>
        callModel(i ? [{ text: prompt + `\nVARIATION ${i + 1}: make this option clearly different from the others (different pose, angle, scene or layout).` }, ...parts.slice(1)] : parts, ratio)));
      const saved: string[] = [], errors: string[] = [];
      await Promise.all(results.map(async (r, i) => {
        if ("error" in r) { errors.push(r.error); return; }
        const path = `out/${stamp}-${i + 1}-r${ratio.replace(":", "x")}.${ext(r.mime)}`; await put(path, b64ToBytes(r.data), r.mime); saved.push(path);
      }));
      saved.sort();
      return json({ items: await signed(saved), errors: [...new Set(errors)] });
    }

    if (action === "edit") {
      const path = String(b.path || ""), instruction = String(b.instruction || "").trim().slice(0, 600);
      if (!/^out\/[\w.-]+$/.test(path) || !instruction) return json({ error: "Pick a thumbnail and type the change." }, 400);
      const src = await get(path); if (!src) return json({ error: "That thumbnail is gone." }, 404);
      const m = /-r(\d+)x(\d+)\./.exec(path); const er = m ? RATIO[`${m[1]}:${m[2]}`] || ratio : ratio;
      const r = await callModel([
        { text: `Edit this YouTube thumbnail. Change ONLY this: ${instruction}. Keep everything else the same — same person and face, same layout, same style, same quality. Keep any text spelled exactly as it is unless told to change it. Aspect ratio ${er}.` },
        { inline_data: { mime_type: src.mime, data: src.data } },
      ], er);
      if ("error" in r) return json({ error: r.error });
      const out = `out/${Date.now()}-e-r${er.replace(":", "x")}.${ext(r.mime)}`; await put(out, b64ToBytes(r.data), r.mime);
      return json({ items: await signed([out]) });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e); return json({ error: "server: " + String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
