import { makeEngine, captionFor, matchKeyword, type Store, type Post, type Keyword, type Settings } from "../functions/mth-social/core.ts";
import assert from "node:assert/strict";

let NOW = Date.parse("2026-11-13T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

function world() {
  const calls: { method: string; url: string; body: string; headers: Record<string, string> }[] = [];
  const w: any = {
    calls, settings: { enabled: true, dm_enabled: true, dm_enabled_at: iso(NOW - 3600e3), fb_page_id: "PAGE", fb_page_name: "Mark Talks Health", ig_id: "IG", ig_username: "marktalkshealth", yt_channel_id: null, yt_channel_title: null, poll_state: {} } as Settings,
    secrets: { mth_social_fb_page_token: "PAGETOKEN_" + "x".repeat(40) } as Record<string, string | null>,
    posts: [] as Post[], words: [] as Keyword[], dm: new Map<string, any>(), logs: [] as any[], hits: {} as Record<number, number>,
    containers: {} as Record<string, { status: string; polls: number }>, igComments: {} as Record<string, any[]>, igMedia: [] as any[], fbPosts: [] as any[], ytThreads: [] as any[],
    failNext: null as null | ((url: string, method: string) => any),
    published: [] as string[], dmsSent: [] as any[], replies: [] as any[],
  };
  const store: Store = {
    async settings() { return structuredClone(w.settings); },
    async saveSettings(p) { Object.assign(w.settings, structuredClone(p)); },
    async secret(n) { return w.secrets[n] ?? null; },
    async setSecret(n, v) { if (v) w.secrets[n] = v; else delete w.secrets[n]; },
    async duePosts(now, since) { return structuredClone(w.posts.filter((p: Post) => p.auto_publish && ["ready", "scheduled"].includes(p.status) && p.publish_at! <= now && p.publish_at! >= since)); },
    async savePost(id, patch) { Object.assign(w.posts.find((p: Post) => p.id === id), structuredClone(patch)); },
    async keywords() { return structuredClone(w.words); },
    async seenComments(pl, ids) { return new Set(ids.filter((i) => w.dm.has(pl + ":" + i))); },
    async claimDm(r) { const k = r.platform + ":" + r.comment_id; if (w.dm.has(k)) return false; w.dm.set(k, { ...r }); return true; },
    async finishDm(pl, id, patch) { Object.assign(w.dm.get(pl + ":" + id), patch); },
    async keywordHit(id) { w.hits[id] = (w.hits[id] || 0) + 1; },
    async log(r) { w.logs.push(r); },
  };
  const J = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
  const fakeFetch = (async (input: any, init: any = {}) => {
    const url = String(input), method = init.method || "GET", u = new URL(url);
    const headers: Record<string, string> = { ...(init.headers || {}) };
    const body = init.body instanceof URLSearchParams ? init.body.toString() : String(init.body || "");
    calls.push({ method, url, body, headers });
    const form = new URLSearchParams(init.body instanceof URLSearchParams ? init.body : "");
    const jb = headers["Content-Type"] === "application/json" ? JSON.parse(body || "{}") : {};
    if (w.failNext) { const r = w.failNext(url, method); if (r) return r; }
    const path = u.pathname.replace(/^\/v\d+\.\d+\//, "/").replace(/^\/video-upload\/v\d+\.\d+\//, "/video-upload/");
    const tok = u.searchParams.get("access_token") || form.get("access_token") || (headers.Authorization || "").replace(/^(Bearer|OAuth) /, "");
    if (/facebook\.com$/.test(u.hostname) && !tok) return J({ error: { message: "no token", code: 190 } }, 400);
    // ---- connect
    if (path === "/me/accounts") return J({ data: [{ id: "PAGE", name: "Mark Talks Health", access_token: "PAGETOKEN_" + "y".repeat(40), instagram_business_account: { id: "IG", username: "marktalkshealth" } }] });
    if (path === "/debug_token") return J({ data: { expires_at: 0, scopes: ["pages_manage_posts", "pages_read_engagement", "pages_manage_engagement", "pages_messaging", "instagram_basic", "instagram_content_publish", "instagram_manage_comments"] } });
    // ---- instagram publishing
    if (path === "/IG/media" && method === "POST") { const id = "C" + (Object.keys(w.containers).length + 1); const vid = !!form.get("video_url"); w.containers[id] = { status: vid ? "IN_PROGRESS" : "FINISHED", polls: 0, form: Object.fromEntries(form) } as any; return J({ id }); }
    if (/^\/C\d+$/.test(path) && method === "GET") { const c = w.containers[path.slice(1)]; c.polls++; if (c.status === "IN_PROGRESS" && c.polls >= 2) c.status = "FINISHED"; return J({ status_code: c.status, status: c.status }); }
    if (path === "/IG/media_publish") { const id = "M" + form.get("creation_id"); w.published.push("ig:" + id); return J({ id }); }
    if (/^\/MC\d+$/.test(path) && method === "GET") return J({ permalink: "https://www.instagram.com/reel/" + path.slice(1) + "/" });
    if (/^\/MC\d+\/comments$/.test(path) && method === "POST") { w.replies.push({ first: form.get("message") }); return J({ id: "FC1" }); }
    // ---- facebook publishing
    if (path === "/PAGE/video_reels") { if (form.get("upload_phase") === "start") return J({ video_id: "V1", upload_url: "https://rupload.facebook.com/video-upload/v24.0/V1" }); w.published.push("fb:reel:" + form.get("video_id") + ":" + form.get("video_state")); return J({ success: true }); }
    if (path === "/video-upload/V1") { assert.equal(headers.Authorization?.startsWith("OAuth "), true); assert.ok(headers.file_url); return J({ success: true }); }
    if (path === "/PAGE/videos") { assert.equal(u.hostname, "graph-video.facebook.com"); w.published.push("fb:video"); return J({ id: "VID9" }); }
    if (path === "/PAGE/photos") { if (form.get("published") === "false") return J({ id: "PH" + Math.random().toString().slice(2, 6) }); w.published.push("fb:photo"); return J({ id: "PH1", post_id: "PAGE_77" }); }
    if (path === "/PAGE/feed") { w.published.push("fb:feed:" + [...form.keys()].filter((k) => k.startsWith("attached_media")).length); return J({ id: "PAGE_88" }); }
    if (/facebook\.com$/.test(u.hostname) && /\/comments$/.test(path) && method === "POST") { w.replies.push({ on: path, message: form.get("message") }); return J({ id: "R1" }); }
    // ---- comments
    if (path === "/IG/media" && method === "GET") return J({ data: w.igMedia });
    if (/^\/IGM\d+\/comments$/.test(path)) return J({ data: w.igComments[path.split("/")[1]] || [] });
    if (path === "/IG/messages" || path === "/PAGE/messages") { w.dmsSent.push({ path, ...jb }); return J({ recipient_id: "U", message_id: "m1" }); }
    if (/\/replies$/.test(path)) { w.replies.push({ on: path, message: form.get("message") }); return J({ id: "R2" }); }
    if (path === "/PAGE/published_posts") return J({ data: w.fbPosts });
    // ---- youtube
    if (u.hostname === "oauth2.googleapis.com") return J({ access_token: "ya29.test" });
    if (u.pathname === "/youtube/v3/commentThreads") return J({ items: w.ytThreads });
    if (u.pathname === "/youtube/v3/comments") { w.replies.push({ yt: JSON.parse(body) }); return J({ id: "ytr" }); }
    return J({ error: { message: "unhandled " + method + " " + path, code: 1 } }, 400);
  }) as typeof fetch;
  const engine = makeEngine({ store, fetch: fakeFetch, now: () => NOW, env: () => "" });
  return { w, engine };
}
const post = (o: Partial<Post>): Post => ({ id: 1, title: "Bone broth", status: "scheduled", format: "reel", platforms: ["instagram", "facebook"], publish_at: iso(NOW - 60e3), caption: "Main caption", captions: {}, hashtags: "#guthealth", cta: "Comment GUT", slug: "bone-broth-1", media_urls: ["https://x.supabase.co/storage/v1/object/public/social-media/posts/1/a.mp4"], first_comment: null, youtube_title: null, auto_publish: true, publish_state: {}, ...o });
const kw = (o: Partial<Keyword>): Keyword => ({ id: 1, keyword: "GUT", platforms: ["instagram", "facebook", "youtube"], dm_text: "Here is your link: https://marktalkshealth.com/gut", public_reply: "Sent! Check your DMs.", youtube_reply: null, active: true, created_at: iso(NOW - 7200e3), ...o });
let n = 0; const t = async (name: string, f: () => Promise<void> | void) => { NOW = Date.parse("2026-11-13T12:00:00Z"); await f(); n++; console.log("ok  " + name); };

await t("caption matches the Studio screen", () => {
  const p = post({ captions: { instagram: "IG only" } });
  assert.equal(captionFor(p, "instagram"), "IG only\n\nComment GUT\n\n#guthealth");
  assert.equal(captionFor(p, "facebook"), "Main caption\n\nComment GUT https://marktalkshealth.com/go.html?p=bone-broth-1&s=facebook\n\n#guthealth");
});
await t("keyword must be its own word", () => {
  const ws = [kw({}), kw({ id: 2, keyword: "gut health" })];
  assert.equal(matchKeyword("GUT!!", ws, "instagram")?.id, 1);
  assert.equal(matchKeyword("send me the gut-health one", ws, "instagram")?.id, 2);
  assert.equal(matchKeyword("my gutter is leaking", ws, "instagram"), null);
  assert.equal(matchKeyword("gut", [kw({ platforms: ["facebook"] })], "instagram"), null);
  assert.equal(matchKeyword("gut", [kw({ active: false })], "instagram"), null);
});
await t("connect: one page is picked automatically, token kept out of the answer", async () => {
  const { w, engine } = world(); w.secrets = {}; w.settings.fb_page_id = null;
  const r: any = await engine.connectMeta("EAAG" + "z".repeat(60));
  assert.equal(r.picked.id, "PAGE"); assert.equal(JSON.stringify(r).includes("PAGETOKEN"), false);
  assert.equal(w.settings.ig_username, "marktalkshealth"); assert.ok(w.secrets.mth_social_fb_page_token.startsWith("PAGETOKEN_y"));
  assert.match(w.settings.meta_note, /instagram_manage_messages/);
});
await t("nothing happens while the switches are off", async () => {
  const { w, engine } = world(); w.settings.enabled = false; w.settings.dm_enabled = false; w.posts = [post({})];
  const r: any = await engine.tick();
  assert.equal(r.posting.off, true); assert.equal(r.dms.off, true); assert.equal(w.calls.length, 0);
});
await t("a post without Auto-post ticked is never sent", async () => {
  const { w, engine } = world(); w.settings.dm_enabled = false; w.posts = [post({ auto_publish: false })];
  await engine.tick(); assert.equal(w.published.length, 0);
});
await t("a post more than a day late is not sent", async () => {
  const { w, engine } = world(); w.settings.dm_enabled = false; w.posts = [post({ publish_at: iso(NOW - 25 * 3600e3) })];
  await engine.tick(); assert.equal(w.published.length, 0);
});
await t("a future post waits", async () => {
  const { w, engine } = world(); w.settings.dm_enabled = false; w.posts = [post({ publish_at: iso(NOW + 60e3) })];
  await engine.tick(); assert.equal(w.published.length, 0);
});
await t("reel: Facebook goes out now, Instagram waits for processing then goes out once", async () => {
  const { w, engine } = world(); w.settings.dm_enabled = false; w.posts = [post({ first_comment: "Link in bio" })];
  await engine.tick();
  assert.deepEqual(w.published, ["fb:reel:V1:PUBLISHED"]);
  assert.equal(w.posts[0].publish_state.instagram.status, "processing");
  assert.equal(w.posts[0].publish_state.facebook.status, "posted");
  assert.equal(w.posts[0].status, "scheduled");
  NOW += 120e3; await engine.tick();
  assert.deepEqual(w.published, ["fb:reel:V1:PUBLISHED", "ig:MC1"]);
  assert.equal(w.posts[0].publish_state.instagram.url, "https://www.instagram.com/reel/MC1/");
  assert.equal(w.posts[0].status, "posted");
  NOW += 120e3; await engine.tick(); NOW += 120e3; await engine.tick();
  assert.equal(w.published.length, 2, "never posted twice");
  assert.equal(w.replies.filter((r: any) => r.first === "Link in bio" || r.message === "Link in bio").length, 2);
  const c = w.containers.C1 as any; assert.equal(c.form.media_type, "REELS"); assert.match(c.form.caption, /Comment GUT/);
});
await t("single picture and carousel", async () => {
  const { w, engine } = world(); w.settings.dm_enabled = false;
  w.posts = [post({ id: 1, format: "feed", media_urls: ["https://a/b.jpg"] }), post({ id: 2, format: "carousel", media_urls: ["https://a/1.jpg", "https://a/2.jpg", "https://a/3.jpg"] })];
  await engine.tick();
  assert.deepEqual(w.published.sort(), ["fb:feed:3", "fb:photo", "ig:MC1", "ig:MC5"].sort());
  assert.equal((w.containers.C5 as any).form.media_type, "CAROUSEL"); assert.equal((w.containers.C5 as any).form.children, "C2,C3,C4");
});
await t("long 16:9 video goes to Facebook as a normal video", async () => {
  const { w, engine } = world(); w.settings.dm_enabled = false; w.posts = [post({ format: "youtube", platforms: ["facebook", "youtube"] })];
  await engine.tick();
  assert.deepEqual(w.published, ["fb:video"]);
  assert.equal(w.posts[0].status, "scheduled", "YouTube is still by hand, so the post is not marked Posted");
});
await t("a platform error is shown on the post and not retried by itself", async () => {
  const { w, engine } = world(); w.settings.dm_enabled = false; w.posts = [post({ platforms: ["facebook"] })];
  w.failNext = (url: string) => url.includes("video_reels") ? new Response(JSON.stringify({ error: { message: "(#200) Permissions error", code: 200 } }), { status: 403 }) : null;
  await engine.tick();
  assert.equal(w.posts[0].publish_state.facebook.status, "failed"); assert.match(w.posts[0].publish_state.facebook.error!, /Permissions/);
  w.failNext = null; NOW += 120e3; await engine.tick(); assert.equal(w.published.length, 0);
  await engine.retry(w.posts[0], "facebook"); await engine.tick(); assert.equal(w.published.length, 1);
});
await t("crash right after asking to publish = flagged to check, never double-posted", async () => {
  const { w, engine } = world(); w.settings.dm_enabled = false;
  w.posts = [post({ platforms: ["facebook"], publish_state: { facebook: { status: "publishing", at: iso(NOW - 60e3) } } })];
  await engine.tick(); assert.equal(w.posts[0].publish_state.facebook.status, "publishing");
  NOW += 11 * 60e3; await engine.tick();
  assert.equal(w.posts[0].publish_state.facebook.status, "check"); assert.equal(w.published.length, 0);
});
await t("Instagram processing error and missing media", async () => {
  const { w, engine } = world(); w.settings.dm_enabled = false; w.posts = [post({ platforms: ["instagram"] }), post({ id: 2, platforms: ["instagram"], media_urls: [] })];
  await engine.tick(); w.containers.C1.status = "ERROR"; NOW += 120e3; await engine.tick();
  assert.equal(w.posts[0].publish_state.instagram.status, "failed");
  assert.match(w.posts[1].publish_state.instagram.error!, /needs a picture or a video/);
});
await t("auto-DM on Instagram: new keyword comment gets one DM + one public reply", async () => {
  const { w, engine } = world(); w.settings.enabled = false; w.words = [kw({})];
  w.igMedia = [{ id: "IGM1", timestamp: iso(NOW - 3 * 3600e3), comments_count: 4 }, { id: "IGM2", timestamp: iso(NOW - 3600e3), comments_count: 0 }];
  w.igComments.IGM1 = [
    { id: "c1", text: "GUT", username: "anna", timestamp: iso(NOW - 600e3), from: { id: "u1", username: "anna" } },
    { id: "c2", text: "love this", username: "bob", timestamp: iso(NOW - 500e3) },
    { id: "c3", text: "gut please", username: "old", timestamp: iso(NOW - 2 * 3600e3) },          // before auto-DMs were switched on
    { id: "c4", text: "Comment GUT below", username: "marktalkshealth", timestamp: iso(NOW - 400e3) },   // Mark himself
  ];
  const r: any = await engine.tick();
  assert.equal(r.dms.instagram, 1);
  assert.deepEqual(w.dmsSent, [{ path: "/IG/messages", recipient: { comment_id: "c1" }, message: { text: "Here is your link: https://marktalkshealth.com/gut" } }]);
  assert.deepEqual(w.replies, [{ on: "/c1/replies", message: "Sent! Check your DMs." }]);
  assert.equal(w.dm.get("instagram:c1").dm_ok, true); assert.equal(w.hits[1], 1);
  const before = w.calls.length; NOW += 120e3; await engine.tick();
  assert.equal(w.dmsSent.length, 1, "no second DM");
  assert.equal(w.calls.slice(before).filter((c: any) => c.url.includes("/comments")).length, 0, "unchanged post = its comments are not fetched again");
  w.igMedia[0].comments_count = 5; w.igComments.IGM1.unshift({ id: "c5", text: "Gut", username: "cara", timestamp: iso(NOW - 30e3) });
  NOW += 120e3; await engine.tick(); assert.equal(w.dmsSent.length, 2);
});
await t("auto-DM: if Instagram refuses the DM, the public reply still goes and the reason is saved", async () => {
  const { w, engine } = world(); w.settings.enabled = false; w.words = [kw({})];
  w.igMedia = [{ id: "IGM1", timestamp: iso(NOW - 3600e3), comments_count: 1 }];
  w.igComments.IGM1 = [{ id: "c1", text: "gut", username: "anna", timestamp: iso(NOW - 60e3) }];
  w.failNext = (url: string) => url.includes("/messages") ? new Response(JSON.stringify({ error: { message: "(#10) Application does not have permission for this action", code: 10 } }), { status: 403 }) : null;
  await engine.tick();
  const row = w.dm.get("instagram:c1"); assert.equal(row.dm_ok, false); assert.equal(row.public_ok, true); assert.match(row.detail, /does not have permission/);
  w.failNext = null; NOW += 120e3; w.igMedia[0].comments_count = 2; await engine.tick(); assert.equal(w.dmsSent.length, 0, "not retried by itself");
});
await t("auto-DM on Facebook and reply on YouTube", async () => {
  const { w, engine } = world(); w.settings.enabled = false; w.settings.yt_channel_id = "UCme"; w.words = [kw({ youtube_reply: "Here you go: marktalkshealth.com/gut" })];
  Object.assign(w.secrets, { mth_social_yt_client_id: "id", mth_social_yt_client_secret: "s", mth_social_yt_refresh: "r" });
  w.fbPosts = [{ id: "PAGE_1", comments: { data: [{ id: "PAGE_1_9", message: "GUT", created_time: iso(NOW - 60e3), from: { id: "u7", name: "Dee" } }, { id: "PAGE_1_8", message: "gut", created_time: iso(NOW - 50e3), from: { id: "PAGE", name: "Mark Talks Health" } }] } }];
  w.ytThreads = [{ id: "t1", snippet: { videoId: "vid", topLevelComment: { id: "t1", snippet: { textOriginal: "GUT", authorDisplayName: "Eli", authorChannelId: { value: "UCx" }, publishedAt: iso(NOW - 60e3) } } } },
                 { id: "t2", snippet: { videoId: "vid", topLevelComment: { id: "t2", snippet: { textOriginal: "gut", authorDisplayName: "Me", authorChannelId: { value: "UCme" }, publishedAt: iso(NOW - 60e3) } } } }];
  const r: any = await engine.tick();
  assert.equal(r.dms.facebook, 1); assert.equal(r.dms.youtube, 1);
  assert.deepEqual(w.dmsSent, [{ path: "/PAGE/messages", recipient: { comment_id: "PAGE_1_9" }, message: { text: "Here is your link: https://marktalkshealth.com/gut" }, messaging_type: "RESPONSE" }]);
  assert.deepEqual(w.replies.find((x: any) => x.yt).yt, { snippet: { parentId: "t1", textOriginal: "Here you go: marktalkshealth.com/gut" } });
});
await t("a keyword only answers comments made after it was created", async () => {
  const { w, engine } = world(); w.settings.enabled = false; w.words = [kw({ created_at: iso(NOW - 60e3) })];
  w.igMedia = [{ id: "IGM1", timestamp: iso(NOW - 3600e3), comments_count: 1 }];
  w.igComments.IGM1 = [{ id: "c1", text: "gut", username: "anna", timestamp: iso(NOW - 600e3) }];
  await engine.tick(); assert.equal(w.dmsSent.length, 0);
});
console.log(`\n${n} checks passed`);
