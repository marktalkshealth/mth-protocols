// Mark Talks Health: the social engine (own "Metricool").
//   1. Auto-posting  -> Instagram + Facebook Page, for posts Mark switched to "Auto-post".
//   2. Auto-DMs      -> someone comments a keyword (GUT, SUGAR ...) and gets a private reply with the link
//                       (Instagram + Facebook). On YouTube, which has no DMs, it is a public reply.
// This file has no Supabase or Deno imports on purpose: everything it needs (database, internet, clock)
// is handed in, so the whole thing can be tested on a laptop with a fake Instagram.
//
// Safety rules baked in:
//   * Nothing runs unless the matching master switch is on.
//   * A post is only sent if Mark ticked "Auto-post" on it, and only within 24 hours of its publish time.
//   * Before we ask a platform to publish, we write "publishing" on the post. If we crash right after,
//     the post is flagged "check" instead of being sent twice.
//   * One comment gets one answer, ever (unique row in mth_dm_log), and only comments written after
//     auto-DMs were switched on and after the keyword was created are answered.

export const GRAPH = "https://graph.facebook.com/v24.0";
export const GRAPH_VIDEO = "https://graph-video.facebook.com/v24.0";
export const YT = "https://www.googleapis.com/youtube/v3";
export const SITE = "https://marktalkshealth.com/";
export const AUTO_PLATFORMS = ["instagram", "facebook"];
const DAY = 864e5;

export type Json = Record<string, unknown>;
export type PState = { status?: string; at?: string; id?: string; url?: string; error?: string; container?: string; children?: string[]; note?: string };
export type Post = {
  id: number; title: string; status: string; format: string | null; platforms: string[] | null; publish_at: string | null;
  caption: string | null; captions: Record<string, string> | null; hashtags: string | null; cta: string | null; slug: string | null;
  media_urls: string[] | null; first_comment: string | null; youtube_title: string | null;
  auto_publish: boolean; publish_state: Record<string, PState> | null;
};
export type Settings = {
  enabled: boolean; dm_enabled: boolean; dm_enabled_at: string | null;
  fb_page_id: string | null; fb_page_name: string | null; ig_id: string | null; ig_username: string | null;
  yt_channel_id: string | null; yt_channel_title: string | null; poll_state: Json | null; meta_note?: string | null;
};
export type Keyword = { id: number; keyword: string; platforms: string[]; dm_text: string; public_reply: string | null; youtube_reply: string | null; active: boolean; created_at: string };
export type DmRow = { platform: string; comment_id: string; media_id?: string | null; username?: string | null; comment_text?: string | null; keyword_id?: number; keyword?: string };
export type Store = {
  settings(): Promise<Settings>;
  saveSettings(patch: Json): Promise<void>;
  secret(name: string): Promise<string | null>;
  setSecret(name: string, value: string | null): Promise<void>;
  duePosts(nowIso: string, sinceIso: string): Promise<Post[]>;
  savePost(id: number, patch: Json): Promise<void>;
  keywords(): Promise<Keyword[]>;
  seenComments(platform: string, ids: string[]): Promise<Set<string>>;
  claimDm(row: DmRow): Promise<boolean>;                       // false = somebody already answered this comment
  finishDm(platform: string, comment_id: string, patch: Json): Promise<void>;
  keywordHit(id: number): Promise<void>;
  log(row: { event: string; provider: string; ok: boolean; detail: string }): Promise<void>;
};
export type Deps = { store: Store; fetch: typeof fetch; now: () => number; env: (k: string) => string };

export class ApiError extends Error {
  code?: number; sub?: number; status?: number;
  constructor(msg: string, o: { code?: number; sub?: number; status?: number } = {}) { super(msg); this.code = o.code; this.sub = o.sub; this.status = o.status; }
}
const short = (s: unknown, n = 300) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
const isVideo = (u: string) => /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(u);

