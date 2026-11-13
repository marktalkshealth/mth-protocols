// Mark Talks Health: the results collector for the testing lab.
// Every 15 minutes it looks at Mark's Instagram, Facebook Page and YouTube channel and:
//   1. lists every piece of content there (whether our system posted it or Mark posted it by hand),
//   2. records its numbers (views, reach, likes, comments, shares, saves, watch time) so any two posts
//      can later be compared at the same age ("views at 24 hours"),
//   3. stores the comments themselves.
// It only reads. It never posts, replies or changes anything on a platform.
// The platforms rename and retire their numbers often, so each number is asked for in a way that
// survives one of them disappearing: a refused number is remembered and skipped, the rest still come in.
import { type Json, type Settings } from "./core.ts";

const HOUR = 3600e3, DAY = 24 * HOUR;
export type Item = { id: number; platform: string; external_id: string; posted_at: string; last_snap_at: string | null; via: string; post_id: number | null; comments: number | null; comments_pulled: number | null; duration_sec: number | null };
export type NewItem = { platform: string; external_id: string; kind: string | null; title: string | null; caption: string | null; permalink: string | null; thumb_url: string | null; duration_sec: number | null; posted_at: string; via: string; post_id: number | null; experiment_id: number | null; variant: string | null };
export type Nums = { views?: number | null; reach?: number | null; likes?: number | null; comments?: number | null; shares?: number | null; saves?: number | null; avg_watch_sec?: number | null; watch_sec?: number | null };
export type AutoRef = { post_id: number; experiment_id: number | null; variant: string | null };
export type LabStore = {
  settings(): Promise<Settings & { metrics_enabled?: boolean }>;
  saveSettings(patch: Json): Promise<void>;
  secret(name: string): Promise<string | null>;
  autoRefs(sinceIso: string): Promise<Record<string, AutoRef>>;          // "instagram:<id>" -> the planned post that our system sent
  items(platform: string, sinceIso: string): Promise<Item[]>;
  addItems(rows: NewItem[]): Promise<void>;
  linkItem(id: number, ref: AutoRef): Promise<void>;
  snapshot(item: Item, nums: Nums, raw: Json, ageHours: number, nowIso: string): Promise<void>;
  saveComments(rows: { item_id: number; platform: string; comment_id: string; username: string | null; body: string; likes: number | null; posted_at: string | null }[]): Promise<void>;
  markPulled(id: number, count: number): Promise<void>;
};
type Engine = {
  meta: (path: string, o: { method?: string; token: string; params?: Record<string, unknown>; json?: unknown; base?: string }) => Promise<any>;
  ytAccess: () => Promise<string | null>;
  yt: (path: string, access: string, o?: { method?: string; params?: Record<string, string>; json?: unknown; base?: string }) => Promise<any>;
};
const short = (s: unknown, n = 300) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
const num = (v: unknown): number | null => { const n = Number(v); return v === null || v === undefined || v === "" || !isFinite(n) ? null : n; };

/* how often a post's numbers are recorded, by its age: often while it is young, rarely once it has settled */
export function snapEveryMs(ageMs: number): number | null {
  if (ageMs < 6 * HOUR) return 30 * 60e3;
  if (ageMs < 48 * HOUR) return HOUR;
  if (ageMs < 14 * DAY) return 6 * HOUR;
  if (ageMs < 60 * DAY) return DAY;
  return null;
}
export function isoDuration(s: string): number | null {   // YouTube's "PT1H2M3S"
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(String(s || ""));
  if (!m) return null;
  return (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600) + (Number(m[3] || 0) * 60) + Number(m[4] || 0);
}

