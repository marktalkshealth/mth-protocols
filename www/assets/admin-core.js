/* =================================================================
   ADMIN CORE — layout, navigation and shared helpers.
   Each screen registers itself with ADM.screen(id, {...}) in its own file.
   Address bar: admin.html#contacts, #person/name@example.com, #studio ...
================================================================= */
(function(){
  var A=window.ADM={ screens:{}, order:[] };
  A.esc=function(s){ return MTH.esc(s); };
  A.STAGES=[["lead","Lead","#cbbfae"],["signed_up","Signed up","#d9b979"],["customer","Customer","#9fb592"],["active","Active","#5f8f6b"],["at_risk","At risk","#c0623f"],["completed","Completed","#7f8fae"],["vip","VIP","#2b2724"],["refunded","Refunded","#bbbbbb"]];
  A.stageName=function(k){ for(var i=0;i<A.STAGES.length;i++) if(A.STAGES[i][0]===k) return A.STAGES[i][1]; return k||""; };
  A.stagePill=function(k){ return '<span class="pill s-'+A.esc(k)+'">'+A.esc(A.stageName(k))+'</span>'; };
  A.money=function(c){ c=Number(c||0); return "$"+(c/100).toLocaleString(undefined,{minimumFractionDigits:c%100?2:0,maximumFractionDigits:2}); };
  A.when=function(t,withTime){ if(!t) return "—"; var d=new Date(t); if(isNaN(d)) return "—";
    var days=Math.floor((Date.now()-d.getTime())/864e5);
    if(!withTime&&days>=0&&days<1) return "Today"; if(!withTime&&days===1) return "Yesterday"; if(!withTime&&days>1&&days<7) return days+" days ago";
    return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:d.getFullYear()===new Date().getFullYear()?undefined:"numeric"})+(withTime?" · "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}):""); };
  A.today=function(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
  A.rpc=async function(name,args,quiet){
    var r=await MTH.sb.rpc(name,args||{});
    if(r.error){ console.warn(name,r.error); if(!quiet) MTH.toast("Something went wrong ("+(r.error.message||name)+")"); throw r.error; }
    return r.data;
  };
  A.copy=async function(text,msg){ try{ await navigator.clipboard.writeText(text); MTH.toast(msg||"Copied"); }catch(e){ var t=document.createElement("textarea"); t.value=text; document.body.appendChild(t); t.select(); try{ document.execCommand("copy"); MTH.toast(msg||"Copied"); }catch(x){} t.remove(); } };
  A.download=function(name,text,type){ var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type:type||"text/plain"})); a.download=name; document.body.appendChild(a); a.click(); a.remove(); };
  A.csv=function(rows){ return rows.map(function(r){ return r.map(function(v){ v=v==null?"":String(v); return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(","); }).join("\n"); };

  /* contacts cache (CRM list), refreshed when something changes */
  A.people=null;
  A.loadPeople=async function(force){ if(A.people&&!force) return A.people; A.people=await A.rpc("mth_admin_crm")||[]; return A.people; };

  A.screen=function(id,def){ A.screens[id]=def; if(def.nav) A.order.push(id); };

  function shell(){
    var root=document.getElementById("adm");
    var groups={};
    A.order.forEach(function(id){ var g=A.screens[id].group||""; (groups[g]=groups[g]||[]).push(id); });
    var nav='<div class="brand">Admin</div>'+Object.keys(groups).map(function(g){ return (g?'<div class="grp">'+g+'</div>':'')+groups[g].map(function(id){ var s=A.screens[id]; return '<a href="#'+id+'" data-n="'+id+'">'+s.nav+'<span class="c hidden" data-c="'+id+'"></span></a>'; }).join(""); }).join("")+
      '<div class="grp">Site</div><a href="index.html">View site</a><a href="account.html">My account</a>';
    var tabs=A.order.map(function(id){ return '<a href="#'+id+'" data-n="'+id+'">'+A.screens[id].nav+'</a>'; }).join("");
    root.innerHTML='<nav class="adm-nav" aria-label="Admin">'+nav+'</nav><div style="min-width:0"><div class="adm-tabs" role="tablist">'+tabs+'</div><main class="adm-main" id="admMain"></main></div>';
  }
  A.badge=function(id,n){ var el=document.querySelector('[data-c="'+id+'"]'); if(!el) return; el.textContent=n; el.classList.toggle("hidden",!n); };

  async function route(){
    var h=decodeURIComponent((location.hash||"#overview").slice(1)), parts=h.split("/"), id=parts[0], arg=parts.slice(1).join("/");
    if(!A.screens[id]) id="overview";
    document.querySelectorAll("[data-n]").forEach(function(a){ var s=A.screens[id]; a.classList.toggle("on",a.dataset.n===(s.parent||id)); });
    var tab=document.querySelector('.adm-tabs a.on'); if(tab&&tab.scrollIntoView) try{ tab.scrollIntoView({inline:"center",block:"nearest"}); }catch(e){}
    var main=document.getElementById("admMain"); main.innerHTML='<div class="mx-wait" style="min-height:40vh">Loading…</div>';
    window.scrollTo(0,0);
    try{ await A.screens[id].render(main,arg); }
    catch(e){ console.error(e); main.innerHTML='<div class="panel card"><h3>Couldn’t load this screen</h3><p class="muted">'+A.esc(e.message||String(e))+'</p><button class="b sm" onclick="location.reload()">Reload</button></div>'; }
  }
  A.go=function(hash){ if(location.hash==="#"+hash) route(); else location.hash=hash; };
  A.refresh=route;

  A.start=async function(){
    await MTH.require();
    var ok=false; try{ ok=(await MTH.sb.rpc("mth_is_admin")).data===true; }catch(e){}
    var root=document.getElementById("adm");
    if(!ok){ root.innerHTML='<main class="adm-main"><h1 class="t">Admins <em>only</em></h1><p class="lead">This page is for Mark. You’re signed in as '+A.esc(MTH.user.email)+'.</p><a class="b" href="index.html">Back to the site</a></main>'; return; }
    shell(); window.addEventListener("hashchange",route); route();
    /* sidebar counters */
    try{ var t=await A.rpc("mth_admin_tasks",{ p_include_done:false },true); var due=(t||[]).filter(function(x){ return x.due&&x.due<=A.today(); }).length; A.badge("tasks",due); }catch(e){}
  };
})();
