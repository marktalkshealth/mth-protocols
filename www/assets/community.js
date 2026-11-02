/* =================================================================
   COMMUNITY — the members' home feed (replaces the Healing Hub page).
   Pass 1: the shell. Layout, cards and navigation are real; posting,
   comments and the Companion chat come in later passes.

   TO REARRANGE THE FEED: change the order of FEED below.
   Each name is one card type, drawn by the matching function in CARDS.
   ================================================================= */
(function () {
  var FEED = ["today", "companion", "live", "member", "picks", "journal"];
  var STORIES = ["day", "live", "piano", "member1", "member2"];

  var M = window.MTH, esc = M.esc;
  var DEMO = /[?&]demo=1\b/.test(location.search);
  var ctx = {}; /* who is looking: filled in start() */

  /* ---------- icons (stroke, follow the text colour) ---------- */
  var I = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    today: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    live: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>',
    shop: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    book: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    course: '<path d="M4 5h16v11H4zM8 20h8M12 16v4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="M8 5l12 7-12 7z"/>'
  };
  function ic(n, extra) { return '<svg viewBox="0 0 24 24" aria-hidden="true" ' + (extra || "") + '>' + I[n] + '</svg>'; }
  function av(init, cls) { return '<span class="cm-av ' + (cls || "") + '" aria-hidden="true">' + esc(init) + '</span>'; }

  /* ---------- today's habits (shell: kept on this device until the app is wired in) ---------- */
  var HAB_KEY = "mth_cm_habits_" + new Date().toISOString().slice(0, 10);
  var HABITS = [
    { id: "a", label: "Morning juice + 10 min meditation", sub: "Fasting & Cleanse" },
    { id: "b", label: "Three lines in your journal", sub: "Meditation & Journaling" },
    { id: "c", label: "Lunch walk outside, 15 min", sub: "Nature: forest + sun" }
  ];
  function habGet() { try { return JSON.parse(localStorage.getItem(HAB_KEY) || "null") || (DEMO ? { a: 1, b: 1 } : {}); } catch (e) { return {}; } }
  function habSet(v) { try { localStorage.setItem(HAB_KEY, JSON.stringify(v)); } catch (e) {} }

  /* ---------- feed cards ---------- */
  var CARDS = {
    today: function () {
      var done = habGet(), n = HABITS.filter(function (h) { return done[h.id]; }).length;
      return '<article class="cm-card cm-today" id="today">' +
        '<div class="cm-row"><span class="cm-kick">Today · pinned for you</span><span class="cm-meta" id="cmTodayN">' + n + ' of ' + HABITS.length + ' done</span></div>' +
        '<h2 class="cm-h">' + esc(ctx.dayTitle) + '</h2>' +
        '<div class="cm-habits">' + HABITS.map(function (h) {
          var on = !!done[h.id];
          return '<button type="button" class="cm-hab' + (on ? " on" : "") + '" data-hab="' + h.id + '" aria-pressed="' + on + '">' +
            '<span class="box">' + ic("check") + '</span><span><b>' + esc(h.label) + '</b><small>' + esc(h.sub) + '</small></span></button>';
        }).join("") + '</div>' +
        '<div class="cm-links"><a href="' + esc(ctx.app) + '">Open today\'s full plan</a><a href="' + esc(ctx.course) + '">Watch today\'s lesson</a></div></article>';
    },
    companion: function () {
      return '<article class="cm-card cm-dark">' +
        '<span class="cm-kick gold">Healing Companion · evening check-in</span>' +
        '<p class="cm-q">What got in the way of today\'s plan, if anything?</p>' +
        '<form class="cm-ask" id="cmAsk"><label for="cmAskIn" class="cm-sr">Your answer to the Companion</label>' +
        '<input id="cmAskIn" maxlength="500" placeholder="Tell the Companion…" autocomplete="off">' +
        '<button type="submit" aria-label="Send">' + ic("send") + '</button></form>' +
        '<span class="cm-note">Your journal stays private. Only you and the Companion see it.</span></article>';
    },
    live: function () {
      return '<article class="cm-card cm-media">' +
        '<div class="cm-by">' + av("M", "host") + '<span><b>Mark Walker <i class="cm-tag">Host</i></b><small>Live Q&amp;A</small></span></div>' +
        '<p class="cm-p">Every week I answer your questions live. Add yours in the Live room and I\'ll get to as many as I can.</p>' +
        '<a class="cm-video" href="hub-classic.html"><span class="pl">' + ic("play") + '</span><span>Open the Live room</span></a>' +
        '<div class="cm-acts"><button type="button" class="cm-act" data-like>' + ic("heart") + '<span>Like</span></button>' +
        '<a class="cm-act" href="hub-classic.html">' + ic("chat") + '<span>Ask a question</span></a>' +
        '<button type="button" class="cm-act" data-remind>' + ic("bell") + '<span>Remind me</span></button></div></article>';
    },
    member: function () {
      if (!DEMO) return '<article class="cm-card cm-empty"><span class="cm-kick">Members</span><p class="cm-p">Posts from members on the same week as you will show up here. Until then, the conversation lives in the <a href="hub-classic.html">classic Hub</a>.</p></article>';
      return '<article class="cm-card">' +
        '<div class="cm-by">' + av("DL", "sage") + '<span><b>Dana L.</b><small>5h · started the same week as you</small></span></div>' +
        '<p class="cm-p">Day 5 done. Took my walk in the woods behind the school and actually slept through the night for the first time in months.</p>' +
        '<span class="cm-badge">Finished Day 5 · Music &amp; Spirituality</span>' +
        '<div class="cm-acts"><button type="button" class="cm-act" data-like>' + ic("heart") + '<span>Cheer</span></button>' +
        '<button type="button" class="cm-act">' + ic("chat") + '<span>Comment</span></button></div></article>';
    },
    picks: function () {
      var P = window.MTH_PICKS, list = [];
      if (P && P.sections) P.sections.forEach(function (s) { s.picks.forEach(function (p) { if (list.length < 2) list.push(p); }); });
      if (!list.length) return "";
      return '<article class="cm-card">' +
        '<div class="cm-row"><span class="cm-kick">Mark\'s picks</span><span class="cm-meta">Sponsored links</span></div>' +
        list.map(function (p) {
          return '<a class="cm-pick" href="' + esc(P.link(p)) + '" target="_blank" rel="noopener sponsored">' +
            '<span class="ph">' + ic("shop") + '</span><span><b>' + esc(p.name) + '</b><small>' + esc(p.why) + '</small></span></a>';
        }).join("") +
        '<a class="cm-more" href="picks.html">See all my picks</a>' +
        '<span class="cm-note">As an Amazon Associate I earn from qualifying purchases.</span></article>';
    },
    journal: function () {
      return '<article class="cm-card cm-book">' +
        '<span class="cover">The Healing Journal</span>' +
        '<span><b>Write it down with pen and paper</b><small>The printed companion to your 7-day arc, with a page for every day.</small>' +
        '<a href="picks.html">See the journal</a></span></article>';
    }
  };

  /* ---------- stories row ---------- */
  /* photos: on the live site they're in /media/site/, in the test preview they're in ../site/ */
  var IMG = /githack|githubusercontent|^localhost$|^127\./.test(location.hostname) ? "../site/" : "/media/site/";
  function photo(file) { return (/^steps\//.test(file) ? ' data-crop' : '') + ' style="background-image:url(\'' + IMG + file + '\')"'; }
  var STORY = {
    day: function () { return '<a class="cm-story" href="#today"' + photo("steps/7-nature.jpg") + '><span class="k">Your day</span><span><b class="big">' + esc(ctx.dayNum) + '</b><b>' + esc(ctx.dayName) + '</b></span></a>'; },
    live: function () { return '<a class="cm-story" href="hub-classic.html"' + photo("mark-kitchen.jpg") + '><span class="pill">LIVE</span><b>Weekly Q&amp;A with Mark</b></a>'; },
    piano: function () { return '<a class="cm-story" href="hub-classic.html"' + photo("steps/5-music.jpg") + '>' + ic("music") + '<b>Healing Piano · today\'s track</b></a>'; },
    member1: function () { return DEMO ? '<a class="cm-story" href="#m"' + photo("steps/2-meditation.jpg") + '><span class="ring">DL</span><b>Dana · morning meditation</b></a>' : ""; },
    member2: function () { return DEMO ? '<a class="cm-story" href="#m"' + photo("steps/1-fasting.jpg") + '><span class="ring g">TB</span><b>Tom · first juice day</b></a>' : ""; }
  };

  /* ---------- frame: top bar, side menu, right rail, bottom tabs ---------- */
  function topbar() { return window.MTHNav.top("home", { initial: ctx.initial }); }
  function side() {
    var L = [
      ["account.html", av(ctx.initial, "me"), esc(ctx.name)],
      ["#companion", '<span class="cm-si dark">' + ic("chat") + '</span>', "Healing Companion"],
      [ctx.app, '<span class="cm-si sage">' + ic("today") + '</span>', "Today's plan"],
      [ctx.course, '<span class="cm-si terra">' + ic("course") + '</span>', "My course: " + esc(ctx.short)],
      ["hub-classic.html", '<span class="cm-si">' + ic("book") + '</span>', "My journal"],
      ["hub-classic.html", '<span class="cm-si sage">' + ic("music") + '</span>', "Healing Piano + tracks"],
      ["picks.html", '<span class="cm-si">' + ic("shop") + '</span>', "Mark's picks"]
    ];
    return '<aside class="cm-side" aria-label="Your shortcuts">' + L.map(function (l) {
      return '<a href="' + esc(l[0]) + '">' + l[1] + '<span>' + l[2] + '</span></a>';
    }).join("") + '<hr><span class="cm-sh">Rooms</span>' +
      ["Gut Health", "Diabetes", "GLP-1", "Wins & check-ins"].map(function (r) { return '<a href="hub-classic.html" class="room"><span>' + esc(r) + '</span></a>'; }).join("") +
      '</aside>';
  }
  function rail() {
    return '<aside class="cm-rail" aria-label="This week">' +
      '<section class="cm-card"><span class="cm-kick">Live this week</span>' +
      '<div class="cm-when"><span class="cal"><small>Weekly</small><b>Q&amp;A</b></span><span><b>Live with Mark</b><small>Times are posted in the Live room</small></span></div>' +
      '<a class="b ghost full" href="hub-classic.html">Open the Live room</a></section>' +
      '<section class="cm-card"><span class="cm-kick">Started the same week</span>' +
      (DEMO ? '<p class="cm-p sm">9 others began their arc this week. 6 checked in today.</p><div class="cm-faces">' + av("DL", "sage") + av("TB", "gold") + av("AK", "terra") + av("SP", "sage") + av("+5", "sand") + '</div>'
            : '<p class="cm-p sm">When others start the same week as you, you\'ll see them here.</p>') +
      '</section></aside>';
  }

  function render() {
    var root = document.getElementById("cm");
    var composer = '<section class="cm-card cm-compose">' + av(ctx.initial, "me") +
      '<label for="cmPost" class="cm-sr">Write a post</label>' +
      '<input id="cmPost" placeholder="How is your healing going today' + (ctx.first ? ", " + esc(ctx.first) : "") + '?" autocomplete="off">' +
      '<button type="button" class="cm-cbtn sage" aria-label="Add a photo">' + ic("photo") + '<span>Photo</span></button></section>';
    var stories = '<section class="cm-stories" aria-label="Today at a glance">' + STORIES.map(function (k) { return STORY[k](); }).join("") + '</section>';
    root.innerHTML = topbar() +
      (DEMO ? '<div class="cm-demo">Preview with example members and posts. Real members see their own plan.</div>' : "") +
      '<div class="cm-body">' + side() +
      '<main class="cm-feed" id="feed">' + composer + stories + FEED.map(function (k) { return CARDS[k] ? CARDS[k]() : ""; }).join("") + '</main>' +
      rail() + '</div>' +
      window.MTHNav.bottom("home");
    wire();
  }

  function wire() {
    var root = document.getElementById("cm");
    root.addEventListener("click", function (e) {
      var h = e.target.closest("[data-hab]");
      if (h) {
        var v = habGet(), id = h.getAttribute("data-hab"); v[id] = v[id] ? 0 : 1; habSet(v);
        h.classList.toggle("on", !!v[id]); h.setAttribute("aria-pressed", String(!!v[id]));
        var n = HABITS.filter(function (x) { return v[x.id]; }).length;
        document.getElementById("cmTodayN").textContent = n + " of " + HABITS.length + " done";
        return;
      }
      var lk = e.target.closest("[data-like]");
      if (lk) { lk.classList.toggle("on"); lk.setAttribute("aria-pressed", String(lk.classList.contains("on"))); return; }
      if (e.target.closest("[data-remind]")) { M.toast("Reminders are coming in the next pass."); return; }
      if (e.target.closest(".cm-cbtn") || e.target.id === "cmPost") { if (e.target.id !== "cmPost") M.toast("Posting is coming in the next pass."); }
    });
    var post = document.getElementById("cmPost");
    post.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); M.toast("Posting is coming in the next pass."); } });
    document.getElementById("cmAsk").addEventListener("submit", function (e) {
      e.preventDefault(); var i = document.getElementById("cmAskIn");
      if (!i.value.trim()) return;
      i.value = ""; M.toast("Thanks. The Companion's replies are coming in the next pass.");
    });
  }

  async function start() {
    var P;
    if (DEMO) {
      ctx = { name: "Jordan R.", first: "Jordan", initial: "J" };
      P = M.config.products.gut;
    } else {
      await M.require();
      if (!M.ownsAny()) { location.replace("protocols.html?from=community"); return; }
      var em = (M.user.email || "").toLowerCase(), nm = em.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
      nm = nm ? nm.charAt(0).toUpperCase() + nm.slice(1) : "Member";
      ctx = { name: nm, first: nm.split(" ")[0], initial: nm.charAt(0).toUpperCase() };
      P = M.config.products[M.owns(M.product()) ? M.product() : M.owned[0]];
    }
    P = P || { short: "Gut Health", app: "app.html?p=gut", course: "course.html?p=gut" };
    ctx.short = P.short; ctx.app = P.app; ctx.course = P.course;
    ctx.dayNum = "3"; ctx.dayName = "Light and green"; ctx.dayTitle = "Day 3 · Light and green";
    render();
  }
  start();
})();
