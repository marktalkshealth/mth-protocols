# Embed codes — paste ONE into the course's first lesson (Embed / code block)

## Gut Health course

```html
<div id="mth-app-gut"></div>
<script>
(function(){
  var src="https://courageous-klepon-0b1291.netlify.app/gut/";
  var box=document.getElementById("mth-app-gut");
  var f=document.createElement("iframe");
  f.src=src; f.title="Mark Talks Health protocol";
  f.style.cssText="width:100%;border:0;display:block;min-height:100vh";
  f.setAttribute("scrolling","no");
  f.setAttribute("allow","clipboard-write; fullscreen");
  box.appendChild(f);
  window.addEventListener("message",function(e){
    if(e.source!==f.contentWindow||!e.data) return;
    if(e.data.type==="mth-height") f.style.height=e.data.h+"px";
    if(e.data.type==="mth-who"){ var u=null; try{u=window.MTH_USER||window.top.MTH_USER;}catch(x){}
      if(u) f.contentWindow.postMessage({type:"mth-user",user:u},"*"); }
  });
})();
</script>
```

## Diabetes / Blood Sugar course

```html
<div id="mth-app-sugar"></div>
<script>
(function(){
  var src="https://courageous-klepon-0b1291.netlify.app/sugar/";
  var box=document.getElementById("mth-app-sugar");
  var f=document.createElement("iframe");
  f.src=src; f.title="Mark Talks Health protocol";
  f.style.cssText="width:100%;border:0;display:block;min-height:100vh";
  f.setAttribute("scrolling","no");
  f.setAttribute("allow","clipboard-write; fullscreen");
  box.appendChild(f);
  window.addEventListener("message",function(e){
    if(e.source!==f.contentWindow||!e.data) return;
    if(e.data.type==="mth-height") f.style.height=e.data.h+"px";
    if(e.data.type==="mth-who"){ var u=null; try{u=window.MTH_USER||window.top.MTH_USER;}catch(x){}
      if(u) f.contentWindow.postMessage({type:"mth-user",user:u},"*"); }
  });
})();
</script>
```

## GLP-1 Weight Loss course

```html
<div id="mth-app-glp1"></div>
<script>
(function(){
  var src="https://courageous-klepon-0b1291.netlify.app/glp1/";
  var box=document.getElementById("mth-app-glp1");
  var f=document.createElement("iframe");
  f.src=src; f.title="Mark Talks Health protocol";
  f.style.cssText="width:100%;border:0;display:block;min-height:100vh";
  f.setAttribute("scrolling","no");
  f.setAttribute("allow","clipboard-write; fullscreen");
  box.appendChild(f);
  window.addEventListener("message",function(e){
    if(e.source!==f.contentWindow||!e.data) return;
    if(e.data.type==="mth-height") f.style.height=e.data.h+"px";
    if(e.data.type==="mth-who"){ var u=null; try{u=window.MTH_USER||window.top.MTH_USER;}catch(x){}
      if(u) f.contentWindow.postMessage({type:"mth-user",user:u},"*"); }
  });
})();
</script>
```