export function makeLab(d: { store: LabStore; engine: Engine; now: () => number }) {
  const { store, engine } = d;
  const nowIso = () => new Date(d.now()).toISOString();

  /* ask for several numbers at once; if the platform refuses, ask one by one and remember the ones it no longer has */
  async function insights(path: string, token: string, wanted: string[], bad: Record<string, string[]>, key: string): Promise<Record<string, number>> {
    const skip = new Set(bad[key] || []), ask = wanted.filter((m) => !skip.has(m)), out: Record<string, number> = {};
    if (!ask.length) return out;
    const read = (j: any) => { for (const x of j.data || []) { const v = x.values?.[0]?.value ?? x.total_value?.value; const n = num(typeof v === "object" && v ? Object.values(v).reduce((a: number, b) => a + Number(b || 0), 0) : v); if (n !== null) out[x.name] = n; } };
    try { read(await engine.meta(path, { token, params: { metric: ask.join(",") } })); return out; }
    catch (_) { /* one of them is refused: find out which */ }
    for (const m of ask) {
      try { read(await engine.meta(path, { token, params: { metric: m } })); }
      catch (e) { const msg = String((e as Error).message || ""); if (!/limit|rate|temporar|timeout|try again/i.test(msg)) { skip.add(m); bad[key] = [...skip]; } }
    }
    return out;
  }
  function due(it: Item): boolean {
    const age = d.now() - new Date(it.posted_at).getTime(), every = snapEveryMs(age);
    if (every === null) return false;
    return !it.last_snap_at || d.now() - new Date(it.last_snap_at).getTime() >= every - 60e3;
  }
  const ageH = (it: { posted_at: string }) => Math.max(0, (d.now() - new Date(it.posted_at).getTime()) / HOUR);

  /* a platform lists what is there now; anything we haven't seen before becomes a new row */
  async function sync(platform: string, found: (NewItem & { alt?: string[] })[], refs: Record<string, AutoRef>): Promise<Item[]> {
    const since = new Date(d.now() - 61 * DAY).toISOString();
    let have = await store.items(platform, since);
    const known = new Map(have.map((i) => [i.external_id, i]));
    const fresh: NewItem[] = [];
    for (const f of found) {
      const ref = [f.external_id, ...(f.alt || [])].map((x) => refs[`${platform}:${x}`]).find(Boolean);
      const ex = known.get(f.external_id);
      if (!ex) { const { alt: _a, ...row } = f; fresh.push(ref ? { ...row, via: "auto", post_id: ref.post_id, experiment_id: ref.experiment_id, variant: ref.variant } : row); }
      else if (ref && ex.via !== "auto") await store.linkItem(ex.id, ref);
    }
    if (fresh.length) { await store.addItems(fresh); have = await store.items(platform, since); }
    return have;
  }

  /* ---------------- Instagram ---------------- */
  async function instagram(s: Settings, token: string, refs: Record<string, AutoRef>, bad: Record<string, string[]>, budget: { left: number }) {
    const j: any = await engine.meta(`${s.ig_id}/media`, { token, params: { fields: "id,timestamp,media_type,media_product_type,permalink,caption,like_count,comments_count,thumbnail_url,media_url", limit: "50" } });
    const live = new Map<string, any>();
    const found = (j.data || []).map((m: any) => {
      live.set(String(m.id), m);
      const prod = String(m.media_product_type || ""), type = String(m.media_type || "");
      const kind = prod === "REELS" ? "reel" : prod === "STORY" ? "story" : type === "CAROUSEL_ALBUM" ? "carousel" : type === "VIDEO" ? "video" : "image";
      return { platform: "instagram", external_id: String(m.id), kind, title: short(m.caption, 90) || null, caption: m.caption ? String(m.caption).slice(0, 2200) : null, permalink: m.permalink || null,
        thumb_url: m.thumbnail_url || (type === "IMAGE" ? m.media_url : null) || null, duration_sec: null, posted_at: new Date(m.timestamp).toISOString(), via: "hand", post_id: null, experiment_id: null, variant: null };
    });
    const items = await sync("instagram", found, refs);
    let n = 0;
    for (const it of items) {
      const m = live.get(it.external_id);
      if (!m || !due(it) || budget.left <= 0) continue;
      budget.left--;
      const prod = String(m.media_product_type || "FEED");
      const want = prod === "REELS" ? ["views", "reach", "saved", "shares", "total_interactions", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"] : prod === "STORY" ? ["views", "reach", "shares", "replies"] : ["views", "reach", "saved", "shares", "total_interactions"];
      const x = await insights(`${it.external_id}/insights`, token, want, bad, `ig:${prod}`);
      const nums: Nums = { views: num(x.views), reach: num(x.reach), likes: num(m.like_count), comments: num(m.comments_count), shares: num(x.shares), saves: num(x.saved),
        avg_watch_sec: x.ig_reels_avg_watch_time != null ? Math.round(x.ig_reels_avg_watch_time / 10) / 100 : null, watch_sec: x.ig_reels_video_view_total_time != null ? Math.round(x.ig_reels_video_view_total_time / 1000) : null };
      await store.snapshot(it, nums, x, ageH(it), nowIso()); it.comments = nums.comments ?? it.comments; n++;
    }
    return { items, n };
  }
  async function instagramComments(it: Item, token: string) {
    const j: any = await engine.meta(`${it.external_id}/comments`, { token, params: { fields: "id,text,username,timestamp,like_count", limit: "50" } });
    return (j.data || []).map((c: any) => ({ item_id: it.id, platform: "instagram", comment_id: String(c.id), username: c.username || null, body: String(c.text || "").slice(0, 2000), likes: num(c.like_count), posted_at: c.timestamp ? new Date(c.timestamp).toISOString() : null }));
  }

  /* ---------------- Facebook Page ---------------- */
  async function facebook(s: Settings, token: string, refs: Record<string, AutoRef>, bad: Record<string, string[]>, budget: { left: number }) {
    const j: any = await engine.meta(`${s.fb_page_id}/published_posts`, { token, params: { fields: "id,created_time,message,permalink_url,full_picture,attachments{media_type,target{id}},shares,reactions.limit(0).summary(total_count),comments.limit(0).summary(total_count)", limit: "50" } });
    const live = new Map<string, any>();
    const found = (j.data || []).map((p: any) => {
      live.set(String(p.id), p);
      const a = p.attachments?.data?.[0] || {}, mt = String(a.media_type || ""), link = String(p.permalink_url || "");
      const kind = mt === "video" ? (/\/reel\//.test(link) ? "reel" : "video") : mt === "photo" ? "image" : mt === "album" ? "carousel" : "text";
      const target = a.target?.id ? String(a.target.id) : "";
      return { platform: "facebook", external_id: String(p.id), alt: [target, String(p.id).split("_").pop() || ""].filter(Boolean), kind, title: short(p.message, 90) || null, caption: p.message ? String(p.message).slice(0, 5000) : null,
        permalink: link || null, thumb_url: p.full_picture || null, duration_sec: null, posted_at: new Date(p.created_time).toISOString(), via: "hand", post_id: null, experiment_id: null, variant: null };
    });
    const items = await sync("facebook", found, refs);
    let n = 0;
    for (const it of items) {
      const p = live.get(it.external_id);
      if (!p || !due(it) || budget.left <= 0) continue;
      budget.left--;
      const isVideo = String(p.attachments?.data?.[0]?.media_type || "") === "video";
      const x = await insights(`${it.external_id}/insights`, token, isVideo ? ["post_media_view", "post_total_media_view_unique", "post_video_views", "post_video_avg_time_watched", "post_video_view_time"] : ["post_media_view", "post_total_media_view_unique"], bad, `fb:${isVideo ? "video" : "post"}`);
      const nums: Nums = { views: num(x.post_media_view ?? x.post_video_views), reach: num(x.post_total_media_view_unique), likes: num(p.reactions?.summary?.total_count), comments: num(p.comments?.summary?.total_count), shares: num(p.shares?.count) ?? 0, saves: null,
        avg_watch_sec: x.post_video_avg_time_watched != null ? Math.round(x.post_video_avg_time_watched / 10) / 100 : null, watch_sec: x.post_video_view_time != null ? Math.round(x.post_video_view_time / 1000) : null };
      await store.snapshot(it, nums, x, ageH(it), nowIso()); it.comments = nums.comments ?? it.comments; n++;
    }
    return { items, n };
  }
  async function facebookComments(it: Item, token: string) {
    const j: any = await engine.meta(`${it.external_id}/comments`, { token, params: { fields: "id,message,from,created_time,like_count", limit: "50", order: "reverse_chronological" } });
    return (j.data || []).map((c: any) => ({ item_id: it.id, platform: "facebook", comment_id: String(c.id), username: c.from?.name || null, body: String(c.message || "").slice(0, 2000), likes: num(c.like_count), posted_at: c.created_time ? new Date(c.created_time).toISOString() : null }));
  }

  /* ---------------- YouTube ---------------- */
  async function youtube(s: Settings, access: string, ps: Json, budget: { left: number }) {
    let uploads = String(ps.yt_uploads || "");
    if (!uploads) { const ch: any = await engine.yt("channels", access, { params: { part: "contentDetails", mine: "true" } }); uploads = String(ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || ""); ps.yt_uploads = uploads; }
    if (!uploads) return { items: [] as Item[], n: 0 };
    const pl: any = await engine.yt("playlistItems", access, { params: { part: "contentDetails", playlistId: uploads, maxResults: "50" } });
    const ids: string[] = (pl.items || []).map((x: any) => String(x.contentDetails?.videoId || "")).filter(Boolean);
    if (!ids.length) return { items: [] as Item[], n: 0 };
    const vs: any = await engine.yt("videos", access, { params: { part: "snippet,statistics,contentDetails,status", id: ids.join(","), maxResults: "50" } });
    const live = new Map<string, any>();
    const found = (vs.items || []).filter((v: any) => (v.status?.privacyStatus || "public") === "public").map((v: any) => {
      live.set(String(v.id), v);
      const dur = isoDuration(v.contentDetails?.duration);
      return { platform: "youtube", external_id: String(v.id), kind: dur !== null && dur <= 180 ? "short" : "video", title: short(v.snippet?.title, 120) || null, caption: v.snippet?.description ? String(v.snippet.description).slice(0, 5000) : null,
        permalink: `https://www.youtube.com/watch?v=${v.id}`, thumb_url: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || null, duration_sec: dur, posted_at: new Date(v.snippet?.publishedAt).toISOString(), via: "hand", post_id: null, experiment_id: null, variant: null };
    });
    const items = await sync("youtube", found, {});
    const todo = items.filter((it) => live.has(it.external_id) && due(it)).slice(0, Math.max(0, budget.left));
    // watch time comes from YouTube's analytics service, if Mark allowed it; one call covers every video
    const watch: Record<string, { avg: number | null; sec: number | null }> = {};
    if (todo.length && !ps.yt_no_analytics) {
      try {
        const r: any = await engine.yt("reports", access, { base: "https://youtubeanalytics.googleapis.com/v2", params: { ids: "channel==MINE", startDate: "2005-01-01", endDate: new Date(d.now()).toISOString().slice(0, 10), metrics: "views,estimatedMinutesWatched,averageViewDuration", dimensions: "video", filters: `video==${todo.map((t) => t.external_id).join(",")}` } });
        const h: string[] = (r.columnHeaders || []).map((c: any) => String(c.name));
        for (const row of r.rows || []) watch[String(row[h.indexOf("video")])] = { avg: num(row[h.indexOf("averageViewDuration")]), sec: num(row[h.indexOf("estimatedMinutesWatched")]) !== null ? Number(row[h.indexOf("estimatedMinutesWatched")]) * 60 : null };
      } catch (e) { const msg = String((e as Error).message || ""); if (/403|permission|scope|not been used|disabled|forbidden/i.test(msg)) ps.yt_no_analytics = short(msg, 160); }
    }
    let n = 0;
    for (const it of todo) {
      const st = live.get(it.external_id).statistics || {}, w = watch[it.external_id] || { avg: null, sec: null };
      budget.left--;
      const nums: Nums = { views: num(st.viewCount), reach: null, likes: num(st.likeCount), comments: num(st.commentCount), shares: null, saves: null, avg_watch_sec: w.avg, watch_sec: w.sec };
      await store.snapshot(it, nums, { ...st }, ageH(it), nowIso()); it.comments = nums.comments ?? it.comments; n++;
    }
    return { items, n };
  }
  async function youtubeComments(it: Item, access: string) {
    const j: any = await engine.yt("commentThreads", access, { params: { part: "snippet", videoId: it.external_id, order: "time", maxResults: "50", textFormat: "plainText" } });
    return (j.items || []).map((t: any) => { const c = t.snippet?.topLevelComment, sn = c?.snippet || {};
      return { item_id: it.id, platform: "youtube", comment_id: String(c?.id || t.id), username: sn.authorDisplayName || null, body: String(sn.textOriginal || sn.textDisplay || "").slice(0, 2000), likes: num(sn.likeCount), posted_at: sn.publishedAt ? new Date(sn.publishedAt).toISOString() : null }; });
  }

  /* posts under 30 days old whose comment count grew since we last stored their comments */
  async function pullComments(items: Item[], fetchOne: (it: Item) => Promise<any[]>, cap: number) {
    let n = 0;
    const todo = items.filter((it) => d.now() - new Date(it.posted_at).getTime() < 30 * DAY && (it.comments || 0) > (it.comments_pulled || 0)).slice(0, cap);
    for (const it of todo) {
      try { const rows = (await fetchOne(it)).filter((r) => r.comment_id && r.body); if (rows.length) await store.saveComments(rows); await store.markPulled(it.id, it.comments || 0); n += rows.length; }
      catch (_) { /* try again next round */ }
    }
    return n;
  }

  async function run(budgetUntil: number, force = false): Promise<Json> {
    const s = await store.settings();
    if (s.metrics_enabled === false) return { off: true };
    const ps: Json = { ...(s.poll_state || {}) };
    if (!force && d.now() - Number(ps.lab_at || 0) < 14 * 60e3) return { skipped: "not_due" };
    const token = await store.secret("mth_social_fb_page_token");
    const out: Json = {}, errors: Record<string, string> = {}, bad: Record<string, string[]> = { ...((ps.lab_bad as Record<string, string[]>) || {}) };
    const budget = { left: 45 };
    const refs = token ? await store.autoRefs(new Date(d.now() - 35 * DAY).toISOString()) : {};
    if (token && s.ig_id && d.now() < budgetUntil) {
      try { const r = await instagram(s, token, refs, bad, budget); out.instagram = { posts: r.items.length, recorded: r.n, comments: await pullComments(r.items, (it) => instagramComments(it, token), 8) }; }
      catch (e) { errors.instagram = short((e as Error).message, 250); }
    }
    if (token && s.fb_page_id && d.now() < budgetUntil) {
      try { const r = await facebook(s, token, refs, bad, budget); out.facebook = { posts: r.items.length, recorded: r.n, comments: await pullComments(r.items, (it) => facebookComments(it, token), 8) }; }
      catch (e) { errors.facebook = short((e as Error).message, 250); }
    }
    if (s.yt_channel_id && d.now() < budgetUntil) {
      try { const access = await engine.ytAccess(); if (access) { const r = await youtube(s, access, ps, budget); out.youtube = { posts: r.items.length, recorded: r.n, comments: await pullComments(r.items, (it) => youtubeComments(it, access), 3) }; } }
      catch (e) { errors.youtube = short((e as Error).message, 250); }
    }
    // keep what the other parts of the engine wrote to poll_state during this run
    const latest = ((await store.settings()).poll_state || {}) as Json;
    await store.saveSettings({ poll_state: { ...latest, lab_at: d.now(), lab_bad: bad, lab_errors: errors, lab_last: out, yt_uploads: ps.yt_uploads ?? latest.yt_uploads, yt_no_analytics: ps.yt_no_analytics ?? latest.yt_no_analytics } });
    if (Object.keys(errors).length) out.errors = errors;
    return out;
  }
  return { run, snapEveryMs };
}
