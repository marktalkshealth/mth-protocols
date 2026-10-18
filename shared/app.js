/* =================================================================
   MARK TALKS HEALTH — SHARED PHONE APP LAYOUT
   Used by the Gut Health, Blood Sugar and GLP-1 protocol apps.
   On phones and tablets the protocol turns into an app:
   bottom tabs (Today · Plan · Progress · Me), one screen at a time,
   a step-by-step first setup, and compact sizing.
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

  /* ---------- styles ---------- */
  var css = `
html.mth-app { -webkit-text-size-adjust: 100%; }
html.mth-app body { padding-bottom: calc(92px + env(safe-area-inset-bottom)) !important; }
html.mth-app.mth-bar-inline body { padding-bottom: 24px !important; }
html.mth-app .fx-fab, html.mth-app .hc-cap { display: none !important; }

/* compact sizing: undo the desktop-sized headings */
html.mth-app .di-outer { padding: 8px 8px 0 !important; max-width: 720px !important; margin: 0 auto !important; }
html.mth-app .ca-outer, html.mth-app #main { max-width: 704px !important; margin-left: auto !important; margin-right: auto !important; }
html.mth-app .hc-grid3, html.mth-app .hc-below { grid-template-columns: 1fr !important; }
html.mth-app .hc-card { padding: 8px !important; border-radius: 16px !important; background: transparent !important; border: 0 !important; box-shadow: none !important; }
html.mth-app .hc-head { padding: 2px 4px 10px !important; align-items: center !important; }
html.mth-app .hc-title { font-size: 1.45rem !important; }
html.mth-app .di-panel { padding: 14px !important; border-radius: 14px !important; }
html.mth-app .di-title { font-size: 1.3rem !important; margin-bottom: 10px !important; }
html.mth-app .fx-outer { padding: 0 !important; margin: 0 !important; max-width: none !important; }
html.mth-app .ca-outer { padding: 0 8px !important; }
html.mth-app #main { padding-left: 8px !important; padding-right: 8px !important; }
html.mth-app .fx-card { padding: 14px 12px !important; border-radius: 14px !important; }
html.mth-app .fx-title { font-size: 1.55rem !important; }
html.mth-app .chart-card { padding: 16px 14px !important; margin-bottom: 12px !important; border-radius: 14px !important; }
html.mth-app .synth-card { padding: 16px 14px !important; }
html.mth-app .hero h1 { font-size: 1.6rem !important; }
html.mth-app .cal-section-title, html.mth-app .ca-title { font-size: 1.45rem !important; }
html.mth-app .chart-title, html.mth-app .synth-title { font-size: 1.3rem !important; }
html.mth-app .ca-day-title { font-size: 1.35rem !important; }
html.mth-app .ca-phase-name, html.mth-app .card-title, html.mth-app .pp-part-name { font-size: 1.2rem !important; }
html.mth-app .tests-card-title, html.mth-app .supp-title { font-size: 1.15rem !important; }
html.mth-app .juice-day-title, html.mth-app .meal-day-title, html.mth-app .ex-day-name { font-size: 1.15rem !important; }
html.mth-app .hc-below { margin-top: 0 !important; gap: 10px !important; }
html.mth-app .hc-head { flex-wrap: nowrap !important; justify-content: space-between !important; }
html.mth-app .hc-title { font-size: 1.3rem !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
html.mth-app .gp-sync { font-size: .68rem !important; padding: 3px 9px !important; flex: none; }

/* Today: straight to the day */
html.mth-app #fx > div:first-child .fx-kicker, html.mth-app .fx-lede { display: none !important; }
html.mth-app .fx-title { font-size: 1.4rem !important; line-height: 1.15 !important; margin-top: 0 !important; }
html.mth-app .fx-tools { margin-top: 8px; }
html.mth-app .fx-strip { padding-top: 8px !important; }
html.mth-app .fx-tabs { gap: 4px !important; padding: 4px !important; border-radius: 14px !important; margin: 4px 0 12px !important; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)) !important; }
html.mth-app .fx-tabs button { display: flex !important; flex-direction: column; align-items: center; text-align: center; gap: 3px; padding: 8px 4px !important;
  font-family: 'DM Sans', system-ui, sans-serif !important; font-size: .8rem !important; font-weight: 600; line-height: 1.15 !important; border-radius: 11px !important; }
html.mth-app .fx-tabs button .n { width: 22px !important; height: 22px !important; font-size: .85rem !important; }
html.mth-app .fx-tabs button small { font-size: .62rem !important; font-weight: 400; }

/* Plan: skip the long explainer under the healing dial */
html.mth-app #diMasterNote { display: none !important; }

/* one screen at a time */
html.mth-app .hc-intake, html.mth-app .hc-mid, html.mth-app .hc-heal, html.mth-app .hc-below,
html.mth-app #fastingArcContainer, html.mth-app .fx-outer, html.mth-app #fx, html.mth-app #fxOverview,
html.mth-app .ca-outer, html.mth-app #main { display: none !important; }

/* Today, Meals and Exercise are the three parts of the daily plan */
html.mth-app[data-mth-tab="today"] .fx-outer, html.mth-app[data-mth-tab="today"] #fx,
html.mth-app[data-mth-tab="meals"] .fx-outer, html.mth-app[data-mth-tab="meals"] #fx,
html.mth-app[data-mth-tab="move"] .fx-outer, html.mth-app[data-mth-tab="move"] #fx { display: block !important; }
html.mth-app #fx > .fx-tabs { display: none !important; }
html.mth-app:not([data-mth-tab="meals"]) #fx .fx-tools { display: none !important; }

html.mth-app[data-mth-tab="progress"] .hc-intake { display: flex !important; }
html.mth-app[data-mth-tab="progress"] .hc-intake .di-panel > :not(.di-metrics-section-title):not(.di-metrics-grid) { display: none !important; }
html.mth-app[data-mth-tab="progress"] .hc-intake .di-metrics-section-title { margin-top: 0 !important; }
html.mth-app[data-mth-tab="progress"] .hc-below { display: block !important; }
html.mth-app[data-mth-tab="progress"] .hc-below > * + * { margin-top: 10px; }
html.mth-app[data-mth-tab="progress"] .ca-outer,
html.mth-app[data-mth-tab="progress"] #main,
html.mth-app[data-mth-tab="progress"] #fastingArcContainer,
html.mth-app[data-mth-tab="progress"] .fx-outer,
html.mth-app[data-mth-tab="progress"] #fxOverview { display: block !important; }
html.mth-app[data-mth-tab="progress"] #fxOverview { margin-top: 10px; }
html.mth-app[data-mth-tab="progress"] .ca-outer { margin-top: 10px !important; }

html.mth-app[data-mth-tab="me"] .hc-intake, html.mth-app[data-mth-tab="me"] .hc-mid, html.mth-app[data-mth-tab="me"]:not(.mth-setup) .hc-heal { display: flex !important; }
html.mth-app[data-mth-tab="me"] .hc-intake .di-metrics-section-title,
html.mth-app[data-mth-tab="me"] .hc-intake .di-metrics-grid { display: none !important; }

/* first visit: set up one step at a time */
html.mth-app.mth-setup .mth-bar { display: none !important; }
html.mth-app.mth-setup body { padding-bottom: 24px !important; }
html.mth-app.mth-setup .hc-intake .di-panel > .di-title,
html.mth-app.mth-setup #diGenBtn, html.mth-app.mth-setup #diGenHint { display: none !important; }
html.mth-app.mth-setup[data-mth-step="1"] .hc-mid { display: none !important; }
html.mth-app.mth-setup[data-mth-step="2"] .hc-intake,
html.mth-app.mth-setup[data-mth-step="2"] .lab-panel,
html.mth-app.mth-setup[data-mth-step="3"] .hc-intake,
html.mth-app.mth-setup[data-mth-step="3"] .gs-panel { display: none !important; }
html.mth-app.mth-setup .gs-step { display: none !important; }

.mth-wiz { display: none; }
html.mth-app.mth-setup .mth-wiz { display: block; padding: 4px 4px 12px; }
.mth-wiz-dots { display: flex; gap: 6px; margin-bottom: 10px; }
.mth-wiz-dots i { flex: 1; height: 4px; border-radius: 4px; background: #e6ded3; }
.mth-wiz-dots i.on { background: #2e5c45; }
.mth-wiz-step { font: 700 .66rem/1.2 'DM Sans', system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #2e5c45; }
.mth-wiz-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.6rem; line-height: 1.1; color: #2b2622; margin-top: 2px; }
.mth-wiz-sub { font: 400 .82rem/1.45 'DM Sans', system-ui, sans-serif; color: #8a7d71; margin-top: 4px; }
.mth-wiz-nav { display: none; }
html.mth-app.mth-setup .mth-wiz-nav { display: flex; gap: 10px; padding: 14px 4px 6px; }
.mth-wiz-nav button { flex: 1; min-height: 50px; border-radius: 14px; font: 600 .95rem/1 'DM Sans', system-ui, sans-serif; cursor: pointer; }
.mth-wiz-back { background: transparent; border: 1px solid #ddd3c6; color: #2b2622; flex: 0 0 34% !important; }
.mth-wiz-next { background: #1e2820; border: 0; color: #fff; }
.mth-wiz-back[hidden] { display: none; }

/* bottom tab bar */
.mth-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 960; display: flex; justify-content: space-around;
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom)); background: rgba(251,248,243,.96);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border-top: 1px solid #e7dfd4; }
.mth-bar button { flex: 1; max-width: 120px; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0 4px;
  border: 0; background: none; color: #9a8f84; font: 600 .68rem/1 'DM Sans', system-ui, sans-serif; letter-spacing: .02em; cursor: pointer;
  -webkit-tap-highlight-color: transparent; }
.mth-bar button svg { width: 24px; height: 24px; }
.mth-bar button[aria-selected="true"] { color: #2e5c45; }
.mth-bar button[aria-selected="true"] .mth-pip { opacity: 1; }
.mth-pip { width: 18px; height: 3px; border-radius: 3px; background: #2e5c45; opacity: 0; margin-top: 1px; }
.mth-bar { justify-content: center; gap: 4px; }
@media (max-height: 500px) {
  html.mth-app body { padding-bottom: calc(62px + env(safe-area-inset-bottom)) !important; }
  .mth-bar { padding-top: 4px; padding-bottom: calc(4px + env(safe-area-inset-bottom)); }
  .mth-bar button { flex-direction: row; justify-content: center; gap: 7px; max-width: 150px; font-size: .78rem; padding: 8px 0; }
  .mth-bar button svg { width: 20px; height: 20px; }
  .mth-pip { display: none; }
}
html.mth-app.mth-bar-inline .mth-bar { position: static; border: 1px solid #e7dfd4; border-radius: 16px; margin: 0 8px 10px; padding: 4px; }

/* waiting for a saved plan */
html.mth-app.mth-wait .di-outer, html.mth-app.mth-wait .ca-outer, html.mth-app.mth-wait #main, html.mth-app.mth-wait .mth-bar { visibility: hidden !important; }
html.mth-app.mth-wait body::after { content: 'Opening your plan…'; position: fixed; left: 0; right: 0; top: 40%; text-align: center;
  font: 400 1.35rem 'Cormorant Garamond', Georgia, serif; color: #8a7d71; }

/* inside the /app page the site shows its own header with the protocol name */
html.mth-app.mth-standalone .hc-head { display: none !important; }
html.mth-app.mth-standalone .di-outer { padding-top: 10px !important; }

.mth-me-foot { display: none; }
html.mth-app[data-mth-tab="me"]:not(.mth-setup) .mth-me-foot { display: block; text-align: center; padding: 18px 0 8px; }
.mth-me-foot button { background: none; border: 0; color: #8a7d71; font: 500 .8rem 'DM Sans', system-ui, sans-serif; text-decoration: underline; cursor: pointer; }
`;
  var st = document.createElement('style'); st.id = 'mth-app-styles'; st.textContent = css;
  (document.head || root).appendChild(st);

  var ICONS = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
    meals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10"/><path d="M17 21V3c-2.2 1-3.5 3.6-3.5 7v3H17"/></svg>',
    move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
    progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5h16"/><path d="M6.5 16v-4M11 16V8M15.5 16v-6M20 16V5"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.7 4-5.6 7.5-5.6s6.3 1.9 7.5 5.6"/></svg>'
  };
  var TABS = [['today', 'Today'], ['meals', 'Meals'], ['move', 'Exercise'], ['progress', 'Progress'], ['me', 'Me']];
  var INNER = { today: 'prac', meals: 'eat', move: 'move' };   /* bottom tab -> daily plan section */
  var STEPS = [
    ['About you', 'A few basics so your plan fits your body.'],
    ['Your symptoms', 'Tap everything you have most weeks for a month or more.'],
    ['Test results', 'Optional. Add any blood work or gut tests you have, or skip this step.']
  ];
  var TAB_KEY = 'mth_app_tab';

  ready(function () {
    var genBtn = document.getElementById('diGenBtn');
    var card = document.querySelector('.hc-card');
    var grid = document.querySelector('.hc-grid3');
    if (!genBtn || !card || !grid) return;   /* not a protocol app page */

    function isSetUp() { return !genBtn.classList.contains('di-pending'); }

    /* --- tab bar --- */
    var syncing = false;
    var bar = document.createElement('nav');
    bar.className = 'mth-bar'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Protocol sections');
    bar.innerHTML = TABS.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="false">' + ICONS[t[0]] + '<span>' + t[1] + '</span><span class="mth-pip"></span></button>';
    }).join('');
    bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (b) show(b.dataset.tab, true); });

    /* --- set-up steps --- */
    var wiz = document.createElement('div');
    wiz.className = 'mth-wiz';
    wiz.innerHTML = '<div class="mth-wiz-dots"><i></i><i></i><i></i></div><div class="mth-wiz-step"></div><div class="mth-wiz-title"></div><div class="mth-wiz-sub"></div>';
    var nav = document.createElement('div');
    nav.className = 'mth-wiz-nav';
    nav.innerHTML = '<button type="button" class="mth-wiz-back">Back</button><button type="button" class="mth-wiz-next">Next</button>';
    card.insertBefore(wiz, grid);
    grid.parentNode.insertBefore(nav, grid.nextSibling);

    var foot = document.createElement('div');
    foot.className = 'mth-me-foot';
    foot.innerHTML = '<button type="button">Show the full page layout</button>';
    foot.firstChild.onclick = function () { try { localStorage.setItem(VIEW_KEY, 'desktop'); } catch (e) {} location.reload(); };
    nav.parentNode.insertBefore(foot, nav.nextSibling);

    var step = 1;
    function setStep(n) {
      step = n; root.setAttribute('data-mth-step', String(n));
      var dots = wiz.querySelectorAll('.mth-wiz-dots i');
      for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i < n);
      wiz.querySelector('.mth-wiz-step').textContent = 'Step ' + n + ' of 3';
      wiz.querySelector('.mth-wiz-title').textContent = STEPS[n - 1][0];
      wiz.querySelector('.mth-wiz-sub').textContent = STEPS[n - 1][1];
      nav.querySelector('.mth-wiz-back').hidden = n === 1;
      nav.querySelector('.mth-wiz-next').textContent = n === 3 ? 'Build my plan' : 'Next';
      toTop();
    }
    nav.querySelector('.mth-wiz-back').onclick = function () { if (step > 1) setStep(step - 1); };
    nav.querySelector('.mth-wiz-next').onclick = function () { if (step < 3) setStep(step + 1); else genBtn.click(); };

    /* the plan can appear by pressing Generate, or a moment after opening when it is
       restored from the member's account: either way, leave set-up and go to Today */
    function planReady() {
      if (!isSetUp()) return;
      var wasSetup = root.classList.contains('mth-setup') || root.classList.contains('mth-wait');
      root.classList.remove('mth-setup', 'mth-wait');
      if (wasSetup || justGenerated) show('today', true);
      justGenerated = false;
    }
    var justGenerated = false;
    genBtn.addEventListener('click', function () { justGenerated = true; setTimeout(planReady, 350); });
    try { new MutationObserver(function () { if (isSetUp()) planReady(); }).observe(genBtn, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}

    function show(tab, scroll) {
      root.setAttribute('data-mth-tab', tab);
      var bs = bar.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-selected', bs[i].dataset.tab === tab ? 'true' : 'false');
      if (tab === 'progress') { var ov = document.getElementById('fxOverview'); if (ov) ov.open = true; }
      if (INNER[tab]) {
        var ib = document.querySelector('#fx > .fx-tabs button[data-tab="' + INNER[tab] + '"]');
        if (ib && ib.getAttribute('aria-selected') !== 'true') { syncing = true; ib.click(); syncing = false; }
      }
      try { sessionStorage.setItem(TAB_KEY, tab); } catch (e) {}
      if (scroll) toTop();
      setTimeout(placeBar, 60);
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}   /* let charts redraw at their new size */
    }

    function toTop() {
      try { window.scrollTo(0, 0); } catch (e) {}
      try { if (window.frameElement) window.frameElement.scrollIntoView({ block: 'start' }); } catch (e) {}
    }

    /* Some course players stretch the frame to the full page height; a bar pinned to the
       bottom would then sit far below the screen, so put it at the top instead. */
    function placeBar() {
      var stretched = window.top !== window && window.innerHeight > (screen.height || 900) + 120;
      if (stretched !== root.classList.contains('mth-bar-inline')) {
        root.classList.toggle('mth-bar-inline', stretched);
        if (stretched) card.insertBefore(bar, wiz); else document.body.appendChild(bar);
      }
    }

    document.body.appendChild(bar);
    placeBar();
    var fxEl = document.getElementById('fx');
    if (fxEl) try { new MutationObserver(function () {
      if (syncing) return;
      var cur = root.getAttribute('data-mth-tab'); if (!INNER[cur]) return;
      var sb = fxEl.querySelector(':scope > .fx-tabs button[aria-selected="true"]'); if (!sb) return;
      for (var k in INNER) if (INNER[k] === sb.dataset.tab && k !== cur) {
        root.setAttribute('data-mth-tab', k);
        var bs = bar.querySelectorAll('button');
        for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-selected', bs[i].dataset.tab === k ? 'true' : 'false');
        try { sessionStorage.setItem(TAB_KEY, k); } catch (e) {}
      }
    }).observe(fxEl, { childList: true }); } catch (e) {}
    window.addEventListener('resize', function () { clearTimeout(placeBar.t); placeBar.t = setTimeout(placeBar, 200); });

    function startSetup() {
      root.classList.remove('mth-wait');
      if (isSetUp()) return;
      root.classList.add('mth-setup');
      show('me', false);
      setStep(1);
    }
    if (isSetUp()) {
      var last = null; try { last = sessionStorage.getItem(TAB_KEY); } catch (e) {}
      show(last && /^(today|meals|move|progress|me)$/.test(last) ? last : 'today', false);
    } else {
      /* give a saved plan a moment to come back from the member's account before offering set-up */
      root.classList.add('mth-wait');
      show('today', false);
      setTimeout(startSetup, 3500);
    }
  });
})();
