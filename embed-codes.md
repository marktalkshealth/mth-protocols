# Embed codes — paste ONE into the course's first lesson (Embed / code block)

## Gut Health course

```html
<div id="mth-app-gut" style="min-height:400px;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#8a7d71">Loading your protocol…</div>
<script>
(function(){
  var src="https://courageous-klepon-0b1291.netlify.app/gut/";
  var box=document.getElementById("mth-app-gut");
  function frame(){ /* fallback: show the app in a self-sizing frame */
    var f=document.createElement("iframe"); f.src=src; f.title="Mark Talks Health protocol";
    f.style.cssText="width:100%;border:0;display:block;min-height:100vh"; f.setAttribute("scrolling","no");
    box.innerHTML=""; box.style.display="block"; box.appendChild(f);
    window.addEventListener("message",function(e){ if(e.source===f.contentWindow&&e.data&&e.data.type==="mth-height") f.style.height=e.data.h+"px"; });
  }
  /* Inside LearnWorlds' embed frame: load the app directly, same as pasting the full file */
  if(window.top!==window && document.body && document.body.children.length<=3){
    fetch(src,{cache:"no-cache"}).then(function(r){ if(!r.ok) throw 0; return r.text(); })
      .then(function(html){ html=html.replace(/<head>/i,'<head><base href="'+src+'">'); document.open(); document.write(html); document.close(); })
      .catch(frame);
  } else frame();
})();
</script>
```

## Diabetes / Blood Sugar course

```html
<div id="mth-app-sugar" style="min-height:400px;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#8a7d71">Loading your protocol…</div>
<script>
(function(){
  var src="https://courageous-klepon-0b1291.netlify.app/sugar/";
  var box=document.getElementById("mth-app-sugar");
  function frame(){ /* fallback: show the app in a self-sizing frame */
    var f=document.createElement("iframe"); f.src=src; f.title="Mark Talks Health protocol";
    f.style.cssText="width:100%;border:0;display:block;min-height:100vh"; f.setAttribute("scrolling","no");
    box.innerHTML=""; box.style.display="block"; box.appendChild(f);
    window.addEventListener("message",function(e){ if(e.source===f.contentWindow&&e.data&&e.data.type==="mth-height") f.style.height=e.data.h+"px"; });
  }
  /* Inside LearnWorlds' embed frame: load the app directly, same as pasting the full file */
  if(window.top!==window && document.body && document.body.children.length<=3){
    fetch(src,{cache:"no-cache"}).then(function(r){ if(!r.ok) throw 0; return r.text(); })
      .then(function(html){ html=html.replace(/<head>/i,'<head><base href="'+src+'">'); document.open(); document.write(html); document.close(); })
      .catch(frame);
  } else frame();
})();
</script>
```

## GLP-1 Weight Loss course

```html
<div id="mth-app-glp1" style="min-height:400px;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#8a7d71">Loading your protocol…</div>
<script>
(function(){
  var src="https://courageous-klepon-0b1291.netlify.app/glp1/";
  var box=document.getElementById("mth-app-glp1");
  function frame(){ /* fallback: show the app in a self-sizing frame */
    var f=document.createElement("iframe"); f.src=src; f.title="Mark Talks Health protocol";
    f.style.cssText="width:100%;border:0;display:block;min-height:100vh"; f.setAttribute("scrolling","no");
    box.innerHTML=""; box.style.display="block"; box.appendChild(f);
    window.addEventListener("message",function(e){ if(e.source===f.contentWindow&&e.data&&e.data.type==="mth-height") f.style.height=e.data.h+"px"; });
  }
  /* Inside LearnWorlds' embed frame: load the app directly, same as pasting the full file */
  if(window.top!==window && document.body && document.body.children.length<=3){
    fetch(src,{cache:"no-cache"}).then(function(r){ if(!r.ok) throw 0; return r.text(); })
      .then(function(html){ html=html.replace(/<head>/i,'<head><base href="'+src+'">'); document.open(); document.write(html); document.close(); })
      .catch(frame);
  } else frame();
})();
</script>
```

