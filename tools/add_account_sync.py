"""Adds 'save my plan to my account' to the Diabetes (sugar) and GLP-1 apps.
Only switches on inside the new Mark Talks Health site (www/app.html), where the
signed-in member is known; inside LearnWorlds nothing changes (still saved on the device).
Plans are stored in Supabase table mth_app_state (one row per member per protocol).
Run once from the repo root: python3 tools/add_account_sync.py"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPS = {"sugar": ("mth_metfx_v1", "mth_met_start", "mth_met_time", "Diabetes Protocol"),
        "glp1":  ("mth_glpfx_v1", "mth_glp_start", "mth_glp_time", "GLP-1 Protocol")}

SYNC = r'''<style id="gp-sync-styles">
.gp-sync { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px; border-radius: 999px; background: var(--cream); border: 1px solid var(--border);
  font: 500 .66rem 'DM Sans', sans-serif; color: var(--muted); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.gp-sync[hidden] { display: none; }
.gp-sync i { width: 7px; height: 7px; border-radius: 50%; background: #b9b0a4; flex: none; }
.gp-sync.ok i { background: #2e8a62; box-shadow: 0 0 6px rgba(46,138,98,.5); }
.gp-sync.busy i { background: #d49a2a; animation: gpPulse 1s ease-in-out infinite; }
.gp-sync.warn i { background: #c85a3a; }
@keyframes gpPulse { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .gp-sync.busy i { animation: none; } }
@media print { .gp-sync { display: none !important; } }
</style>
<script>
/* ═══════════════════════════════════════════════════════════════
   ACCOUNT SYNC (own Mark Talks Health site only)
   When this app runs inside www/app.html, the signed-in member's intake,
   calendar and daily tracker are saved to Supabase (table mth_app_state)
   and restored on any device they sign in from. Anywhere else (LearnWorlds,
   previewing the file) this does nothing and the app saves on the device.
═══════════════════════════════════════════════════════════════ */
(function () {
  let host = null;
  try { host = window.parent !== window && window.parent.MTH && window.parent.MTH.user ? window.parent.MTH : null; } catch (e) {}
  if (!host) return;
  const PRODUCT = '@@P@@', FXKEY = '@@FX@@', SKEY = '@@ST@@', TKEY = '@@TM@@';
  const LOCAL = 'mth_' + PRODUCT + '_sync_v1', FX_KEYS = [FXKEY, SKEY, TKEY];
  const SB_URL = host.config.supabaseUrl, SB_KEY = host.config.supabaseKey;
  const $ = id => document.getElementById(id);
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: k => v => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const member = { id: host.user.id, email: (host.user.email || '').toLowerCase() };
  let applying = true, timer = null, lastSaved = 0, offline = false;

  /* status pill next to the app title */
  (function () { const h = document.querySelector('.hc-head'); if (h && !$('gpSync')) { const d = document.createElement('div'); d.className = 'gp-sync'; d.id = 'gpSync'; d.hidden = true; d.setAttribute('role', 'status'); h.appendChild(d); } })();
  const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 10 ? 'just now' : s < 60 ? s + 's ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : 'earlier today'; };
  function pill(kind, html) { const p = $('gpSync'); if (!p) return; p.hidden = false; p.className = 'gp-sync ' + (kind || ''); p.innerHTML = '<i></i><span>' + html + '</span>'; }
  function pillIdle() { if (offline) return pill('warn', 'Offline · saved on this device, will sync when you’re back'); pill('ok', 'Saved to your account' + (lastSaved ? ' · ' + ago(lastSaved) : '')); }
  setInterval(() => { if (!offline && !timer) pillIdle(); }, 30000);

  async function token() { const s = (await host.sb.auth.getSession()).data.session; if (!s) throw new Error('signed out'); return s.access_token; }
  async function load() {
    const r = await fetch(`${SB_URL}/rest/v1/mth_app_state?select=data,updated_at&product=eq.${PRODUCT}`, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + await token() } });
    if (!r.ok) throw new Error('load ' + r.status);
    const rows = await r.json(); return rows[0] || null;
  }
  async function store(d, keepalive) {
    const r = await fetch(`${SB_URL}/rest/v1/mth_app_state?on_conflict=user_id,product`, { method: 'POST', keepalive: !!keepalive,
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: member.id, product: PRODUCT, data: d, updated_at: new Date().toISOString() }) });
    if (!r.ok) throw new Error('save ' + r.status);
  }

  function collect() {
    const g = id => $(id);
    const sym = {}; (window.GUT_SYM_ITEMS || []).forEach(i => { if (GUT_SYM_VALS[i.id]) sym[i.id] = true; });
    let fx = null; try { fx = JSON.parse(ls.get(FXKEY) || 'null'); } catch (e) {}
    return {
      v: 1, savedAt: Date.now(), member: member.id,
      intake: {
        name: g('diName').value, gender: g('diGenderF').classList.contains('active') ? 'F' : 'M',
        h: +g('diHeight').value, w: +g('diWeight').value, a: +g('diAge').value, sym,
        cleanse: typeof fastingTypeSel !== 'undefined' ? fastingTypeSel : 'juice',
        lab: (window.LAB && LAB.items) || (typeof LAB !== 'undefined' ? LAB.items : {}),
        intensity: (g('dIntensity') || {}).value || 'high',
        gen: !!window._generated,
        pcts: window._diUserOverride && window._pcts ? window._pcts.slice() : null,
      },
      cal: { start: ls.get(SKEY), time: ls.get(TKEY) },
      fx,
    };
  }
  function meaningful(d) { return !!(d && d.intake && (d.intake.gen || Object.keys(d.intake.sym || {}).length || (d.fx && d.fx.days && Object.keys(d.fx.days).length))); }
  function apply(d) {
    if (!d || !d.intake) return;
    applying = true;
    const g = id => $(id), I = d.intake;
    if (d.cal && d.cal.start) ls.set(SKEY)(d.cal.start); else ls.del(SKEY);
    if (d.cal && d.cal.time) ls.set(TKEY)(d.cal.time);
    if (d.fx) ls.set(FXKEY)(JSON.stringify(d.fx)); else ls.del(FXKEY);
    window._caStart = null; window._caTime = null; window._caDay = null;
    if (I.gen) window._restoring = true;
    if (I.cleanse && typeof CLEANSE !== 'undefined' && CLEANSE[I.cleanse]) fastingType = I.cleanse;
    g('diName').value = I.name || '';
    diSetGender(I.gender === 'F' ? 'F' : 'M');
    if (I.h) g('diHeight').value = I.h; if (I.w) g('diWeight').value = I.w; if (I.a) g('diAge').value = I.a;
    GUT_SYM_ITEMS.forEach(i => { GUT_SYM_VALS[i.id] = !!(I.sym && I.sym[i.id]); const el = $('gs_' + i.id); if (el) el.checked = GUT_SYM_VALS[i.id]; });
    if (I.cleanse && CLEANSE[I.cleanse]) setFastingType(I.cleanse);
    LAB.items = I.lab && typeof I.lab === 'object' ? I.lab : {};
    diLiveUpdate(); gsRefresh(); labChanged();
    if (window.fxReload) window.fxReload();
    if (!I.gen) { if (window._caArgs) renderHealArc(...window._caArgs); applying = false; window._restoring = false; return; }
    window._generated = false;
    window._restoring = true;
    generateAll();
    setTimeout(() => {
      const dd = g('dIntensity');
      if (I.intensity && dd && dd.value !== I.intensity) {
        dd.value = I.intensity;
        const n = { low: 0, medium: 1, high: 2, critical: 3 }[I.intensity];
        if (n != null) { g('diMaster').value = n * 100; refreshMasterLabel(); }
        syncAndBuild(true);
      }
    }, 2400);
    setTimeout(() => {
      if (Array.isArray(I.pcts) && I.pcts.length === diHealers.length) { diHealers.forEach((h, i) => { g(h.id).value = I.pcts[i]; }); diHealUpdate(); }
      window._restoring = false; applying = false;
    }, 3400);
  }

  function dirty() { if (applying || window._restoring) return; clearTimeout(timer); pill('busy', 'Saving…'); timer = setTimeout(saveNow, 1200); }
  async function saveNow(keepalive) {
    clearTimeout(timer); timer = null;
    const d = collect(); ls.set(LOCAL)(JSON.stringify(d));
    try { await store(d, keepalive); lastSaved = Date.now(); offline = false; } catch (e) { console.warn('[sync]', e); offline = true; }
    pillIdle();
  }
  window.gpSaveNow = saveNow;
  const wrap = name => { const f = window[name]; if (typeof f !== 'function') return; window[name] = function () { const out = f.apply(this, arguments); dirty(); return out; }; };
  ['markPending', 'generateAll', 'diHealUpdate', 'diMasterUpdate', 'labChanged'].forEach(wrap);
  try { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { set.call(this, k, v); if (FX_KEYS.includes(k)) dirty(); }; } catch (e) {}
  const nm = $('diName'); if (nm) nm.addEventListener('input', dirty);
  const flush = () => { if (timer) saveNow(true); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  async function boot() {
    let local = null; try { local = JSON.parse(ls.get(LOCAL) || 'null'); } catch (e) {}
    if (local && local.member && local.member !== member.id) { local = null; [LOCAL].concat(FX_KEYS).forEach(ls.del); if (window.fxReload) window.fxReload(); }
    pill('busy', 'Loading your plan…');
    let cloud = null;
    try { const r = await load(); cloud = r && r.data; lastSaved = r ? Date.parse(r.updated_at) : 0; } catch (e) { console.warn('[sync]', e); offline = true; }
    if (local && !local.member && (meaningful(cloud) || offline)) local = null;
    const newest = [cloud, local].filter(meaningful).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
    if (newest) apply(newest); else applying = false;
    if (newest && newest !== cloud && !offline) setTimeout(() => saveNow(), 3600);
    pillIdle();
  }
  boot();
})();
</script>
'''

def rep(s, a, b):
    assert s.count(a) == 1, (a[:80], s.count(a)); return s.replace(a, b)

for p, (fx, st, tm, name) in APPS.items():
    path = os.path.join(ROOT, p, "index.html"); s = open(path, encoding="utf-8").read()
    if "ACCOUNT SYNC (own Mark Talks Health site only)" in s: print(p, "already has sync"); continue
    # 1. reloadable tracker state
    i0 = s.index("let S;\ntry { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}")
    i1 = s.index("\n", s.index("S.days = S.days || {};", i0))
    tail = s[s.index("S.days = S.days || {};", i0):i1]
    s = s[:i0] + """let S;
