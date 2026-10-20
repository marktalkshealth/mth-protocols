"""Builds the own-site homepage and the three sales pages in www/ from the
LearnWorlds page designs in site/ (home.html, funnel-*.html).
Run from the repo root:  python3 tools/build_pages.py
Edit the designs in site/ (or the finished pages in www/ directly)."""
import re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def R(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()
def W(p, s): open(os.path.join(ROOT, p), "w", encoding="utf-8").write(s)
def rep(s, a, b, n=1):
    c = s.count(a); assert c == n, (a[:90], c); return s.replace(a, b)

def head(title, desc, image="https://marktalkshealth.github.io/mth-protocols/site/mark-kitchen.jpg"):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mark Talks Health">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f7f1e7">
<link rel="icon" href="assets/app-icon-192.png">
<link rel="apple-touch-icon" href="assets/app-icon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/mth.css">
<script src="assets/vendor/supabase-2.118.0.js"></script>
<script src="assets/mth.js"></script>
'''

def page(title, desc, design, after, wait):
    return head(title, desc) + f'''</head>
<body>
<main id="page"><div class="mx-wait">{wait}</div></main>
<template id="design">
{design}
</template>
<script>
MTH.ready.then(function(){{
  var main=document.getElementById("page"); main.innerHTML="";
  MTH.mount(document.getElementById("design").innerHTML, main);
{after}
}});
</script>
</body>
</html>
'''

# ---------------- homepage ----------------
s = R("site/home.html")
s = rep(s, '''var loggedIn=false; try{ var u=window.MTH_USER; loggedIn=!!(u&&u.id&&!/\\{\\{/.test(u.id)); }catch(e){}''',
        '''var own=function(c){ return !!(window.MTH&&MTH.owns(c.key)); };   /* own site: "Open" once they own that protocol */''')
s = rep(s, '{t:"Gut Health Protocol",', '{key:"gut",t:"Gut Health Protocol",')
s = rep(s, '{t:"Diabetes Protocol",', '{key:"sugar",t:"Diabetes Protocol",')
s = rep(s, '{t:"GLP-1 Weight Loss Protocol",', '{key:"glp1",t:"GLP-1 Weight Loss Protocol",')
s = rep(s, 'funnel:"/guthealthprotocol",course:"/course/new-autoimmune"', 'funnel:"gut.html",course:"course.html?p=gut"')
s = rep(s, 'funnel:"/thediabetesprotocol",course:"/course/autoimmune"', 'funnel:"diabetes.html",course:"course.html?p=sugar"')
s = rep(s, 'funnel:"/glp1-weightloss",course:"/course/total-body-healing"', 'funnel:"glp1.html",course:"course.html?p=glp1"')
# every "loggedIn" inside the card builders becomes "does this person own this card's protocol"
s = s.replace("loggedIn?", "own(c)?").replace("(loggedIn?", "(own(c)?")
assert "loggedIn" not in s, re.findall(r".{40}loggedIn.{40}", s)
s = rep(s, '<a class="more" href="/courses">All courses →</a>', '<a class="more" href="protocols.html">All protocols →</a>')
s = rep(s, '<a class="btn" href="/social">Open the Healing Hub</a>', '<a class="btn" href="protocols.html">Choose your protocol</a>')
assert "/social" not in s and '"/course' not in s
s = rep(s, '</div></section>\n\n<script>', '''</div></section>

<section id="mh-list" style="padding-top:0"><div class="w"><div class="hub rv" style="display:block">
  <div class="k">New protocols first</div><h2>Join the <em>list</em></h2><p class="lead" style="margin-bottom:16px">Get a note when a new protocol, ebook or live Q&amp;A opens. No spam, unsubscribe any time.</p>
  <form class="mx-list" data-source="home"><input class="inp" type="email" name="email" placeholder="you@example.com" autocomplete="email" required aria-label="Email"><button class="btn" type="submit">Join</button></form>
</div></div></section>

<script>''')
W("www/index.html", page("Mark Talks Health · Natural healing meets modern science",
    "Science-backed natural healing protocols with a personalised daily plan, built on a seven-step method.", s, "  MTH.listForms(main);", "Mark Talks Health"))

# ---------------- sales pages ----------------
FUNNELS = [
    ("gut", "site/funnel-gut.html", "gut.html", "The Gut Health Protocol · Mark Talks Health",
     "Reset your gut in 7 days with a personalised plan: a guided green juice cleanse, the 7 healing steps, a 7-part course and your own healing app."),
    ("sugar", "site/funnel-diabetes.html", "diabetes.html", "The Diabetes Protocol · Mark Talks Health",
     "Take back control of your blood sugar with a plan built for your body: the 7 healing steps, a 7-part course and your own healing app."),
    ("glp1", "site/funnel-glp1.html", "glp1.html", "The GLP-1 Weight Loss Protocol · Mark Talks Health",
     "Lose the weight on a GLP-1 and keep it off: protect your muscle with a personalised plan, a 7-part course and your own app."),
]
for key, src, out, title, desc in FUNNELS:
    s = R(src)
    s = s[s.index('<div id="g2"'):]
    a = s.index('/* ---- buy buttons scroll to LearnWorlds checkout ---- */'); b = s.index('/* ---- symptom picker ---- */')
    s = s[:a] + f'''/* ---- buy buttons: Stripe checkout on our own site (signs in first if needed) ---- */
function findCheckout(){{ return document.getElementById("checkout"); }}
function buy(e){{ window.MTH.buy("{key}", e&&e.currentTarget); }}
R.querySelectorAll(".g2-buy").forEach(function(b){{ b.addEventListener("click",buy); }});
if(location.hash==="#checkout"){{ setTimeout(function(){{ var el=findCheckout(); if(el) el.scrollIntoView({{behavior:"smooth",block:"start"}}); }},350); }}

''' + s[b:]
    s = rep(s, '<section class="alt offer">', '<section class="alt offer" id="checkout">')
    s = rep(s, '<div class="amt"><b>$97</b><small>Lifetime access</small></div>', '<div class="amt"><s class="was">$147</s><b>$97</b><small>Launch price · lifetime access</small></div>')
    s = rep(s, 'ft=document.querySelector(".mthf")', 'ft=document.querySelector(".mx-f")')
    s = rep(s, '<style>\n', '<style>\n#g2 .amt .was{display:block;font-size:17px;color:var(--muted,#6e6259);text-decoration-thickness:1.5px;margin-bottom:-2px}\n#g2 .fine{display:none}\n', 1)
    after = f'''  var K="{key}", own=MTH.owns(K), P=MTH.config.products[K];
  if(own){{
    document.querySelectorAll("#g2 .g2-buy").forEach(function(b){{ b.innerHTML="Open my course"; }});
    var amt=document.querySelector("#g2 .amt"); if(amt) amt.innerHTML='<b style="font-size:26px">You own this</b><small>Lifetime access</small>';
    var sk=document.querySelector("#g2Sticky small"); if(sk) sk.textContent="You own this protocol";
  }}
  if(MTH.qs("checkout")==="cancelled") MTH.toast("Checkout cancelled. Nothing was charged.");
  if(MTH.qs("locked")&&!own) MTH.toast("Get the protocol to open the course and your app.",3600);
  if(MTH.qs("buy")&&MTH.user&&!own){{ var b=document.querySelector("#checkout .g2-buy"); MTH.buy(K,b); }}'''
    W("www/" + out, page(title, desc, s, after, title.split(" · ")[0]))
print("built index.html, gut.html, diabetes.html, glp1.html")
