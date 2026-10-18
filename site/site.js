/* =================================================================
   MARK TALKS HEALTH — SITE-WIDE SCRIPT (loaded by LearnWorlds head code)
   Routes:  /home (or /)        → our app-style homepage
            /guthealthprotocol  → interactive funnel above LW checkout
            /course/*           → compact hero + module rail
            /social             → the Healing Hub community
            everywhere          → our footer
================================================================= */
(function(){
  if(window.__MTH_SITE) return; window.__MTH_SITE=1;
  var BASE=(document.currentScript&&document.currentScript.src||"").replace(/site\.js.*$/,"") || "https://marktalkshealth.github.io/mth-protocols/site/";
  var HUB=BASE.replace(/site\/$/,"hub/");
  var H=document.documentElement;
  var path=(location.pathname.replace(/\/+$/,"")||"/").toLowerCase();
  var FUNNELS={"/guthealthprotocol":"funnel-gut.html","/thediabetesprotocol":"funnel-diabetes.html","/glp1-weightloss":"funnel-glp1.html"};
  var ROUTE= (path==="/"||path==="/home")?"home"
           : FUNNELS[path]?"funnel"
           : path==="/courses"?"courses"
           : path.indexOf("/course/")===0?"course"
           : path==="/social"?"social"
           : path==="/app"?"app" : "";
  if(ROUTE) H.classList.add("mth-r-"+ROUTE);
  /* /app: keep the phone's "install app" offer so our Install button can show it */
  var INSTALL=null;
  if(ROUTE==="app"){
    window.addEventListener("beforeinstallprompt",function(e){ e.preventDefault(); INSTALL=e; if(window.__mthInstallReady) window.__mthInstallReady(); });
    window.addEventListener("appinstalled",function(){ INSTALL=null; if(window.__mthInstalled) window.__mthInstalled(); });
  }

  /* visitors who aren't signed in see the sales page (funnel), not the bare course page */
  var SALES={"new-autoimmune":"/guthealthprotocol","autoimmune":"/thediabetesprotocol","total-body-healing":"/glp1-weightloss"};
  var LOGGED_IN=!!(window.MTH_USER&&window.MTH_USER.id&&window.MTH_USER.id.indexOf("{{")<0);
  if(ROUTE==="course"&&!LOGGED_IN){ var cs=path.replace(/^\/course\//,"").split("/")[0]; if(SALES[cs]){ H.style.visibility="hidden"; location.replace(SALES[cs]+location.search); return; } }

  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded",fn); }
  function waitFor(test,fn,ms){ var t0=Date.now(); (function loop(){ var r=null; try{r=test();}catch(e){} if(r) return fn(r); if(Date.now()-t0<(ms||12000)) setTimeout(loop,120); else fn(null); })(); }
  function reveal(){ H.classList.add("mth-ready"); }
  /* insert an HTML fragment and run its scripts */
  function mount(html,target,before){
    var box=document.createElement("div"); box.className="mth-mount"; box.innerHTML=html;
    var scripts=[].slice.call(box.querySelectorAll("script"));
    if(before) target.parentNode.insertBefore(box,target); else target.appendChild(box);
    scripts.forEach(function(old){ var s=document.createElement("script"); if(old.src) s.src=old.src; else s.textContent=old.textContent; old.parentNode.replaceChild(s,old); });
    if(box.querySelector(".mthp[data-proto]")) phone();
    return box;
  }
  /* the five-tab "test drive" phone (home + sales pages) */
  function phone(){
    if(window.MTHPhone){ window.MTHPhone.scan(); return; }
    if(document.getElementById("mthp-js")) return;
    var s=document.createElement("script"); s.id="mthp-js"; s.src=BASE+"phone.js?v=3"; document.head.appendChild(s);
  }
  function load(file){ return fetch(BASE+file,{cache:"no-cache"}).then(function(r){ if(!r.ok) throw new Error(file+" "+r.status); return r.text(); }); }
  function topbar(){ return document.querySelector(".lw-topbar"); }

  /* ---------------- footer ---------------- */
  function footer(){
    if(document.querySelector(".mthf")) return;
    var f=document.createElement("footer"); f.className="mthf";
    f.innerHTML='<div class="w"><div class="brand">Mark Talks Health<small>Natural healing meets modern science. Personalised protocols, guided day by day.</small></div>'+
      '<nav><a href="/home">Home</a><a href="/courses">Protocols</a><a href="/social">Healing Hub</a></nav>'+
      '<div class="fine">Educational content only, not medical advice. Talk to your doctor before starting any fasting or cleansing protocol, especially if you take medication. © '+new Date().getFullYear()+' Mark Talks Health</div></div>';
    var lw=document.querySelector(".lw-footer");
    /* only on normal site pages (they have a LearnWorlds footer); never inside the course player */
    if(lw&&lw.parentNode) lw.parentNode.insertBefore(f,lw.nextSibling);
  }

  /* ---------------- homepage ---------------- */
  function home(){
    load("home.html").then(function(html){
      var tb=topbar(); var anchor=tb&&tb.nextElementSibling;
      if(anchor) mount(html,anchor,true); else mount(html,document.body,false);
      reveal();
    }).catch(function(e){ console.warn("MTH home",e); H.classList.remove("mth-r-home"); reveal(); });
  }

  /* ---------------- funnel ---------------- */
  function isCheckout(sec){ if(/checkout/i.test(sec.getAttribute("data-section-id")||"")||sec.querySelector('[class*="checkout"],[class*="Checkout"]')) return true; var t=(sec.innerText||"").toLowerCase(); return t.indexOf("order summary")>-1||t.indexOf("payment method")>-1; }
  function funnel(){
    var file=FUNNELS[path]; if(!file){ reveal(); return; }
    waitFor(function(){ var s=[].slice.call(document.querySelectorAll(".js-learnworlds-section")); return s.length>1?s:null; },function(secs){
      secs=secs||[];
      var checkout=null;
      secs.forEach(function(s){ if(s.classList.contains("lw-topbar")||s.classList.contains("lw-footer")) return; if(!checkout&&isCheckout(s)) checkout=s; else if(!isCheckout(s)) s.classList.add("mth-old"); });
      load(file).then(function(html){
        var first=secs.filter(function(s){return !s.classList.contains("lw-topbar");})[0]||document.body.firstChild;
        mount(html,first,true); reveal();
        /* checkout header */
        (function head(n){ var co=document.querySelector(".payment-section"); if(!co){ if(n<20) setTimeout(function(){head(n+1);},500); return; } if(co.querySelector(".mth-co-head")) return;
          var h=document.createElement("div"); h.className="mth-co-head"; h.innerHTML='<div class="k">Secure checkout</div><h2>Complete your order</h2><p>Instant access to your course, your personalised software and the Healing Hub.</p><div class="trust"><span>Lifetime access</span><span>30-day guarantee</span><span>Encrypted payment</span></div>';
          var c=co.querySelector(".learnworlds-section-content"); (c||co).insertBefore(h,(c||co).firstChild); })(0);
        /* the checkout renders late: un-hide it whenever it shows up */
        var tries=0; (function recheck(){ secs.forEach(function(s){ if(s.classList.contains("mth-old")&&isCheckout(s)) s.classList.remove("mth-old"); }); if(++tries<20) setTimeout(recheck,500); })();
      }).catch(function(e){ console.warn("MTH funnel",e); secs.forEach(function(s){s.classList.remove("mth-old");}); reveal(); });
    });
  }

  /* ---------------- course page ---------------- */
  var TILES=[["#c0623f","#7e3b25"],["#7a8f6e","#3f4b38"],["#b8924a","#6e5427"],["#8a7b6e","#463b33"],["#a8735a","#5a3a2b"],["#6f7a8c","#363c48"]];
  function txt(el){ return el?(el.textContent||"").replace(/\s+/g," ").trim():""; }
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});};
  /* the 7 healing-step pictures, matched to module names */
  function stepPic(name){ var t=(name||"").toLowerCase();
    if(/^intro|introduction|welcome|start here/.test(t)) return "0-intro";
    if(/fast|cleans/.test(t)) return "1-fasting";
    if(/meditat|journal/.test(t)) return "2-meditation";
    if(/keto|diet|broth|food|nutrition/.test(t)) return "3-keto";
    if(/exercis|cardio|weight|strength|movement/.test(t)) return "4-cardio";
    if(/music|spirit/.test(t)) return "5-music";
    if(/sleep|air/.test(t)) return "6-sleep";
    if(/sun|nature|outdoor/.test(t)) return "7-nature";
    return ""; }
  function course(){
    waitFor(function(){ var c=document.querySelector(".lw-course-contents"); return c&&c.querySelector(".lw-course-contents-chapter")?c:null; },function(contents){
      if(!contents||document.querySelector(".mthc")){ reveal(); return; }
      var chapters=contents.querySelectorAll(".lw-course-contents-chapter");
      var enroll=document.querySelector(".-enroll-btn-wrapper");
      var info=enroll&&enroll.closest(".js-learnworlds-section");
      var title=document.title||"Your course", img="", facts=[], sub="";
      if(info){
        var h=info.querySelector("h1,h2,.learnworlds-heading1,.learnworlds-heading"); if(h&&txt(h)) title=txt(h);
        info.querySelectorAll("*").forEach(function(e){ var b=getComputedStyle(e).backgroundImage; if(!img&&b&&b.indexOf("lwfiles")>-1&&e.offsetWidth>200) img=b; });
        var lines=(info.innerText||"").split("\n").map(function(s){return s.trim();}).filter(Boolean);
        ["Study time","Video time","Level"].forEach(function(lbl){ var i=lines.indexOf(lbl); if(i>-1&&lines[i+1]) facts.push([lbl,lines[i+1]]); });
        var p=[].slice.call(info.querySelectorAll("p,.learnworlds-main-text")).map(txt).filter(function(t){return t.length>40&&!/^Add your/i.test(t);})[0]; if(p) sub=p;
      }
      /* use the course's catalog thumbnail (set in LearnWorlds course settings) over the page-builder picture */
      var CIMG={"new-autoimmune":"6eec355b2cfe342f0ac9f7061029e4e7.png","autoimmune":"fe26b6c96fac54ea10f9208392449ea2.png","total-body-healing":"85077c63e15333e491250e4536f2ee4c.png"};
      var slug=path.replace(/^\/course\//,"").split("/")[0];
      if(CIMG[slug]) img='url("https://api.us-e1.learnworlds.com/imagefile//'+CIMG[slug]+'?client_id=6ac2bb5648140f5f6d8ca00c&width=1000&height=0")';
      var mods=[].map.call(chapters,function(c){
        var units=c.querySelector(".lw-course-contents-units");
        return {num:txt(c.querySelector(".lw-course-chapter-num")),name:txt(c.querySelector(".learnworlds-heading3-small"))||txt(c.querySelector("h3:not(.lw-course-chapter-circle)")),units:units,count:units?units.querySelectorAll(".lw-course-contents-unit").length:0};
      });
      var total=mods.reduce(function(a,m){return a+m.count;},0);
      var wrap=document.createElement("section"); wrap.className="mthc";
      wrap.innerHTML='<div class="w"><div class="hero"><div class="img" style="'+(img?'background-image:'+img.replace(/"/g,"&quot;"):'')+'"></div><div>'+
        '<h1>'+esc(title)+'</h1>'+(sub?'<p class="sub">'+esc(sub)+'</p>':'')+
        '<div class="facts"><span><b>'+mods.length+'</b> modules</span><span><b>'+total+'</b> lessons</span>'+facts.map(function(f){return '<span>'+esc(f[0])+' · <b>'+esc(f[1])+'</b></span>';}).join("")+'</div><div class="cta"></div></div></div>'+
        '<div class="mh"><h2>Your modules</h2><span>Tap a module</span></div><div class="rail"></div><div class="panel"><h3></h3><div class="list"></div></div></div>';
      var rail=wrap.querySelector(".rail"), list=wrap.querySelector(".list"), ph=wrap.querySelector(".panel h3");
      mods.forEach(function(m,i){
        var c=TILES[i%TILES.length], b=document.createElement("button"); b.className="mod"; b.type="button";
        var ph=stepPic(m.name);
        if(ph){ b.className="mod ph"; b.innerHTML='<div class="t" style="background-image:url('+BASE+'steps/'+ph+'.jpg)"><span class="n">'+esc(m.num||String(i+1))+'</span></div><small><b>'+esc(m.name||("Module "+(i+1)))+'</b> · '+m.count+' lesson'+(m.count===1?'':'s')+'</small>'; b.addEventListener("click",function(){ show(i); }); rail.appendChild(b); return; }
        b.innerHTML='<div class="t" style="background:linear-gradient(150deg,'+c[0]+','+c[1]+')"><span class="n">'+esc(m.num||String(i+1))+'</span><span class="nm">'+esc(m.name||("Module "+(i+1)))+'</span></div><small>'+m.count+' lesson'+(m.count===1?'':'s')+'</small>';
        b.addEventListener("click",function(){ show(i); }); rail.appendChild(b);
      });
      function show(i){
        [].forEach.call(rail.children,function(b,j){b.classList.toggle("on",j===i);});
        ph.textContent=mods[i].name||("Module "+(i+1));
        while(list.firstChild) list.removeChild(list.firstChild);
        if(mods[i].units) list.appendChild(mods[i].units); /* moved, so LearnWorlds' own click/lock logic keeps working */
      }
      if(enroll) wrap.querySelector(".cta").appendChild(enroll);
      var anchor=info||contents; anchor.parentNode.insertBefore(wrap,anchor);
      if(info) info.classList.add("mth-hide"); contents.classList.add("mth-hide");
      H.classList.add("mth-course"); show(0); reveal();
    });
  }

  /* ---------------- courses catalog ---------------- */
  function courses(){
    waitFor(function(){ return document.querySelector(".lw-course-card"); },function(card){
      var secs=[].slice.call(document.querySelectorAll(".js-learnworlds-section"));
      var catalog=card&&card.closest(".js-learnworlds-section");
      secs.forEach(function(s){ if(s===catalog||s.classList.contains("lw-topbar")||s.classList.contains("lw-footer")) return; if(!s.querySelector(".lw-course-card")) s.style.display="none"; });
      var head=document.createElement("section"); head.className="mthh";
      head.innerHTML='<div class="w"><div class="k">Protocols</div><h1>Your healing <em>protocols</em></h1><p>Each protocol pairs a video course with software that builds your personal day-by-day plan.</p></div>';
      if(catalog) catalog.parentNode.insertBefore(head,catalog);
      if(!LOGGED_IN){ function sales(){ [].forEach.call(document.querySelectorAll('.lw-course-card a[href*="/course/"], a.lw-course-card[href*="/course/"]'),function(a){ var sl=(a.getAttribute("href")||"").split("/course/")[1]; sl=sl&&sl.split(/[/?#]/)[0]; if(SALES[sl]) a.setAttribute("href",SALES[sl]); }); } sales(); setTimeout(sales,1500); }
      reveal();
    });
  }

  /* ---------------- community (Healing Hub) ---------------- */
  function social(){
    var frame=document.createElement("iframe");
    frame.className="mth-hub-frame"; frame.src=HUB; frame.title="The Healing Hub";
    frame.setAttribute("allow","autoplay; clipboard-write; fullscreen; encrypted-media");
    var tb=topbar();
    if(tb&&tb.parentNode) tb.parentNode.insertBefore(frame,tb.nextSibling); else document.body.appendChild(frame);
    function fit(){ var h=(tb?tb.getBoundingClientRect().bottom:0); frame.style.height="calc(100dvh - "+Math.max(0,Math.round(h))+"px)"; }
    fit(); window.addEventListener("resize",fit);
    H.classList.add("mth-hub-page"); reveal();
  }

  /* ---------------- wordmark (replaces PNG logo) ---------------- */
  function wordmark(){
    waitFor(function(){ return document.querySelector(".lw-topbar .lw-logo"); },function(img){
      if(!img||document.querySelector(".mth-logo")) return;
      var a=document.createElement("a"); a.className="mth-logo"; a.href="/home"; a.setAttribute("aria-label","Mark Talks Health, home");
      a.innerHTML='Mark <i>Talks</i> Health';
      img.parentNode.insertBefore(a,img); H.classList.add("mth-wm");
    },8000);
  }

  /* ---------------- mobile menu: tag sign in / sign up / sign out, lock page scroll ---------------- */
  function mobileMenu(){
    function tag(){
      [].forEach.call(document.querySelectorAll(".lw-topbar-hamburger-menu .mobile-nav-menu-item"),function(li){
        var a=li.querySelector(":scope > .mobile-nav-menu-link"); if(!a) return;
        var t=(a.textContent||"").trim().toLowerCase();
        if(t==="sign in"||t==="log in"||t==="login") li.classList.add("mth-auth","mth-signin");
        else if(t==="sign up"||t==="register"||t==="join") li.classList.add("mth-auth","mth-signup");
        else if(t==="sign out"||t==="log out") li.classList.add("mth-out");
      });
      /* members get "App" at the top of the phone menu (LearnWorlds' header button is desktop only) */
      if(LOGGED_IN){
        var ul=document.querySelector(".lw-topbar-hamburger-menu .mobile-nav-menu");
        if(ul&&!ul.querySelector('a.mobile-nav-menu-link[href$="/app"],.mth-appitem')){
          var src=null;
          [].forEach.call(ul.children,function(li){ if(!src&&li.classList.contains("mobile-nav-menu-item")&&!li.classList.contains("has-subMenu")&&!li.classList.contains("mth-auth")&&!li.classList.contains("mth-out")&&li.querySelector(":scope > .mobile-nav-menu-link")) src=li; });
          if(src){
            var li=src.cloneNode(true); li.classList.add("mth-appitem"); li.classList.remove("active","selected");
            [].forEach.call(li.querySelectorAll(".mobile-nav-subMenu"),function(x){ x.parentNode.removeChild(x); });
            var a=li.querySelector(":scope > .mobile-nav-menu-link");
            a.setAttribute("href","/app"); a.removeAttribute("target"); a.innerHTML="<span>App</span>";
            ul.insertBefore(li,ul.firstChild);
          }
        }
      }
      H.classList.toggle("mth-menu-open",!!document.querySelector(".lw-topbar .hamburger-open .lw-topbar-hamburger-menu"));
    }
    tag();
    var q=0; function later(){ if(q) return; q=1; requestAnimationFrame(function(){ q=0; tag(); }); }
    try{ new MutationObserver(later).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]}); }catch(e){}
  }

  /* ---------------- dead links: the GLP-1 menu item points at a page that doesn't exist ---------------- */
  var FIX={"/totalbodyhealing":"/glp1-weightloss"};
  function fixLinks(){
    document.addEventListener("click",function(e){
      var a=e.target.closest&&e.target.closest("a"); if(!a) return;
      var h=(a.getAttribute("href")||"").replace(/^https?:\/\/[^/]+/,"").replace(/\/+$/,"").toLowerCase();
      var v=(a.getAttribute("data-interactive-link-var1")||"").toLowerCase();
      var to=FIX[h]||FIX["/"+v];
      /* logged-out visitors go straight from a course link to its sales page (no in-between page flash) */
      if(!to&&!LOGGED_IN){ var m=h.match(/^\/course\/([^/?#]+)/); if(m&&SALES[m[1]]) to=SALES[m[1]]; }
      if(!to) return;
      e.preventDefault(); e.stopImmediatePropagation(); location.href=to;
    },true);
    function relabel(){ [].forEach.call(document.querySelectorAll('a[href$="/totalbodyhealing"],a[data-interactive-link-var1="totalbodyhealing"]'),function(a){ a.setAttribute("href",FIX["/totalbodyhealing"]); }); }
    relabel(); setTimeout(relabel,1500); setTimeout(relabel,4000);
  }


  /* ---------------- /app : the member app, full screen ----------------
     A LearnWorlds page at /app (logged-in members only) becomes the protocol
     app: our own slim header, then the protocol filling the rest of the screen.
     The protocol loads with ?mode=app, which switches on the phone app layout.
     Adds a home-screen icon so members can install it like an app. */
  var APP_PROTOS=[["gut","Gut Health"],["sugar","Blood Sugar"],["glp1","GLP-1"]];
  function appPage(){
    var ROOT=BASE.replace(/site\/$/,"");
    /* which protocol: a course's own link (/app?p=sugar) sets it and it's remembered; otherwise Gut Health */
    var pick=null; try{ pick=new URLSearchParams(location.search).get("p")||localStorage.getItem("mth_app_proto"); }catch(e){}
    if(!APP_PROTOS.some(function(x){return x[0]===pick;})) pick="gut";
    function name(k){ for(var i=0;i<APP_PROTOS.length;i++) if(APP_PROTOS[i][0]===k) return APP_PROTOS[i][1]; return ""; }

    /* home-screen app details */
    try{
      var abs=function(u){ return new URL(u,location.href).href; };
      var man={ name:"Mark Talks Health", short_name:"Mark Talks Health", start_url:abs("/app"), scope:abs("/"), display:"standalone",
        background_color:"#f6f1ea", theme_color:"#2b2622",
        icons:[{src:BASE+"app-icon-192.png",sizes:"192x192",type:"image/png"},{src:BASE+"app-icon-512.png",sizes:"512x512",type:"image/png",purpose:"any maskable"}] };
      [].forEach.call(document.querySelectorAll('link[rel="manifest"]'),function(l){ l.parentNode.removeChild(l); });
      var add=function(tag,attrs){ var el=document.createElement(tag); for(var k in attrs) el.setAttribute(k,attrs[k]); document.head.appendChild(el); };
      add("link",{rel:"manifest",href:"data:application/manifest+json,"+encodeURIComponent(JSON.stringify(man))});
      add("link",{rel:"apple-touch-icon",href:BASE+"app-icon-180.png"});
      add("meta",{name:"apple-mobile-web-app-capable",content:"yes"});
      add("meta",{name:"mobile-web-app-capable",content:"yes"});
      add("meta",{name:"apple-mobile-web-app-title",content:"Mark Talks Health"});
      add("meta",{name:"apple-mobile-web-app-status-bar-style",content:"default"});
      var tc=document.querySelector('meta[name="theme-color"]'); if(!tc) add("meta",{name:"theme-color",content:"#f6f1ea"}); else tc.setAttribute("content","#f6f1ea");
      var vp=document.querySelector('meta[name="viewport"]'); if(vp) vp.setAttribute("content","width=device-width, initial-scale=1, viewport-fit=cover");
    }catch(e){}

    var st=document.createElement("style");
    st.textContent=
      "html.mth-r-app,html.mth-r-app body{height:100%;overflow:hidden!important;background:#f6f1ea!important;margin:0}"+
      "html.mth-r-app body>*:not(#mth-app-shell){display:none!important}"+
      "#mth-app-shell{position:fixed;inset:0;display:flex;flex-direction:column;background:#f6f1ea;z-index:2147483000;font-family:'DM Sans',system-ui,-apple-system,sans-serif}"+
      "#mth-app-shell .ab{flex:none;display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 12px 8px;border-bottom:1px solid #e7dfd4;background:#f6f1ea}"+
      "#mth-app-shell .ab a.home{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;color:#2b2622;text-decoration:none;flex:none}"+
      "#mth-app-shell .ab a.home svg{width:22px;height:22px}"+
      "#mth-app-shell .ab .t{flex:1;min-width:0}"+
      "#mth-app-shell .ab .k{font:700 10px/1 'DM Sans',system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#b8664a}"+
      "#mth-app-shell .ab .n{font:500 20px/1.15 'Cormorant Garamond',Georgia,serif;color:#2b2622;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
      "#mth-app-shell .ab select{flex:none;max-width:42%;padding:8px 28px 8px 12px;border-radius:999px;border:1px solid #ddd3c6;background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%232b2622' stroke-width='1.5'/%3E%3C/svg%3E\") no-repeat right 11px center/10px;-webkit-appearance:none;appearance:none;font:600 13px 'DM Sans',system-ui,sans-serif;color:#2b2622}"+
      "#mth-app-shell iframe{flex:1;width:100%;border:0;display:block;background:#f6f1ea}"+
      "#mth-app-shell .ins{flex:none;display:none;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:0;background:#2b2622;color:#fff;font:600 13px 'DM Sans',system-ui,sans-serif;cursor:pointer}"+
      "#mth-app-shell .ins svg{width:15px;height:15px}"+
      "#mth-app-shell.can-install .ins{display:inline-flex}"+
      "#mth-app-shell.can-install select{max-width:38%}"+
      "#mth-app-shell .ab .k{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
      "@media (max-width:440px){#mth-app-shell .ins{width:38px;height:38px;padding:0;justify-content:center}#mth-app-shell .ins span{display:none}#mth-app-shell .ins svg{width:18px;height:18px}}"+
      "#mth-app-shell .sh{position:fixed;inset:0;z-index:5;display:none;align-items:flex-end;background:rgba(43,38,34,.45)}"+
      "#mth-app-shell .sh.on{display:flex}"+
      "#mth-app-shell .sh .c{width:100%;background:#f6f1ea;border-radius:22px 22px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.2)}"+
      "#mth-app-shell .sh .ic{width:56px;height:56px;border-radius:14px;display:block;margin-bottom:12px}"+
      "#mth-app-shell .sh h3{margin:0 0 4px;font:500 24px/1.15 'Cormorant Garamond',Georgia,serif;color:#2b2622}"+
      "#mth-app-shell .sh p{margin:0 0 14px;font:400 14px/1.45 'DM Sans',system-ui,sans-serif;color:#8a7d71}"+
      "#mth-app-shell .sh ol{margin:0 0 18px;padding:0;list-style:none;counter-reset:s}"+
      "#mth-app-shell .sh li{counter-increment:s;display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #e7dfd4;font:500 15px/1.35 'DM Sans',system-ui,sans-serif;color:#2b2622}"+
      "#mth-app-shell .sh li:before{content:counter(s);flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#2e5c45;color:#fff;font-size:13px;font-weight:700}"+
      "#mth-app-shell .sh li b{font-weight:700}"+
      "#mth-app-shell .sh button.ok{width:100%;min-height:50px;border:0;border-radius:14px;background:#2b2622;color:#fff;font:600 15px 'DM Sans',system-ui,sans-serif}"+
      "#mth-app-shell .ld{position:absolute;left:0;right:0;top:45%;text-align:center;font:400 22px 'Cormorant Garamond',Georgia,serif;color:#8a7d71;pointer-events:none}";
    document.head.appendChild(st);

    var shell=document.createElement("div"); shell.id="mth-app-shell";
    shell.innerHTML='<div class="ab"><a class="home" href="/home" aria-label="Back to the Mark Talks Health site"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></a>'+
      '<div class="t"><div class="k">Mark Talks Health</div><div class="n"></div></div>'+
      '<button type="button" class="ins" aria-label="Install the app on your phone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span>Install</span></button>'+'</div>'+
      '<div class="ld">Opening your protocol&hellip;</div><iframe title="Your protocol" allow="fullscreen; clipboard-write"></iframe>'+
      '<div class="sh" role="dialog" aria-modal="true" aria-label="Add the app to your home screen"><div class="c"><img class="ic" alt="" src="'+BASE+'app-icon-180.png"><h3>Add Mark Talks Health to your home screen</h3><p>It opens full screen, straight into your protocol, like any other app.</p><ol></ol><button type="button" class="ok">Got it</button></div></div>';
    document.body.appendChild(shell);
    var fr=shell.querySelector("iframe"), nm=shell.querySelector(".n"), ld=shell.querySelector(".ld");
    function load(k){
      pick=k; nm.textContent=name(k)+" Protocol"; ld.style.display="";
      try{ localStorage.setItem("mth_app_proto",k); }catch(e){}
      fr.src=ROOT+k+"/?mode=app";
    }
    fr.addEventListener("load",function(){ ld.style.display="none"; });

    /* Install button: phones and tablets only, hidden once installed */
    var ins=shell.querySelector(".ins"), sh=shell.querySelector(".sh"), ua=navigator.userAgent||"";
    var iOS=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
    var touch=window.matchMedia&&matchMedia("(pointer: coarse)").matches;
    var installed=(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
    function offer(){ if(touch&&!installed) shell.classList.add("can-install"); }
    window.__mthInstallReady=offer;
    window.__mthInstalled=function(){ installed=true; shell.classList.remove("can-install"); sh.classList.remove("on"); };
    if(iOS||INSTALL) offer();
    else setTimeout(offer,2500);   /* Android without the browser's own offer: show the menu steps instead */
    function steps(list){ sh.querySelector("ol").innerHTML=list.map(function(t){return "<li><span>"+t+"</span></li>";}).join(""); sh.classList.add("on"); }
    ins.addEventListener("click",function(){
      if(INSTALL){ var ev=INSTALL; INSTALL=null; ev.prompt(); (ev.userChoice||Promise.resolve({})).then(function(r){ if(r&&r.outcome==="accepted") window.__mthInstalled(); }); return; }
      if(iOS) steps(["Tap the <b>Share</b> button (the square with an arrow) at the bottom of Safari","Scroll down and tap <b>Add to Home Screen</b>","Tap <b>Add</b>"]);
      else steps(["Tap the <b>&#8942;</b> menu at the top right of your browser","Tap <b>Install app</b> or <b>Add to home screen</b>","Tap <b>Install</b> or <b>Add</b>"]);
    });
    sh.addEventListener("click",function(e){ if(e.target===sh||e.target.classList.contains("ok")) sh.classList.remove("on"); });
    load(pick);
    reveal();
  }

  ready(function(){
    try{ fixLinks(); }catch(e){}
    try{ wordmark(); }catch(e){}
    try{ mobileMenu(); }catch(e){}
    try{
      if(ROUTE==="home") home();
      else if(ROUTE==="funnel") funnel();
      else if(ROUTE==="course") course();
      else if(ROUTE==="social") social();
      else if(ROUTE==="courses") courses();
      else if(ROUTE==="app") appPage();
      else reveal();
      if(ROUTE!=="social"&&ROUTE!=="app") footer();
    }catch(e){ console.warn("MTH site",e); reveal(); }
  });
  /* safety net: never leave a page hidden */
  setTimeout(function(){ if(!H.classList.contains("mth-ready")){ H.classList.remove("mth-r-home","mth-r-funnel","mth-r-course","mth-r-courses"); reveal(); } },9000);
})();