function loadS() {
  S = null;
  try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (!S || typeof S !== 'object') S = {};
  """ + tail + """
}
loadS();
// Account sync calls this after writing a restored tracker into storage
window.fxReload = () => { loadS(); sel = null; try { fxRender(); } catch (e) { console.error(e); } };""" + s[i1:]
    # 2. keep the member's meal plan while restoring
    s = rep(s, "if (rec.plan && rec.sig === sig && !force) return rec.plan;",
               "if (rec.plan && !force && (rec.sig === sig || window._restoring)) return rec.plan;")
    # 3. restoring a saved plan must not restart the 14-day arc
    s = rep(s, """  generateAll = function () {
    const t = caMid(new Date());""", """  generateAll = function () {
    if (window._restoring) { const out = _gen.apply(this, arguments); try { fxRender(); } catch (e) { console.error(e); } return out; }   // restoring a saved member: keep their day
    const t = caMid(new Date());""")
    # 4. the sync itself, just before the embed-resize helper
    block = SYNC.replace("@@P@@", p).replace("@@FX@@", fx).replace("@@ST@@", st).replace("@@TM@@", tm)
    s = rep(s, "<script>/* mth-embed-resize", block + "<script>/* mth-embed-resize")
    open(path, "w", encoding="utf-8").write(s)
    print(p, "sync added")
