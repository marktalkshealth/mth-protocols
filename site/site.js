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
  var FUNNELS={"/guthealthprotocol":"funnel-gut.html","/thediabetesprotocol":"funnel-diabetes.html"};
  var ROUTE= (path==="/"||path==="/home")?"home"
           : FUNNELS[path]?"funnel"
           : path==="/courses"?"courses"
           : path.indexOf("/course/")===0?"course"
           : path==="/social"?"social" : "";
  if(ROUTE) H.classList.add("mth-r-"+ROUTE);

  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded",fn); }
  function waitFor(test,fn,ms){ var t0=Date.now(); (function loop(){ var r=null; try{r=test();}catch(e){} if(r) return fn(r); if(Date.now()-t0<(ms||12000)) setTimeout(loop,120); else fn(null); })(); }
  function reveal(){ H.classList.add("mth-ready"); }
  /* insert an HTML fragment and run its scripts */
  function mount(html,target,before){
    var box=document.createElement("div"); box.className="mth-mount"; box.innerHTML=html;
    var scripts=[].slice.call(box.querySelectorAll("script"));
    if(before) target.parentNode.insertBefore(box,target); else target.appendChild(box);
    scripts.forEach(function(old){ var s=document.createElement("script"); if(old.src) s.src=old.src; else s.textContent=old.textContent; old.parentNode.replaceChild(s,old); });
    return box;
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
    if(lw&&lw.parentNode) lw.parentNode.insertBefore(f,lw.nextSibling); else document.body.appendChild(f);
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
  function isCheckout(sec){ var t=(sec.innerText||"").toLowerCase(); return t.indexOf("order summary")>-1||t.indexOf("payment method")>-1; }
  function funnel(){
    var file=FUNNELS[path]; if(!file){ reveal(); return; }
    waitFor(function(){ var s=[].slice.call(document.querySelectorAll(".js-learnworlds-section")); return s.length>1?s:null; },function(secs){
      secs=secs||[];
      var checkout=null;
      secs.forEach(function(s){ if(s.classList.contains("lw-topbar")||s.classList.contains("lw-footer")) return; if(!checkout&&isCheckout(s)) checkout=s; else if(!isCheckout(s)) s.classList.add("mth-old"); });
      load(file).then(function(html){
        var first=secs.filter(function(s){return !s.classList.contains("lw-topbar");})[0]||document.body.firstChild;
        mount(html,first,true); reveal();
      }).catch(function(e){ console.warn("MTH funnel",e); secs.forEach(function(s){s.classList.remove("mth-old");}); reveal(); });
    });
  }

  /* ---------------- course page ---------------- */
  var TILES=[["#c0623f","#7e3b25"],["#7a8f6e","#3f4b38"],["#b8924a","#6e5427"],["#8a7b6e","#463b33"],["#a8735a","#5a3a2b"],["#6f7a8c","#363c48"]];
  function txt(el){ return el?(el.textContent||"").replace(/\s+/g," ").trim():""; }
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});};
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
      H.classList.toggle("mth-menu-open",!!document.querySelector(".lw-topbar .hamburger-open .lw-topbar-hamburger-menu"));
    }
    tag();
    var q=0; function later(){ if(q) return; q=1; requestAnimationFrame(function(){ q=0; tag(); }); }
    try{ new MutationObserver(later).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]}); }catch(e){}
  }

  /* ---------------- dead links: the GLP-1 menu item points at a page that doesn't exist ---------------- */
  var FIX={"/totalbodyhealing":"/course/total-body-healing"};
  function fixLinks(){
    document.addEventListener("click",function(e){
      var a=e.target.closest&&e.target.closest("a"); if(!a) return;
      var h=(a.getAttribute("href")||"").replace(/^https?:\/\/[^/]+/,"").replace(/\/+$/,"").toLowerCase();
      var v=(a.getAttribute("data-interactive-link-var1")||"").toLowerCase();
      var to=FIX[h]||FIX["/"+v]; if(!to) return;
      e.preventDefault(); e.stopImmediatePropagation(); location.href=to;
    },true);
    function relabel(){ [].forEach.call(document.querySelectorAll('a[href$="/totalbodyhealing"],a[data-interactive-link-var1="totalbodyhealing"]'),function(a){ a.setAttribute("href",FIX["/totalbodyhealing"]); }); }
    relabel(); setTimeout(relabel,1500); setTimeout(relabel,4000);
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
      else reveal();
      if(ROUTE!=="social") footer();
    }catch(e){ console.warn("MTH site",e); reveal(); }
  });
  /* safety net: never leave a page hidden */
  setTimeout(function(){ if(!H.classList.contains("mth-ready")){ H.classList.remove("mth-r-home","mth-r-funnel"); reveal(); } },9000);
})();
