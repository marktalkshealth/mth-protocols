/* =================================================================
   MARK TALKS HEALTH — SHARED PHONE APP LAYOUT
   Used by the Gut Health, Diabetes and GLP-1 protocol apps.
   On phones and tablets the protocol turns into a simple healing app:
   bottom tabs (Today · My Arc · Me) built around the 7-day healing arc,
   a three-page swipe setup, and nothing else on screen.
   On desktop nothing changes.
   Test any device:  add ?view=app  or  ?view=desktop  to the address.
   This file only shows and hides the existing parts of each app;
   it never changes how the protocol itself works.
================================================================= */
(function () {
  if (window.MTHApp) return;
  window.MTHApp = { on: false };

  var VIEW_KEY = 'mth_view';
  var param = null, saved = null;
  try { param = new URLSearchParams(location.search).get('view'); } catch (e) {}
  try { saved = localStorage.getItem(VIEW_KEY); } catch (e) {}
  if (param === 'app' || param === 'desktop') { saved = param; try { localStorage.setItem(VIEW_KEY, param); } catch (e) {} }

  function isPhoneOrTablet() {
    var mm = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
    var coarse = mm('(pointer: coarse)');
    var hasMouse = mm('(any-pointer: fine)');   /* touchscreen laptops also have a trackpad or mouse: they get the desktop layout */
    var shortSide = Math.min(screen.width || 9999, screen.height || 9999);
    return coarse && !hasMouse && shortSide <= 1100;   /* phones and tablets, upright or sideways */
  }
  var touch = isPhoneOrTablet();
  var on = saved === 'app' ? true : saved === 'desktop' ? false : touch;

  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  /* On the members' /app page on a computer: use the whole screen width */
  if (!on) {
    try { if (new URLSearchParams(location.search).get('mode') === 'app') {
      var wide = document.createElement('style');
      wide.textContent = '.di-outer,.ca-outer,.fx-outer{max-width:none!important}';
      (document.head || document.documentElement).appendChild(wide);
    } } catch (e) {}
  }
  /* A phone that was switched to the full page layout gets a small way back */
  if (!on) {
    if (touch) ready(function () {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'mth-backapp'; b.textContent = 'App view';
      b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:950;padding:9px 14px;border-radius:999px;border:1px solid #e3dbd0;background:#fbf8f3;color:#2b2622;font:600 13px/1 "DM Sans",system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.12)';
      b.onclick = function () { try { localStorage.setItem(VIEW_KEY, 'app'); } catch (e) {} location.reload(); };
      document.body.appendChild(b);
    });
    return;
  }
  window.MTHApp.on = true;
  var root = document.documentElement;
  root.classList.add('mth-app');
  try { if (new URLSearchParams(location.search).get('mode') === 'app') root.classList.add('mth-standalone'); } catch (e) {}


  /* =================================================================
     SIMPLE PHONE HEALING APP
     Three tabs: Today · My Arc · Me.
     Today  = this day of the healing arc: food, movement, healing habits, each one tick.
     My Arc = how far through the arc you are, day by day.
     Me     = intake, symptoms and tests as three swipe pages, then the 7-day plan.
     Everything is read from the protocol itself (cleanse level, start date, cleanse and
     refeed days, its own wording for each day), so the desktop software is unchanged.
  ================================================================= */
  var css = `
html.mth-app { -webkit-text-size-adjust: 100%; }
html.mth-app body { padding-bottom: calc(86px + env(safe-area-inset-bottom)) !important; background: #f6f1ea !important; }
html.mth-app .di-outer { padding: 10px 12px 0 !important; max-width: 640px !important; margin: 0 auto !important; }
html.mth-app .hc-card { padding: 0 !important; background: transparent !important; border: 0 !important; box-shadow: none !important; }

/* the full software stays on the page but out of sight */
html.mth-app .hc-head, html.mth-app .hc-below, html.mth-app #fastingArcContainer, html.mth-app #planSlot,
html.mth-app .fx-outer, html.mth-app #fx, html.mth-app #fxOverview, html.mth-app .ca-outer, html.mth-app #main,
html.mth-app .fx-fab, html.mth-app .hc-cap, html.mth-app .hc-heal { display: none !important; }
html.mth-app .hc-grid3, html.mth-app .ms-today, html.mth-app .ms-arc, html.mth-app .ms-me { display: none !important; }
html.mth-app[data-mth-tab="today"] .ms-today, html.mth-app[data-mth-tab="arc"] .ms-arc, html.mth-app[data-mth-tab="me"] .ms-me { display: block !important; }

/* Me: three swipe pages (about you · symptoms · tests) */
html.mth-app[data-mth-tab="me"] .hc-grid3 { display: flex !important; gap: 12px; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; align-items: flex-start; transition: height .2s ease;
  grid-template-columns: none !important; scrollbar-width: none; -webkit-overflow-scrolling: touch; margin: 0 -12px; padding: 2px 12px 6px; }
html.mth-app .hc-grid3::-webkit-scrollbar { display: none; }
html.mth-app .hc-mid { display: contents !important; }
html.mth-app .hc-intake, html.mth-app .gs-panel, html.mth-app .lab-panel { flex: 0 0 100% !important; min-width: 0; max-width: 100%; scroll-snap-align: center; scroll-snap-stop: always; }
html.mth-app .hc-intake { display: block !important; }
html.mth-app .di-panel { padding: 16px 14px !important; border-radius: 18px !important; margin: 0 !important; }
html.mth-app .hc-intake .di-title, html.mth-app .hc-intake .di-metrics-section-title, html.mth-app .hc-intake .di-metrics-grid,
html.mth-app #diGenBtn, html.mth-app #diGenHint, html.mth-app .gs-panel > .gs-head, html.mth-app .lab-panel > .gs-head { display: none !important; }
html.mth-app #diMasterNote { display: none !important; }
html.mth-app .gs-cols { columns: 1 !important; }

/* simple screens */
.ms { font-family: 'DM Sans', system-ui, -apple-system, sans-serif; color: #2b2622; }
.ms-k { font: 700 .66rem/1.2 'DM Sans', system-ui, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #b8664a; }
.ms-h { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: 2.1rem; line-height: 1.05; margin: 4px 0 2px; color: #2b2622; }
.ms-h em { font-style: italic; color: #b8664a; }
.ms-sub { font-size: .88rem; color: #8a7d71; line-height: 1.45; }
.ms-top { padding: 8px 4px 14px; }
.ms-dots { display: flex; gap: 6px; margin-top: 14px; }
.ms-dots i { flex: 1; height: 6px; border-radius: 6px; background: #e7dfd4; }
.ms-dots i.c { background: #c0623f; } .ms-dots i.r { background: #b8924a; } .ms-dots i.h { background: #7a8f6e; }
.ms-dots i.fut { opacity: .28; }
.ms-dots i.now { box-shadow: 0 0 0 2px #f6f1ea, 0 0 0 3.5px #2b2622; }
.ms-card { background: #fffcf7; border: 1px solid #e7dfd4; border-radius: 20px; padding: 16px 16px 8px; margin-bottom: 12px; box-shadow: 0 10px 26px rgba(43,38,34,.05); }
.ms-ch { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.ms-ch .ic { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; font-size: 1.15rem; flex: none; }
.ms-ch .t { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.45rem; line-height: 1; flex: 1; }
.ms-ch .n { font-size: .78rem; font-weight: 700; color: #8a7d71; }
.ms-it { display: flex; gap: 12px; align-items: flex-start; width: 100%; text-align: left; background: none; border: 0; border-top: 1px solid #efe8de; padding: 12px 0; font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ms-ch + .ms-it { border-top: 0; }
.ms-it .bx { flex: none; width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #cfc3b4; display: grid; place-items: center; margin-top: 1px; transition: background .15s, border-color .15s; }
.ms-it .bx svg { width: 14px; height: 14px; opacity: 0; }
.ms-it.on .bx { background: #2e5c45; border-color: #2e5c45; }
.ms-it.on .bx svg { opacity: 1; }
.ms-it .tx { flex: 1; font-size: .98rem; line-height: 1.4; }
.ms-it .tx b { display: block; font-size: .66rem; letter-spacing: .14em; text-transform: uppercase; color: #8a7d71; margin-bottom: 2px; font-weight: 700; }
.ms-it.on .tx { color: #8a7d71; }
.ms-it[disabled] { cursor: default; }
.ms-tip { font-size: .82rem; color: #8a7d71; padding: 2px 0 10px 38px; line-height: 1.4; }
.ms-next { text-align: center; font-size: .82rem; color: #8a7d71; padding: 6px 0 14px; }
.ms-banner { background: #2b2622; color: #f6f1ea; border-radius: 20px; padding: 18px 16px; margin-bottom: 12px; }
.ms-banner .ms-h { color: #fff; font-size: 1.7rem; }
.ms-banner p { font-size: .9rem; color: #d9cfc3; margin: 6px 0 12px; line-height: 1.45; }
.ms-btn { display: block; width: 100%; min-height: 50px; border: 0; border-radius: 14px; background: #2b2622; color: #fff; font: 600 .98rem 'DM Sans', system-ui, sans-serif; cursor: pointer; }
.ms-banner .ms-btn { background: #c0623f; }
.ms-btn.ghost { background: transparent; border: 1px solid #ddd3c6; color: #2b2622; }
.ms-done { text-align: center; padding: 6px 0 2px; font-size: .9rem; color: #2e5c45; font-weight: 600; }

/* arc */
.ms-ring { display: flex; align-items: center; gap: 16px; }
.ms-ring svg { width: 92px; height: 92px; flex: none; transform: rotate(-90deg); }
.ms-ring .big { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 2.4rem; line-height: 1; }
.ms-days { list-style: none; margin: 0; padding: 0; }
.ms-day { border-top: 1px solid #efe8de; }
.ms-day:first-child { border-top: 0; }
.ms-dayb { display: flex; gap: 12px; align-items: center; width: 100%; background: none; border: 0; padding: 12px 0; text-align: left; font: inherit; color: inherit; cursor: pointer; }
.ms-dn { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: .88rem; color: #fff; }
.ms-dn.c { background: #c0623f; } .ms-dn.r { background: #b8924a; } .ms-dn.h { background: #7a8f6e; }
.ms-day.fut .ms-dn { opacity: .45; }
.ms-day.full .ms-dn { box-shadow: 0 0 0 3px #f6f1ea, 0 0 0 4.5px #2e5c45; }
.ms-dt { flex: 1; min-width: 0; }
.ms-dt b { display: block; font-size: .98rem; }
.ms-dt small { display: block; font-size: .8rem; color: #8a7d71; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-dst { font-size: .72rem; font-weight: 700; color: #8a7d71; text-transform: uppercase; letter-spacing: .08em; flex: none; }
.ms-dst.today { color: #c0623f; }
.ms-dd { display: none; padding: 0 0 14px 46px; font-size: .9rem; line-height: 1.5; color: #4a423b; }
.ms-day.open .ms-dd { display: block; }
.ms-dd p { margin: 0 0 6px; }
.ms-dd b { font-size: .66rem; letter-spacing: .14em; text-transform: uppercase; color: #8a7d71; }
.ms-start { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: .9rem; padding: 4px 0 8px; }
.ms-start input { font: 600 .9rem 'DM Sans', system-ui, sans-serif; color: #2b2622; border: 1px solid #ddd3c6; border-radius: 10px; padding: 8px 10px; background: #fff; }

/* me */
.ms-pages { display: flex; gap: 6px; margin: 0 0 12px; background: #ece4d8; padding: 4px; border-radius: 14px; }
.ms-pages button { flex: 1; border: 0; background: none; border-radius: 11px; padding: 10px 4px; font: 600 .82rem 'DM Sans', system-ui, sans-serif; color: #8a7d71; cursor: pointer; }
.ms-pages button.on { background: #fffcf7; color: #2b2622; box-shadow: 0 2px 8px rgba(43,38,34,.08); }
.ms-pages button i { font-style: normal; display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: #d9cfc3; color: #fff; font-size: .68rem; margin-right: 5px; }
.ms-pages button.on i { background: #2e5c45; }
.ms-meact { padding: 12px 0 18px; display: grid; gap: 8px; }
.ms-swipe { text-align: center; font-size: .78rem; color: #a3968a; margin: 8px 0 0; }
.ms-foot { text-align: center; padding: 14px 0 6px; }
.ms-foot button { background: none; border: 0; color: #8a7d71; font: 500 .8rem 'DM Sans', system-ui, sans-serif; text-decoration: underline; cursor: pointer; }
html.mth-app.mth-setup .ms-plan, html.mth-app.mth-setup .ms-foot, html.mth-app.mth-setup .mth-bar { display: none !important; }
html.mth-app.mth-setup body { padding-bottom: 24px !important; }

/* bottom tab bar */
.mth-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 960; display: flex; justify-content: center; gap: 4px;
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom)); background: rgba(251,248,243,.96);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border-top: 1px solid #e7dfd4; }
.mth-bar button { flex: 1; max-width: 140px; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0 4px;
  border: 0; background: none; color: #9a8f84; font: 600 .7rem/1 'DM Sans', system-ui, sans-serif; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.mth-bar button svg { width: 24px; height: 24px; }
.mth-bar button[aria-selected="true"] { color: #2e5c45; }
.mth-pip { width: 18px; height: 3px; border-radius: 3px; background: #2e5c45; opacity: 0; margin-top: 1px; }
.mth-bar button[aria-selected="true"] .mth-pip { opacity: 1; }
html.mth-app.mth-bar-inline .mth-bar { position: static; border: 1px solid #e7dfd4; border-radius: 16px; margin: 0 0 10px; padding: 4px; }
html.mth-app.mth-bar-inline body { padding-bottom: 24px !important; }

/* waiting for a saved plan */
html.mth-app.mth-wait .di-outer, html.mth-app.mth-wait .mth-bar { visibility: hidden !important; }
html.mth-app.mth-wait body::after { content: 'Opening your plan…'; position: fixed; left: 0; right: 0; top: 40%; text-align: center;
  font: 400 1.35rem 'Cormorant Garamond', Georgia, serif; color: #8a7d71; }
`;
  var st = document.createElement('style'); st.id = 'mth-app-styles'; st.textContent = css;
  (document.head || root).appendChild(st);

  var ICONS = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
    arc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3.5 17a8.5 8.5 0 0 1 17 0"/><circle cx="3.5" cy="17" r="1.6"/><circle cx="12" cy="8.5" r="1.6"/><circle cx="20.5" cy="17" r="1.6"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.7 4-5.6 7.5-5.6s6.3 1.9 7.5 5.6"/></svg>'
  };
  var TABS = [['today', 'Today'], ['arc', 'My Arc'], ['me', 'Me']];
  var TAB_KEY = 'mth_app_tab2';
  var TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  var PROTO = (location.pathname.match(/\/(gut|sugar|glp1)\b/) || [, 'gut'])[1];
  var WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- reading the protocol ---------- */
  function g(name) { try { return (0, eval)(name); } catch (e) { return undefined; } }   /* the protocol's own top-level values */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cap(s) { s = String(s).trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function mid(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function arc() {
    var type = g('fastingType') || 'juice', C = (g('CLEANSE') || {})[type] || { name: 'Cleanse', short: 'Cleanse', emoji: '🌿' };
    var L = { cd: 3, rd: 2 }; try { L = g('cleanseLen')(); } catch (e) {}
    var start = new Date(); try { start = g('caStart')(); } catch (e) {}
    start = mid(start);
    var n = Math.max(7, L.cd + L.rd);
    var today = Math.round((mid(new Date()) - start) / 864e5) + 1;
    return { type: type, C: C, cd: L.cd, rd: L.rd, n: n, start: start, today: today };
  }
  function kind(A, d) { return d <= A.cd ? 'c' : d <= A.cd + A.rd ? 'r' : 'h'; }
  function dayDate(A, d) { var x = new Date(A.start); x.setDate(x.getDate() + d - 1); return x; }
  function dayName(A, d) {
    var k = kind(A, d);
    if (k === 'c') return A.C.short + ' day ' + d;
    if (k === 'r') return (A.rd > 1 ? 'Refeed day ' + (d - A.cd) : 'Refeed day');
    return 'Healing day';
  }
  function shortDate(x) { return WD[x.getDay()].slice(0, 3) + ' ' + MO[x.getMonth()] + ' ' + x.getDate(); }

  /* split the protocol's sentence for a day into short tick-able lines */
  function splitTop(s, sep) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i]; if (ch === '(') depth++; if (ch === ')') depth = Math.max(0, depth - 1);
      if (!depth && s.substr(i, sep.length) === sep) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
      cur += ch;
    }
    out.push(cur); return out.map(function (x) { return x.trim(); }).filter(Boolean);
  }
  var MEAL = /\b(breakfast|lunch|dinner)\b/i;
  function foodLines(text) {
    var body = String(text || '').replace(/^[^:]{0,40}:\s*/, '');
    var sentences = splitTop(body.replace(/\.\s*$/, ''), '. ');
    var first = sentences.shift() || '', items = [];
    if (MEAL.test(first)) {
      splitTop(first, ', ').forEach(function (c) {
        c.replace(/\b(breakfast|lunch|dinner)\s+and\s+/gi, '$1\u0001').split('\u0001').forEach(function (p) {
          p = p.replace(/^and\s+/i, '').replace(/\s*\(≈[^)]*\)/g, '').trim();
          var m = p.match(MEAL), label = m ? cap(m[1].toLowerCase()) : (items.length ? '' : 'Morning');
          p = p.replace(/\s+(?:at|for)\s+(?:breakfast|lunch|dinner)\b/i, '').trim();
          if (p) items.push({ label: label, text: cap(p) });
        });
      });
    } else if (first) items.push({ label: '', text: cap(first.replace(/\s*\(≈[^)]*\)/g, '')) });
    var tip = sentences.map(function (s) { return cap(s.replace(/\s*\(≈[^)]*\)/g, '')); }).join('. ');
    return { items: items, tip: tip ? tip + '.' : '' };
  }
  function plan(A, d) {
    var k = kind(A, d), type = A.type, F;
    try {
      if (k === 'c') F = foodLines(g('cleanseDayText')(type, d));
      else if (k === 'r') F = foodLines(g('refeedText')(type, d - A.cd));
    } catch (e) {}
    if (!F || !F.items.length) F = { items: [
      { label: 'Meals', text: 'Whole-food meals: eggs, fish or chicken, cooked vegetables and olive oil. Small portions, eaten slowly.' },
      { label: 'Before meals', text: '1 cup of warm bone broth' }], tip: '' };
    var all = (F.items.map(function (i) { return i.text; }).join(' ') + ' ' + F.tip);
    if (!/\b\d(?:–\d)?\s*L\b|litre/i.test(all)) F.items.push({ label: 'All day', text: '2–3 litres of water' });
    var fast = type === 'water' && k === 'c' && /water/i.test(A.C.name);
    var move = d <= 2 ? [{ label: '', text: fast ? 'Rest today. A slow 5-minute stroll only if you feel steady.' : 'A gentle 10-minute walk' }, { label: '', text: 'Easy stretching in bed, morning and night' }]
      : fast ? [{ label: '', text: 'An easy 10-minute walk, only if you feel steady' }, { label: '', text: 'Gentle stretching' }]
      : [{ label: '', text: (d <= 4 ? 'A gentle 20-minute walk' : 'A brisk 30-minute walk') }, { label: '', text: 'A dozen squats' }, { label: '', text: 'A dozen lunges' }, { label: '', text: 'A few flights of stairs' }];
    var heal = [
      { label: '', text: d <= 2 ? 'Rest as much as you can, with 8+ hours of sleep tonight' : '8 hours of sleep, with a window open for fresh air' },
      { label: '', text: '20 minutes of midday sun' },
      { label: '', text: d <= 2 ? '15 minutes of quiet: meditation, prayer or journaling' : '15 minutes of meditation or journaling' }];
    return { food: F.items, tip: F.tip, move: move, heal: heal };
  }

  /* ---------- ticks ---------- */
  function tkKey(A, d) { return 'mth_ms_' + PROTO + '_' + iso(A.start) + '_d' + d; }
  function ticks(A, d) { try { return JSON.parse(localStorage.getItem(tkKey(A, d)) || '[]'); } catch (e) { return []; } }
  function setTick(A, d, id, on) {
    var t = ticks(A, d).filter(function (x) { return x !== id; }); if (on) t.push(id);
    try { localStorage.setItem(tkKey(A, d), JSON.stringify(t)); } catch (e) {}
  }
  function total(P) { return P.food.length + P.move.length + P.heal.length; }
  function doneOf(A, d) { var P = plan(A, d), t = ticks(A, d); return { done: Math.min(t.length, total(P)), total: total(P) }; }

  ready(function () {
    var genBtn = document.getElementById('diGenBtn');
    var card = document.querySelector('.hc-card');
    var grid = document.querySelector('.hc-grid3');
    if (!genBtn || !card || !grid) return;   /* not a protocol app page */
    function isSetUp() { return !genBtn.classList.contains('di-pending'); }

    /* --- screens --- */
    var today = document.createElement('div'); today.className = 'ms ms-today';
    var arcEl = document.createElement('div'); arcEl.className = 'ms ms-arc';
    var meTop = document.createElement('div'); meTop.className = 'ms ms-me';
    var meBot = document.createElement('div'); meBot.className = 'ms ms-me';
    card.insertBefore(today, grid); card.insertBefore(arcEl, grid); card.insertBefore(meTop, grid);
    grid.parentNode.insertBefore(meBot, grid.nextSibling);

    /* --- tab bar --- */
    var bar = document.createElement('nav');
    bar.className = 'mth-bar'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Sections');
    bar.innerHTML = TABS.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="false">' + ICONS[t[0]] + '<span>' + t[1] + '</span><span class="mth-pip"></span></button>';
    }).join('');
    bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (b) show(b.dataset.tab, true); });

    function itemsHtml(A, d, list, pre, live) {
      var t = ticks(A, d);
      return list.map(function (it, i) {
        var id = pre + i, on = t.indexOf(id) >= 0;
        return '<button type="button" class="ms-it' + (on ? ' on' : '') + '" data-id="' + id + '" data-d="' + d + '"' + (live ? '' : ' disabled') + '>' +
          '<span class="bx">' + TICK + '</span><span class="tx">' + (it.label ? '<b>' + esc(it.label) + '</b>' : '') + esc(it.text) + '</span></button>';
      }).join('');
    }
    function cardHtml(A, d, icon, bg, title, list, pre, live, tip) {
      var t = ticks(A, d), n = list.filter(function (x, i) { return t.indexOf(pre + i) >= 0; }).length;
      return '<div class="ms-card"><div class="ms-ch"><span class="ic" style="background:' + bg + '">' + icon + '</span><span class="t">' + title + '</span><span class="n">' + n + ' / ' + list.length + '</span></div>' +
        itemsHtml(A, d, list, pre, live) + (tip ? '<div class="ms-tip">' + esc(tip) + '</div>' : '') + '</div>';
    }
    function dotsHtml(A, cur) {
      var h = ''; for (var d = 1; d <= A.n; d++) h += '<i class="' + kind(A, d) + (d > cur ? ' fut' : '') + (d === cur ? ' now' : '') + '"></i>';
      return '<div class="ms-dots">' + h + '</div>';
    }

    function renderToday() {
      var A = arc(), d = A.today, live = d >= 1 && d <= A.n, show = live ? d : (d < 1 ? 1 : A.n);
      var name = ((document.getElementById('diName') || {}).value || '').trim().split(' ')[0];
      var P = plan(A, show), h = '';
      if (d < 1) {
        var x = A.start;
        h += '<div class="ms-banner"><div class="ms-k" style="color:#e3a184">Coming up</div><div class="ms-h">Your arc starts ' + esc(WD[x.getDay()]) + '</div><p>' + esc(MO[x.getMonth()] + ' ' + x.getDate()) + '. Here is what Day 1 looks like, so you can get ready.</p><button type="button" class="ms-btn" data-act="startnow">Start today instead</button></div>';
      } else if (d > A.n) {
        h += '<div class="ms-banner"><div class="ms-k" style="color:#e3a184">Arc complete</div><div class="ms-h">You finished your ' + A.n + '-day arc</div><p>Well done' + (name ? ', ' + esc(name) : '') + '. When you are ready, start a fresh arc today, or change your cleanse level under Me first.</p><button type="button" class="ms-btn" data-act="startnow">Start a new arc today</button></div>';
      }
      h += '<div class="ms-top"><div class="ms-k">Day ' + show + ' of ' + A.n + ' · ' + esc(A.C.emoji || '') + ' ' + esc(A.C.name) + '</div>' +
        '<div class="ms-h">' + (live ? (name ? 'Today, ' + esc(name) : 'Today') : 'Day ' + show) + '</div>' +
        '<div class="ms-sub">' + esc(dayName(A, show)) + ' · ' + esc(shortDate(dayDate(A, show))) + '</div>' + dotsHtml(A, live ? d : 0) + '</div>';
      h += cardHtml(A, show, '🥤', '#f6dccf', 'Food today', P.food, 'f', live, P.tip);
      h += cardHtml(A, show, '🚶', '#e3ead9', 'Movement', P.move, 'm', live, '');
      h += cardHtml(A, show, '🌿', '#efe3cc', 'Heal', P.heal, 'h', live, '');
      if (live) {
        var D = doneOf(A, show);
        if (D.done >= D.total) h += '<div class="ms-done">Day ' + show + ' complete. Beautiful work.</div>';
        if (show < A.n) h += '<div class="ms-next">Tomorrow: ' + esc(dayName(A, show + 1)) + '</div>';
      }
      today.innerHTML = h;
    }

    function daysHtml(A, open) {
      var h = '<ul class="ms-days">';
      for (var d = 1; d <= A.n; d++) {
        var P = plan(A, d), D = doneOf(A, d), k = kind(A, d);
        var stt = d === A.today ? '<span class="ms-dst today">Today</span>' : d < A.today ? '<span class="ms-dst">' + D.done + '/' + D.total + '</span>' : '<span class="ms-dst">' + esc(shortDate(dayDate(A, d)).slice(0, 3)) + '</span>';
        h += '<li class="ms-day' + (d > A.today ? ' fut' : '') + (D.done >= D.total ? ' full' : '') + (open === d ? ' open' : '') + '"><button type="button" class="ms-dayb" data-day="' + d + '">' +
          '<span class="ms-dn ' + k + '">' + d + '</span><span class="ms-dt"><b>' + esc(dayName(A, d)) + '</b><small>' + esc(P.food.map(function (i) { return i.text; }).join(' · ')) + '</small></span>' + stt + '</button>' +
          '<div class="ms-dd"><p><b>Food</b><br>' + P.food.map(function (i) { return (i.label ? esc(i.label) + ': ' : '') + esc(i.text); }).join('<br>') + (P.tip ? '<br><i>' + esc(P.tip) + '</i>' : '') + '</p>' +
          '<p><b>Movement</b><br>' + P.move.map(function (i) { return esc(i.text); }).join('<br>') + '</p>' +
          '<p><b>Heal</b><br>' + P.heal.map(function (i) { return esc(i.text); }).join('<br>') + '</p></div></li>';
      }
      return h + '</ul>';
    }

    var openDay = null;
    function renderArc() {
      var A = arc(), full = 0, part = 0;
      for (var d = 1; d <= A.n; d++) { var D = doneOf(A, d); if (D.done >= D.total) full++; else if (D.done) part++; }
      var cur = Math.max(0, Math.min(A.n, A.today)), r = 38, L = 2 * Math.PI * r, pct = full / A.n;
      var h = '<div class="ms-top"><div class="ms-k">' + esc(A.C.emoji || '') + ' ' + esc(A.C.name) + '</div><div class="ms-h">Your <em>healing arc</em></div>' +
        '<div class="ms-sub">' + A.cd + ' cleanse day' + (A.cd === 1 ? '' : 's') + (A.rd ? ', ' + A.rd + ' refeed day' + (A.rd === 1 ? '' : 's') : '') + (A.n - A.cd - A.rd > 0 ? ', then healing days' : '') + '.</div></div>';
      h += '<div class="ms-card"><div class="ms-ring"><svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="' + r + '" fill="none" stroke="#efe8de" stroke-width="9"/>' +
        '<circle cx="46" cy="46" r="' + r + '" fill="none" stroke="#2e5c45" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + L.toFixed(1) + '" stroke-dashoffset="' + (L * (1 - pct)).toFixed(1) + '"/></svg>' +
        '<div><div class="big">' + full + ' <span style="font-size:1.2rem;color:#8a7d71">of ' + A.n + '</span></div><div class="ms-sub">days complete' + (part ? ' · ' + part + ' in progress' : '') + '</div>' +
        '<div class="ms-sub" style="margin-top:4px">' + (A.today < 1 ? 'Starts ' + esc(shortDate(A.start)) : A.today > A.n ? 'Arc finished' : 'You are on day ' + cur) + '</div></div></div>' + dotsHtml(A, cur) +
        '<div class="ms-start" style="margin-top:12px"><span>Start date</span><input type="date" class="ms-startin" value="' + iso(A.start) + '"></div></div>';
      h += '<div class="ms-card" style="padding-bottom:4px">' + daysHtml(A, openDay) + '</div>';
      arcEl.innerHTML = h;
    }

    var PAGES = [['About you', 'A few basics and your cleanse level.'], ['Symptoms', 'Tap everything you have most weeks.'], ['Tests', 'Optional: add blood work or gut tests.']];
    var page = 0;
    function renderMe() {
      var set = isSetUp();
      meTop.innerHTML = '<div class="ms-top" style="padding-bottom:10px"><div class="ms-k">' + (set ? 'Your details' : 'Set up · 1 minute') + '</div><div class="ms-h">' + (set ? 'About <em>you</em>' : 'Let\'s build your <em>plan</em>') + '</div></div>' +
        '<div class="ms-pages">' + PAGES.map(function (p, i) { return '<button type="button" data-page="' + i + '" class="' + (i === page ? 'on' : '') + '"><i>' + (i + 1) + '</i>' + p[0] + '</button>'; }).join('') + '</div>' +
        '<div class="ms-sub" style="padding:0 4px 10px">' + esc(PAGES[page][1]) + '</div>';
      var A = arc();
      meBot.innerHTML = '<div class="ms-swipe">Swipe sideways for the next page</div><div class="ms-meact">' +
        (set ? '<button type="button" class="ms-btn" data-act="gen">Update my plan</button>'
             : '<button type="button" class="ms-btn" data-act="next">' + (page < 2 ? 'Next' : 'Build my plan') + '</button>' + (page ? '<button type="button" class="ms-btn ghost" data-act="back">Back</button>' : '')) + '</div>' +
        (set ? '<div class="ms-plan"><div class="ms-top" style="padding-top:4px"><div class="ms-k">Your 7-day plan</div><div class="ms-h" style="font-size:1.7rem">' + esc(A.C.emoji || '') + ' ' + esc(A.C.name) + '</div>' +
          '<div class="ms-sub">Tap a day to see everything in it.</div></div><div class="ms-card" style="padding-bottom:4px">' + daysHtml(A, openDay) + '</div></div>' +
          '<div class="ms-foot"><button type="button" data-act="full">Show the full software</button></div>' : '');
    }
    function pageEls() { return [grid.querySelector('.hc-intake'), grid.querySelector('.gs-panel'), grid.querySelector('.lab-panel')]; }
    function fit() { var el = pageEls()[page]; if (el && root.getAttribute('data-mth-tab') === 'me') grid.style.height = (el.offsetHeight + 8) + 'px'; }
    function goPage(i, smooth) {
      page = Math.max(0, Math.min(2, i)); var el = pageEls()[page];
      if (el) grid.scrollTo({ left: el.offsetLeft - grid.offsetLeft - 12, behavior: smooth ? 'smooth' : 'auto' });
      fit(); renderMe();
    }
    try { var ro = new ResizeObserver(function () { fit(); }); pageEls().forEach(function (el) { if (el) ro.observe(el); }); } catch (e) {}
    var st0 = 0;
    grid.addEventListener('scroll', function () {
      clearTimeout(st0); st0 = setTimeout(function () {
        var els = pageEls(), best = 0, bd = 1e9, mx = grid.scrollLeft + grid.clientWidth / 2;
        els.forEach(function (el, i) { if (!el) return; var c = el.offsetLeft - grid.offsetLeft + el.offsetWidth / 2, dd = Math.abs(c - mx); if (dd < bd) { bd = dd; best = i; } });
        if (best !== page) { page = best; renderMe(); } fit();
      }, 90);
    }, { passive: true });

    function startToday() {
      var inp = document.getElementById('caStartIn'), v = iso(new Date());
      if (inp) { inp.value = v; inp.dispatchEvent(new Event('change', { bubbles: true })); }
      else { try { window._caStart = mid(new Date()); } catch (e) {} }
      renderAll();
    }
    function setStart(v) {
      var inp = document.getElementById('caStartIn');
      if (inp) { inp.value = v; inp.dispatchEvent(new Event('change', { bubbles: true })); }
      else { var p = v.split('-').map(Number); try { window._caStart = new Date(p[0], p[1] - 1, p[2]); } catch (e) {} }
      renderAll();
    }

    document.addEventListener('click', function (e) {
      var it = e.target.closest('.ms-it');
      if (it && !it.disabled) { var A = arc(), on = !it.classList.contains('on'); setTick(A, +it.dataset.d, it.dataset.id, on); renderToday(); return; }
      var db = e.target.closest('.ms-dayb'); if (db) { var dd = +db.dataset.day; openDay = openDay === dd ? null : dd; renderArc(); renderMe(); return; }
      var pg = e.target.closest('.ms-pages button'); if (pg) { goPage(+pg.dataset.page, true); return; }
      var act = e.target.closest('[data-act]'); if (!act) return;
      var a = act.dataset.act;
      if (a === 'startnow') startToday();
      else if (a === 'next') { if (page < 2) goPage(page + 1, true); else { justGenerated = true; genBtn.click(); setTimeout(planReady, 400); } }
      else if (a === 'back') goPage(page - 1, true);
      else if (a === 'gen') { genBtn.click(); setTimeout(function () { renderAll(); show('today', true); }, 450); }
      else if (a === 'full') { try { localStorage.setItem(VIEW_KEY, 'desktop'); } catch (er) {} location.reload(); }
    });
    document.addEventListener('change', function (e) { if (e.target.classList && e.target.classList.contains('ms-startin') && e.target.value) setStart(e.target.value); });

    function renderAll() { renderToday(); renderArc(); renderMe(); }

    /* the plan can appear by pressing Build, or a moment after opening when it is restored from the member's account */
    var justGenerated = false;
    function planReady() {
      if (!isSetUp()) return;
      var wasSetup = root.classList.contains('mth-setup') || root.classList.contains('mth-wait');
      root.classList.remove('mth-setup', 'mth-wait');
      if (wasSetup) page = 0;
      renderAll();
      if (wasSetup || justGenerated) show('today', true);
      justGenerated = false;
    }
    try { new MutationObserver(function () { if (isSetUp()) planReady(); }).observe(genBtn, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}

    function show(tab, scroll) {
      root.setAttribute('data-mth-tab', tab);
      var bs = bar.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-selected', bs[i].dataset.tab === tab ? 'true' : 'false');
      if (tab === 'today') renderToday(); else if (tab === 'arc') renderArc(); else { renderMe(); requestAnimationFrame(function () { goPage(page, false); }); }
      try { sessionStorage.setItem(TAB_KEY, tab); } catch (e) {}
      if (scroll) toTop();
      setTimeout(placeBar, 60);
    }
    function toTop() {
      try { window.scrollTo(0, 0); } catch (e) {}
      try { if (window.frameElement) window.frameElement.scrollIntoView({ block: 'start' }); } catch (e) {}
    }
    /* Some course players stretch the frame to the full page height; then the bar goes at the top instead */
    function placeBar() {
      var stretched = window.top !== window && window.innerHeight > (screen.height || 900) + 120;
      if (stretched !== root.classList.contains('mth-bar-inline')) {
        root.classList.toggle('mth-bar-inline', stretched);
        if (stretched) card.insertBefore(bar, card.firstChild); else document.body.appendChild(bar);
      }
    }
    document.body.appendChild(bar);
    placeBar();
    window.addEventListener('resize', function () { clearTimeout(placeBar.t); placeBar.t = setTimeout(placeBar, 200); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderAll(); });

    function startSetup() {
      root.classList.remove('mth-wait');
      if (isSetUp()) return;
      root.classList.add('mth-setup');
      show('me', false);
      goPage(0, false);
    }
    if (isSetUp()) {
      var last = null; try { last = sessionStorage.getItem(TAB_KEY); } catch (e) {}
      show(last && /^(today|arc|me)$/.test(last) ? last : 'today', false);
    } else {
      root.classList.add('mth-wait');
      show('today', false);
      setTimeout(startSetup, 3500);
    }
  });
})();