/* ---------- the caption, built the same way the Studio screen builds it ---------- */
export function captionFor(p: Post, plat: string): string {
  const own = (p.captions || {})[plat];
  const text = (own && own.trim() ? own : (p.caption || "")).trim();
  const link = p.slug ? `${SITE}go.html?p=${encodeURIComponent(p.slug)}&s=${plat}` : "";
  const cta = (p.cta || "").trim();
  const clickable = plat === "facebook" || plat === "threads" || plat === "youtube";
  const parts = [text];
  if (cta) parts.push(clickable && link ? `${cta} ${link}` : cta);
  else if (clickable && link) parts.push(link);
  if (p.hashtags && plat !== "threads") parts.push(p.hashtags.trim());
  return parts.filter(Boolean).join("\n\n");
}

/* ---------- does this comment contain the keyword as its own word? ("gut" yes, "gutter" no) ---------- */
export function matchKeyword(text: string, words: Keyword[], platform: string): Keyword | null {
  const t = ` ${String(text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  let best: Keyword | null = null;
  for (const k of words) {
    if (!k.active || !(k.platforms || []).includes(platform)) continue;
    const w = k.keyword.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (w && t.includes(` ${w} `) && (!best || w.length > best.keyword.length)) best = k;
  }
  return best;
}

export function makeEngine(d: Deps) {
  const { store } = d;
  const nowIso = () => new Date(d.now()).toISOString();

  /* ---------- talking to Meta ---------- */
  async function meta(path: string, o: { method?: string; token: string; params?: Record<string, unknown>; json?: unknown; base?: string; headers?: Record<string, string> } ) {
    const method = o.method || "GET";
    const u = new URL(/^https?:/.test(path) ? path : `${o.base || GRAPH}/${path.replace(/^\//, "")}`);
    const init: RequestInit = { method, headers: { ...(o.headers || {}) } };
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(o.params || {})) if (v !== undefined && v !== null && v !== "") params[k] = typeof v === "string" ? v : JSON.stringify(v);
    if (o.json !== undefined) {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      (init.headers as Record<string, string>)["Authorization"] = `Bearer ${o.token}`;
      init.body = JSON.stringify(o.json);
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    } else if (method === "GET" || method === "DELETE") {
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
      u.searchParams.set("access_token", o.token);
    } else {
      init.body = new URLSearchParams({ ...params, access_token: o.token });
    }
    const r = await d.fetch(u.toString(), init);
    let j: any = {};
    try { j = await r.json(); } catch (_) { /* not json */ }
    if (!r.ok || j?.error) {
      const e = j?.error || {};
      throw new ApiError(short(e.error_user_msg || e.message || `Meta said ${r.status}`), { code: e.code, sub: e.error_subcode, status: r.status });
    }
    return j;
  }
  const pageToken = () => store.secret("mth_social_fb_page_token");

  /* ============================================================
     CONNECTING META (one token covers the Facebook Page and its Instagram account)
  ============================================================ */
  type PageInfo = { id: string; name: string; ig_id: string | null; ig_username: string | null };
  async function listPages(token: string): Promise<{ pages: (PageInfo & { token: string })[]; note: string | null }> {
    const out: (PageInfo & { token: string })[] = [];
    let next: string | null = "me/accounts";
    for (let i = 0; next && i < 5; i++) {
      const j: any = await meta(next, i === 0 ? { token, params: { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100" } } : { token });
      for (const p of j.data || []) out.push({ id: String(p.id), name: String(p.name || ""), token: String(p.access_token || ""), ig_id: p.instagram_business_account?.id ? String(p.instagram_business_account.id) : null, ig_username: p.instagram_business_account?.username || null });
      next = j.paging?.next || null;
    }
    // Does the token run out? (System-user tokens never do; tokens from the Graph Explorer last an hour or two.)
    let note: string | null = null;
    try {
      const dbg: any = await meta("debug_token", { token, params: { input_token: token } });
      const x = dbg.data || {};
      if (x.expires_at && Number(x.expires_at) > 0) note = `This token runs out on ${new Date(Number(x.expires_at) * 1000).toISOString().slice(0, 10)}. Use a system-user token (it never runs out).`;
      const need = ["pages_manage_posts", "pages_read_engagement", "pages_manage_engagement", "pages_messaging", "instagram_basic", "instagram_content_publish", "instagram_manage_comments", "instagram_manage_messages"];
      const have: string[] = x.scopes || [];
      const missing = have.length ? need.filter((s) => !have.includes(s)) : [];
      if (missing.length) note = `${note ? note + " " : ""}Missing permissions: ${missing.join(", ")}.`;
    } catch (_) { /* optional check */ }
    return { pages: out, note };
  }
  async function connectMeta(token: string) {
    token = String(token || "").trim();
    if (token.length < 40) throw new ApiError("That doesn’t look like a Meta access token.");
    const { pages, note } = await listPages(token);
    if (!pages.length) throw new ApiError("That token works, but it can’t see any Facebook Page. Give the system user access to your Page, then make a new token.");
    await store.setSecret("mth_social_meta_token", token);
    await store.saveSettings({ meta_note: note });
    const list = pages.map(({ token: _t, ...p }) => p);
    if (pages.length === 1) { await pickPage(pages[0].id, pages); return { ok: true, picked: list[0], pages: list, note }; }
    return { ok: true, pages: list, note };
  }
  async function pickPage(pageId: string, known?: (PageInfo & { token: string })[]) {
    let pages = known;
    if (!pages) { const t = await store.secret("mth_social_meta_token"); if (!t) throw new ApiError("Paste your Meta token first."); pages = (await listPages(t)).pages; }
    const p = pages.find((x) => x.id === String(pageId));
    if (!p || !p.token) throw new ApiError("That Page isn’t available to this token.");
    await store.setSecret("mth_social_fb_page_token", p.token);
    await store.saveSettings({ fb_page_id: p.id, fb_page_name: p.name, ig_id: p.ig_id, ig_username: p.ig_username, meta_connected_at: nowIso() });
    return { ok: true, page: { id: p.id, name: p.name, ig_id: p.ig_id, ig_username: p.ig_username } };
  }
  async function disconnectMeta() {
    await store.setSecret("mth_social_meta_token", null); await store.setSecret("mth_social_fb_page_token", null);
    await store.saveSettings({ fb_page_id: null, fb_page_name: null, ig_id: null, ig_username: null, meta_connected_at: null, meta_note: null, enabled: false });
    return { ok: true };
  }
  /* a harmless read on each account, to prove the connection really works */
  async function testMeta() {
    const s = await store.settings(), t = await pageToken();
    if (!t || !s.fb_page_id) return { ok: false, error: "Not connected yet." };
    const out: Json = {};
    try { const p: any = await meta(s.fb_page_id, { token: t, params: { fields: "name,fan_count" } }); out.facebook = { ok: true, name: p.name, followers: p.fan_count }; } catch (e) { out.facebook = { ok: false, error: (e as Error).message }; }
    if (s.ig_id) { try { const g: any = await meta(s.ig_id, { token: t, params: { fields: "username,followers_count,media_count" } }); out.instagram = { ok: true, username: g.username, followers: g.followers_count, posts: g.media_count }; } catch (e) { out.instagram = { ok: false, error: (e as Error).message }; } }
    else out.instagram = { ok: false, error: "No Instagram professional account is linked to this Facebook Page." };
    return { ok: true, ...out };
  }

  /* ============================================================
     AUTO-POSTING
  ============================================================ */
  function mediaOf(p: Post) { const all = (p.media_urls || []).filter((u) => /^https:\/\//.test(u)); return { all, videos: all.filter(isVideo), images: all.filter((u) => !isVideo(u)) }; }

  /* ----- Instagram: make a "container", wait until Instagram has processed it, then publish it ----- */
  async function igStart(p: Post, s: Settings, token: string): Promise<PState> {
    const m = mediaOf(p), cap = captionFor(p, "instagram");
    if (!m.all.length) return { status: "failed", error: "Instagram needs a picture or a video. Upload one to this post." };
    const mk = (params: Record<string, unknown>) => meta(`${s.ig_id}/media`, { method: "POST", token, params });
    if (p.format === "story") {
      const u = m.all[0]; const c: any = await mk(isVideo(u) ? { media_type: "STORIES", video_url: u } : { media_type: "STORIES", image_url: u });
      return { status: "processing", container: String(c.id), at: nowIso() };
    }
    if (m.videos.length) {
      const c: any = await mk({ media_type: "REELS", video_url: m.videos[0], caption: cap, share_to_feed: "true" });
      return { status: "processing", container: String(c.id), at: nowIso() };
    }
    if (m.images.length === 1) {
      const c: any = await mk({ image_url: m.images[0], caption: cap });
      return { status: "processing", container: String(c.id), at: nowIso() };
    }
    const kids: string[] = [];
    for (const u of m.images.slice(0, 10)) { const k: any = await mk({ image_url: u, is_carousel_item: "true" }); kids.push(String(k.id)); }
    const c: any = await mk({ media_type: "CAROUSEL", children: kids.join(","), caption: cap });
    return { status: "processing", container: String(c.id), children: kids, at: nowIso() };
  }
  async function igContinue(p: Post, st: PState, s: Settings, token: string, save: (x: PState) => Promise<void>): Promise<PState> {
    const c: any = await meta(String(st.container), { token, params: { fields: "status_code,status" } });
    const code = String(c.status_code || "");
    if (code === "ERROR" || code === "EXPIRED") return { status: "failed", error: `Instagram couldn’t use this file: ${short(c.status || code, 200)}` };
    if (code !== "FINISHED") {
      if (d.now() - new Date(st.at || nowIso()).getTime() > 45 * 60e3) return { status: "failed", error: "Instagram was still processing the video after 45 minutes." };
      return st;   // still processing: look again on the next run
    }
    await save({ ...st, status: "publishing", at: nowIso() });
    const pub: any = await meta(`${s.ig_id}/media_publish`, { method: "POST", token, params: { creation_id: st.container } });
    const done: PState = { status: "posted", id: String(pub.id), at: nowIso() };
    try { const info: any = await meta(String(pub.id), { token, params: { fields: "permalink" } }); if (info.permalink) done.url = info.permalink; } catch (_) { /* link is a nice-to-have */ }
    if (p.first_comment && p.format !== "story") { try { await meta(`${pub.id}/comments`, { method: "POST", token, params: { message: p.first_comment } }); } catch (e) { done.note = "First comment failed: " + short((e as Error).message, 120); } }
    return done;
  }

  /* ----- Facebook Page ----- */
  async function fbPublish(p: Post, s: Settings, token: string, save: (x: PState) => Promise<void>): Promise<PState> {
    const m = mediaOf(p), cap = captionFor(p, "facebook"), page = s.fb_page_id!;
    if (p.format === "story") return { status: "failed", error: "Facebook stories aren’t automatic yet. Post this one by hand." };
    await save({ status: "publishing", at: nowIso() });
    let id = "", url = "";
    if (m.videos.length && (p.format === "reel" || !p.format)) {
      const a: any = await meta(`${page}/video_reels`, { method: "POST", token, params: { upload_phase: "start" } });
      const up = await d.fetch(String(a.upload_url), { method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: m.videos[0] } });
      let uj: any = {}; try { uj = await up.json(); } catch (_) { /* */ }
      if (!up.ok || uj?.success === false || uj?.error) throw new ApiError("Facebook couldn’t fetch the video: " + short(uj?.error?.message || uj?.debug_info?.message || up.status, 200));
      await meta(`${page}/video_reels`, { method: "POST", token, params: { upload_phase: "finish", video_id: a.video_id, video_state: "PUBLISHED", description: cap, title: (p.title || "").slice(0, 250) } });
      id = String(a.video_id); url = `https://www.facebook.com/reel/${id}`;
    } else if (m.videos.length) {
      const v: any = await meta(`${page}/videos`, { method: "POST", token, base: GRAPH_VIDEO, params: { file_url: m.videos[0], description: cap, title: (p.youtube_title || p.title || "").slice(0, 250) } });
      id = String(v.id); url = `https://www.facebook.com/${page}/videos/${id}`;
    } else if (m.images.length === 1) {
      const ph: any = await meta(`${page}/photos`, { method: "POST", token, params: { url: m.images[0], caption: cap } });
      id = String(ph.post_id || ph.id); url = `https://www.facebook.com/${id}`;
    } else if (m.images.length > 1) {
      const ids: string[] = [];
      for (const u of m.images.slice(0, 10)) { const ph: any = await meta(`${page}/photos`, { method: "POST", token, params: { url: u, published: "false" } }); ids.push(String(ph.id)); }
      const params: Record<string, unknown> = { message: cap };
      ids.forEach((x, i) => { params[`attached_media[${i}]`] = { media_fbid: x }; });
      const f: any = await meta(`${page}/feed`, { method: "POST", token, params });
      id = String(f.id); url = `https://www.facebook.com/${id}`;
    } else {
      if (!cap) return { status: "failed", error: "Nothing to post: no caption and no media." };
      const f: any = await meta(`${page}/feed`, { method: "POST", token, params: { message: cap } });
      id = String(f.id); url = `https://www.facebook.com/${id}`;
    }
    const done: PState = { status: "posted", id, url, at: nowIso() };
    if (p.first_comment) { try { await meta(`${id}/comments`, { method: "POST", token, params: { message: p.first_comment } }); } catch (e) { done.note = "First comment failed: " + short((e as Error).message, 120); } }
    return done;
  }

  const TERMINAL = ["posted", "failed", "check"];
  async function publishDue(budgetUntil: number) {
    const s = await store.settings();
    const res = { posted: 0, failed: 0, waiting: 0, checked: 0 };
    if (!s.enabled) return { ...res, off: true };
    const token = await pageToken();
    if (!token || !s.fb_page_id) return { ...res, error: "not_connected" };
    const posts = await store.duePosts(nowIso(), new Date(d.now() - DAY).toISOString());
    for (const p of posts.slice(0, 8)) {
      if (d.now() > budgetUntil) break;
      const state: Record<string, PState> = { ...(p.publish_state || {}) };
      const plats = (p.platforms || []).filter((x) => AUTO_PLATFORMS.includes(x));
      for (const pl of plats) {
        let st: PState = state[pl] || {};
        if (TERMINAL.includes(st.status || "")) continue;
        res.checked++;
        const save = async (x: PState) => { state[pl] = x; await store.savePost(p.id, { publish_state: state }); };
        try {
          if (st.status === "publishing") {
            // We asked the platform to publish and never heard back. Don't risk a double post.
            if (d.now() - new Date(st.at || 0).getTime() < 10 * 60e3) { res.waiting++; continue; }
            st = { status: "check", at: nowIso(), error: "This may or may not have gone out. Look at your " + (pl === "instagram" ? "Instagram" : "Facebook Page") + ", then press Retry only if it isn’t there." };
          } else if (pl === "instagram") {
            if (!s.ig_id) st = { status: "failed", error: "No Instagram account is connected to your Facebook Page." };
            else {
              if (st.status !== "processing") { st = await igStart(p, s, token); if (st.status === "processing") await save(st); }
              if (st.status === "processing") st = await igContinue(p, st, s, token, save);
            }
          } else if (pl === "facebook") {
            st = await fbPublish(p, s, token, save);
          }
        } catch (e) {
          st = { status: "failed", at: nowIso(), error: short((e as Error).message, 400) };
        }
        await save(st);
        if (st.status === "posted") { res.posted++; await store.log({ event: "post", provider: pl, ok: true, detail: `#${p.id} ${short(p.title, 60)} → ${st.url || st.id || "posted"}` }); }
        else if (st.status === "failed" || st.status === "check") { res.failed++; await store.log({ event: "post", provider: pl, ok: false, detail: `#${p.id} ${short(p.title, 60)}: ${short(st.error, 200)}` }); }
        else res.waiting++;
      }
      // Every platform on this post handled by us and all of them out? Then the whole post is Posted.
      const all = p.platforms || [];
      if (all.length && all.every((x) => AUTO_PLATFORMS.includes(x) && state[x]?.status === "posted") && p.status !== "posted")
        await store.savePost(p.id, { status: "posted", publish_state: state });
    }
    return res;
  }
  async function retry(post: Post, platform: string) {
    const state = { ...(post.publish_state || {}) }; delete state[platform];
    await store.savePost(post.id, { publish_state: state });
    return { ok: true };
  }

  /* ============================================================
     AUTO-DMs: read new comments, answer the ones with a keyword
  ============================================================ */
  const MAX_AGE = 6.5 * DAY;   // Meta allows a private reply for 7 days after the comment
  type Seen = { id: string; text: string; user: string | null; userId: string | null; at: number; media: string };

  async function answer(platform: string, list: Seen[], words: Keyword[], s: Settings, cap: number, send: (c: Seen, k: Keyword) => Promise<{ dm_ok: boolean | null; public_ok: boolean | null; detail: string }>) {
    const since = s.dm_enabled_at ? new Date(s.dm_enabled_at).getTime() : d.now();
    const hits: { c: Seen; k: Keyword }[] = [];
    for (const c of list) {
      if (!c.id || c.at < since || d.now() - c.at > MAX_AGE) continue;
      const k = matchKeyword(c.text, words, platform);
      if (k && c.at >= new Date(k.created_at).getTime()) hits.push({ c, k });
    }
    if (!hits.length) return 0;
    const seen = await store.seenComments(platform, hits.map((h) => h.c.id));
    let n = 0;
    for (const { c, k } of hits) {
      if (n >= cap) break;
      if (seen.has(c.id)) continue;
      const mine = await store.claimDm({ platform, comment_id: c.id, media_id: c.media, username: c.user, comment_text: short(c.text, 300), keyword_id: k.id, keyword: k.keyword });
      if (!mine) continue;
      let r: { dm_ok: boolean | null; public_ok: boolean | null; detail: string };
      try { r = await send(c, k); } catch (e) { r = { dm_ok: false, public_ok: null, detail: short((e as Error).message, 300) }; }
      await store.finishDm(platform, c.id, r);
      if (r.dm_ok || r.public_ok) { n++; await store.keywordHit(k.id); }
    }
    return n;
  }

  async function pollInstagram(s: Settings, token: string, words: Keyword[], ps: Json) {
    const counts: Record<string, number> = { ...((ps.ig as Record<string, number>) || {}) }, next: Record<string, number> = {};
    const media: any = await meta(`${s.ig_id}/media`, { token, params: { fields: "id,timestamp,comments_count", limit: "25" } });
    const list: Seen[] = [];
    for (const m of media.data || []) {
      const n = Number(m.comments_count || 0), id = String(m.id);
      next[id] = n;
      if (!n || counts[id] === n) continue;                                 // nothing new on this post
      let path: string | null = `${id}/comments`;
      for (let page = 0; path && page < 3; page++) {
        const j: any = await meta(path, page === 0 ? { token, params: { fields: "id,text,username,timestamp,from", limit: "50" } } : { token });
        for (const c of j.data || []) list.push({ id: String(c.id), text: String(c.text || ""), user: c.username || c.from?.username || null, userId: c.from?.id ? String(c.from.id) : null, at: new Date(c.timestamp).getTime(), media: id });
        path = j.paging?.next || null;
      }
    }
    const own = (s.ig_username || "").toLowerCase();
    const n = await answer("instagram", list.filter((c) => !(own && (c.user || "").toLowerCase() === own) && c.userId !== s.ig_id), words, s, 40, async (c, k) => {
      let dm_ok = false, detail = "";
      const body = { recipient: { comment_id: c.id }, message: { text: k.dm_text } };
      try { await meta(`${s.ig_id}/messages`, { method: "POST", token, json: body }); dm_ok = true; }
      catch (e1) {
        try { await meta(`${s.fb_page_id}/messages`, { method: "POST", token, json: body }); dm_ok = true; }
        catch (e2) { detail = "DM: " + short((e2 as Error).message || (e1 as Error).message, 220); }
      }
      let public_ok: boolean | null = null;
      if (k.public_reply && k.public_reply.trim()) {
        try { await meta(`${c.id}/replies`, { method: "POST", token, params: { message: k.public_reply.trim() } }); public_ok = true; }
        catch (e) { public_ok = false; detail += (detail ? " · " : "") + "Reply: " + short((e as Error).message, 150); }
      }
      return { dm_ok, public_ok, detail: detail || "sent" };
    });
    ps.ig = next;
    return n;
  }

  async function pollFacebook(s: Settings, token: string, words: Keyword[]) {
    const j: any = await meta(`${s.fb_page_id}/published_posts`, { token, params: { fields: "id,created_time,comments.limit(50).order(reverse_chronological){id,message,created_time,from}", limit: "15" } });
    const list: Seen[] = [];
    for (const p of j.data || []) for (const c of p.comments?.data || [])
      list.push({ id: String(c.id), text: String(c.message || ""), user: c.from?.name || null, userId: c.from?.id ? String(c.from.id) : null, at: new Date(c.created_time).getTime(), media: String(p.id) });
    return await answer("facebook", list.filter((c) => c.userId !== s.fb_page_id), words, s, 40, async (c, k) => {
      let dm_ok = false, detail = "";
      try { await meta(`${s.fb_page_id}/messages`, { method: "POST", token, json: { recipient: { comment_id: c.id }, message: { text: k.dm_text }, messaging_type: "RESPONSE" } }); dm_ok = true; }
      catch (e) { detail = "DM: " + short((e as Error).message, 220); }
      let public_ok: boolean | null = null;
      if (k.public_reply && k.public_reply.trim()) {
        try { await meta(`${c.id}/comments`, { method: "POST", token, params: { message: k.public_reply.trim() } }); public_ok = true; }
        catch (e) { public_ok = false; detail += (detail ? " · " : "") + "Reply: " + short((e as Error).message, 150); }
      }
      return { dm_ok, public_ok, detail: detail || "sent" };
    });
  }

  /* ---------- YouTube (comments only: Google locks API uploads to private until an audit) ---------- */
  async function ytAccess(): Promise<string | null> {
    const [id, secret, refresh] = await Promise.all([store.secret("mth_social_yt_client_id"), store.secret("mth_social_yt_client_secret"), store.secret("mth_social_yt_refresh")]);
    if (!id || !secret || !refresh) return null;
    const r = await d.fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new ApiError("YouTube sign-in has expired: " + short(j.error_description || j.error || r.status, 160) + ". Connect YouTube again.");
    return String(j.access_token);
  }
  async function yt(path: string, access: string, o: { method?: string; params?: Record<string, string>; json?: unknown } = {}) {
    const u = new URL(`${YT}/${path}`);
    for (const [k, v] of Object.entries(o.params || {})) u.searchParams.set(k, v);
    const r = await d.fetch(u.toString(), { method: o.method || "GET", headers: { Authorization: `Bearer ${access}`, ...(o.json ? { "Content-Type": "application/json" } : {}) }, body: o.json ? JSON.stringify(o.json) : undefined });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new ApiError(short(j.error?.message || `YouTube said ${r.status}`), { status: r.status });
    return j;
  }
  async function pollYouTube(s: Settings, words: Keyword[]) {
    const access = await ytAccess();
    if (!access || !s.yt_channel_id) return 0;
    const j: any = await yt("commentThreads", access, { params: { part: "snippet", allThreadsRelatedToChannelId: s.yt_channel_id, order: "time", maxResults: "50", textFormat: "plainText" } });
    const list: Seen[] = [];
    for (const t of j.items || []) {
      const c = t.snippet?.topLevelComment, sn = c?.snippet || {};
      list.push({ id: String(c?.id || t.id), text: String(sn.textOriginal || sn.textDisplay || ""), user: sn.authorDisplayName || null, userId: sn.authorChannelId?.value || null, at: new Date(sn.publishedAt).getTime(), media: String(t.snippet?.videoId || "") });
    }
    return await answer("youtube", list.filter((c) => c.userId !== s.yt_channel_id), words, s, 5, async (c, k) => {   // 5 per run keeps us inside YouTube's daily allowance
      await yt("comments", access, { method: "POST", params: { part: "snippet" }, json: { snippet: { parentId: c.id, textOriginal: (k.youtube_reply && k.youtube_reply.trim()) || k.dm_text } } });
      return { dm_ok: null, public_ok: true, detail: "replied" };
    });
  }

  async function answerComments(budgetUntil: number) {
    const s = await store.settings();
    const res: Json = { instagram: 0, facebook: 0, youtube: 0 };
    if (!s.dm_enabled) return { ...res, off: true };
    const words = (await store.keywords()).filter((k) => k.active);
    if (!words.length) return { ...res, note: "no_keywords" };
    const ps: Json = { ...(s.poll_state || {}) }, errors: Record<string, string> = {};
    const has = (pl: string) => words.some((k) => (k.platforms || []).includes(pl));
    const token = await pageToken();
    if (token && s.ig_id && has("instagram") && d.now() < budgetUntil) { try { res.instagram = await pollInstagram(s, token, words, ps); } catch (e) { errors.instagram = short((e as Error).message, 250); } }
    if (token && s.fb_page_id && has("facebook") && d.now() < budgetUntil) { try { res.facebook = await pollFacebook(s, token, words); } catch (e) { errors.facebook = short((e as Error).message, 250); } }
    if (s.yt_channel_id && has("youtube") && d.now() < budgetUntil) { try { res.youtube = await pollYouTube(s, words); } catch (e) { errors.youtube = short((e as Error).message, 250); } }
    ps.errors = errors;
    await store.saveSettings({ poll_state: ps });
    if (Object.keys(errors).length) res.errors = errors;
    return res;
  }

  async function tick() {
    const until = d.now() + 100e3;
    const out: Json = { at: nowIso() };
    try { out.posting = await publishDue(until); } catch (e) { out.posting = { error: short((e as Error).message, 250) }; }
    try { out.dms = await answerComments(until); } catch (e) { out.dms = { error: short((e as Error).message, 250) }; }
    await store.saveSettings({ last_tick_at: nowIso(), last_tick: out, tick_lock_until: null });
    return out;
  }

  /* ---------- connecting YouTube ---------- */
  async function ytAuthUrl(redirect: string) {
    const id = await store.secret("mth_social_yt_client_id");
    if (!id) throw new ApiError("Add your Google client ID and secret first.");
    const state = crypto.randomUUID();
    const s = await store.settings();
    await store.saveSettings({ poll_state: { ...(s.poll_state || {}), yt_state: state, yt_state_at: d.now() } });
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: "https://www.googleapis.com/auth/youtube.force-ssl", state }).toString();
    return { url: u.toString() };
  }
  async function ytCallback(code: string, state: string, redirect: string) {
    const s = await store.settings(), ps = (s.poll_state || {}) as Json;
    if (!state || state !== ps.yt_state || d.now() - Number(ps.yt_state_at || 0) > 15 * 60e3) throw new ApiError("That sign-in link has expired. Press Connect YouTube again.");
    const [id, secret] = await Promise.all([store.secret("mth_social_yt_client_id"), store.secret("mth_social_yt_client_secret")]);
    const r = await d.fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ code, client_id: id || "", client_secret: secret || "", redirect_uri: redirect, grant_type: "authorization_code" }) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new ApiError("Google said no: " + short(j.error_description || j.error || r.status, 200));
    if (!j.refresh_token) throw new ApiError("Google didn’t give a long-term sign-in. Remove the app at myaccount.google.com/permissions and connect again.");
    const ch: any = await yt("channels", j.access_token, { params: { part: "snippet", mine: "true" } });
    const c = (ch.items || [])[0];
    if (!c) throw new ApiError("That Google account has no YouTube channel. Pick your Mark Talks Health channel when Google asks.");
    await store.setSecret("mth_social_yt_refresh", String(j.refresh_token));
    const ps2 = { ...ps }; delete ps2.yt_state; delete ps2.yt_state_at;
    await store.saveSettings({ yt_channel_id: String(c.id), yt_channel_title: String(c.snippet?.title || ""), yt_connected_at: nowIso(), poll_state: ps2 });
    return { ok: true, channel: c.snippet?.title };
  }
  async function ytDisconnect() {
    await store.setSecret("mth_social_yt_refresh", null);
    await store.saveSettings({ yt_channel_id: null, yt_channel_title: null, yt_connected_at: null });
    return { ok: true };
  }

  return { connectMeta, pickPage, disconnectMeta, testMeta, publishDue, answerComments, tick, retry, ytAuthUrl, ytCallback, ytDisconnect, meta };
}
