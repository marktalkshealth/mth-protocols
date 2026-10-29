#!/usr/bin/env python3
"""Builds the Mark Talks Health blog into www/blog/ plus www/sitemap.xml, www/robots.txt.

Run from the repo root:
    python3 tools/build_blog.py            # published articles only (what goes live)
    python3 tools/build_blog.py --drafts   # also drafts, marked noindex (for previews)

Articles live in blog/posts/<slug>.md (front matter + Markdown).
Studies come from the shared library research/studies.json and are cited by key.

Article syntax, on top of normal Markdown:
    ## [Problem] Heading       section label: Problem, Study, Solution, Story, Steps, Bottom
    [^wastyk2021]              numbered citation to a study in the library
    ::: study wastyk2021       study card (finding, limits, link); text inside is your take
    ::: story                  "My story" callout
    ::: note                   safety / caution box
    ::: takeaways              key takeaways box (use a bullet list inside)
    ::: cta                    course box (uses the article's cta: gut | sugar | glp1)
    :::                        closes a block
    [[MARK: ...]]              a note for Mark to fill in; blocks publishing until removed
Needs: pip install markdown pyyaml pillow
"""
import html, json, math, os, re, sys, datetime
import markdown, yaml
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WWW = os.path.join(ROOT, "www")
OUT = os.path.join(WWW, "blog")
FONTS = os.path.join(ROOT, "tools", "fonts")
VER = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M")

def rd(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()
def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(s)
def esc(s): return html.escape(str(s), quote=True)
def strip_tags(s): return re.sub(r"<[^>]+>", "", s)
def slugify(s):
    s = strip_tags(s).lower()
    s = re.sub(r"&[a-z]+;", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:70].strip("-") or "section"

CFG = yaml.safe_load(rd("blog/config.yml"))
LIB = json.loads(rd("research/studies.json"))["studies"]
SITE = CFG["site"].rstrip("/")
KICKS = {"problem": "The problem", "study": "The study", "solution": "The solution",
         "story": "My story", "steps": "Step by step", "bottom": "The bottom line"}

def media_path(url):
    """Map a site URL (/media/site/x.jpg, /blog/...) to a file in this repo, for checks and covers."""
    if url.startswith("/media/site/"): return os.path.join(ROOT, "site", url[len("/media/site/"):])
    if url.startswith("/media/shared/"): return os.path.join(ROOT, "shared", url[len("/media/shared/"):])
    return os.path.join(WWW, url.lstrip("/"))

def doi_url(s): return "https://doi.org/" + s["doi"]
def pubmed_url(s):
    return ("https://pubmed.ncbi.nlm.nih.gov/%s/" % s["pmid"]) if s.get("pmid") else \
           "https://pubmed.ncbi.nlm.nih.gov/?term=" + s["doi"].replace("/", "%2F")

# ---------------------------------------------------------------- posts
def load_posts(include_drafts):
    posts = []
    d = os.path.join(ROOT, "blog", "posts")
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".md"): continue
        raw = open(os.path.join(d, fn), encoding="utf-8").read()
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
        if not m: sys.exit("No front matter in " + fn)
        fm = yaml.safe_load(m.group(1)); fm["body"] = m.group(2); fm["file"] = fn
        fm.setdefault("slug", fn[:-3])
        fm["status"] = fm.get("status", "draft")
        if fm["status"] != "published" and not include_drafts: continue
        for k in ("date", "updated"):
            if isinstance(fm.get(k), (datetime.date, datetime.datetime)): fm[k] = fm[k].isoformat()[:10]
        fm.setdefault("updated", fm.get("date"))
        fm["url"] = "/blog/%s/" % fm["slug"]
        posts.append(fm)
    posts.sort(key=lambda p: (p.get("date") or "", p.get("type") == "pillar"), reverse=True)
    return posts

# ---------------------------------------------------------------- article body
CITE_RE = re.compile(r"\[\^([a-z0-9_-]+)\]")
BLOCK_RE = re.compile(r"^:::[ \t]*([a-z]+)?[ \t]*([^\n]*)$")

def render_body(p):
    body = p["body"]
    order = []                                  # study keys in order of first citation
    def note(k):
        if k not in LIB: sys.exit("%s: unknown study key '%s' (add it to research/studies.json)" % (p["file"], k))
        if k not in order: order.append(k)
        return order.index(k) + 1
    for m in re.finditer(r"\[\^([a-z0-9_-]+)\]|^:::[ \t]*study[ \t]+([a-z0-9_-]+)", body, re.M):
        note(m.group(1) or m.group(2))
    seen_back = set()
    def cite_html(k):
        n = note(k); a = ""
        if n not in seen_back: a = ' id="cite-%d"' % n; seen_back.add(n)
        return '<sup class="cite"><a href="#ref-%d"%s aria-label="Source %d">%d</a></sup>' % (n, a, n, n)

    md = lambda s: markdown.markdown(CITE_RE.sub(lambda m: cite_html(m.group(1)), s),
                                     extensions=["extra", "sane_lists", "smarty"], output_format="html5")
    # pull out ::: blocks, render them separately, leave a placeholder
    blocks, out, lines, i = {}, [], body.split("\n"), 0
    while i < len(lines):
        m = BLOCK_RE.match(lines[i])
        if m and m.group(1):
            kind, arg = m.group(1), m.group(2).strip(); inner = []; i += 1
            while i < len(lines) and not re.match(r"^:::\s*$", lines[i]): inner.append(lines[i]); i += 1
            i += 1
            key = "MTHBLOCK%04d" % len(blocks)
            blocks[key] = render_block(p, kind, arg, "\n".join(inner).strip(), md, cite_html)
            out += ["", key, ""]
        else:
            out.append(lines[i]); i += 1
    h = md("\n".join(out))
    for k, v in blocks.items(): h = h.replace("<p>%s</p>" % k, v)
    # section labels + heading ids + table of contents
    toc, used = [], set()
    def head(m):
        lvl, text = m.group(1), m.group(2)
        km = re.match(r"\[(\w+)\]\s*(.*)$", text, re.S)
        kick = ""
        if km:
            label = KICKS.get(km.group(1).lower())
            if not label: sys.exit("%s: unknown section label [%s]" % (p["file"], km.group(1)))
            kick = '<span class="sec-k">%s</span>' % label; text = km.group(2)
            p.setdefault("_sections", []).append(km.group(1).lower())
        sid = slugify(html.unescape(text)); base = sid; n = 2
        while sid in used: sid = "%s-%d" % (base, n); n += 1
        used.add(sid)
        if lvl == "2": toc.append((sid, html.unescape(strip_tags(text))))
        return '<h%s id="%s">%s%s</h%s>' % (lvl, sid, kick, text, lvl)
    h = re.sub(r"<h([23])>(.*?)</h\1>", head, h, flags=re.S)
    # outbound links open in a new tab
    h = re.sub(r'<a href="(https?://[^"]+)">', r'<a href="\1" target="_blank" rel="noopener">', h)
    h = re.sub(r"<table>", '<div class="tbl"><table>', h).replace("</table>", "</table></div>")
    p["_order"], p["_toc"] = order, toc
    p["_words"] = len(re.findall(r"[A-Za-z0-9']+", strip_tags(h)))
    p["_mins"] = max(1, round(p["_words"] / 230))
    p["_todo"] = re.findall(r"\[\[MARK:(.*?)\]\]", body, re.S)
    h = re.sub(r"\[\[MARK:(.*?)\]\]", lambda m: '<mark class="todo">Mark to fill in: %s</mark>' % esc(m.group(1).strip()), h, flags=re.S)
    return h

def render_block(p, kind, arg, inner, md, cite_html):
    if kind == "study":
        s = LIB[arg]
        who = "Human study" if s.get("humans") else "Animal study"
        cls = "hum" if s.get("humans") else "ani"
        take = md(inner) if inner else ""
        return ('<aside class="study" id="study-%s"><div class="st-top"><span class="st-k">The study</span>'
                '<span class="st-j">%s · %s</span></div>'
                '<p class="st-t">%s</p><p class="st-m"><span class="st-b %s">%s</span> %s</p>'
                '<div class="st-f"><b>What they found.</b> %s %s</div>%s'
                '<p class="st-c"><b>The limits.</b> %s</p>'
                '<a class="st-l" href="%s" target="_blank" rel="noopener">Read the study ↗</a></aside>'
                % (esc(arg), esc(s["journal"]), s["year"], esc(s["title"]), cls, who, esc(s["type"]),
                   esc(s["finding"]), cite_html(arg), ('<div class="st-x">%s</div>' % take) if take else "",
                   esc(s["caveat"]), esc(doi_url(s))))
    if kind == "story":
        return ('<aside class="story"><img src="%s" alt="%s" width="72" height="72" loading="lazy">'
                '<div><span class="sec-k">My story</span>%s</div></aside>'
                % (esc(CFG["author"]["photo"]), esc(CFG["author"]["name"]), md(inner)))
    if kind == "note":
        return '<aside class="note" role="note"><span class="sec-k">Before you start</span>%s</aside>' % md(inner)
    if kind == "takeaways":
        return '<aside class="take"><span class="sec-k">Key takeaways</span>%s</aside>' % md(inner)
    if kind == "cta":
        return cta_html(p, inline=True, text=md(inner) if inner else "")
    sys.exit("%s: unknown block ::: %s" % (p["file"], kind))

def utm(url, p, where):
    path, _, frag = url.partition("#")
    return "%s?utm_source=blog&utm_medium=%s&utm_campaign=%s%s" % (path, where, p["slug"], ("#" + frag) if frag else "")

def cta_html(p, inline=False, text=""):
    c = CFG["ctas"][p.get("cta", "gut")]
    return ('<aside class="cta%s"><img src="%s" alt="%s" loading="lazy" width="600" height="368">'
            '<div><span class="sec-k">%s</span><p class="cta-n">%s</p>%s<p class="cta-p"><s>%s</s> <b>%s</b></p>'
            '<div class="cta-a"><a class="b" href="%s">Start today · %s</a><a class="b ghost" href="%s">See what\'s inside</a></div></div></aside>'
            % (" in" if inline else "", esc(c["image"]), esc(c["image_alt"]),
               "Put it into practice" if inline else "Ready to start?", esc(c["name"]),
               text or "<p>%s</p>" % esc(c["line"]), esc(c["was"]), esc(c["price"]),
               esc(utm(c["url"] + "#checkout", p, "cta-" + ("inline" if inline else "end"))), esc(c["price"]),
               esc(utm(c["url"], p, "cta-" + ("inline" if inline else "end")))))

# ---------------------------------------------------------------- cover images (1200x630, also the share image)
TINTS = {None: ((247, 241, 231), (239, 229, 214)),          # cream
         "gut-health": ((248, 236, 226), (240, 219, 203)),   # terracotta blush
         "fasting": ((238, 242, 232), (222, 230, 214)),      # sage
         "nutrition": ((248, 241, 224), (238, 226, 196)),    # gold
         "stress": ((242, 236, 232), (229, 219, 211))}       # warm stone
def font(name, size): return ImageFont.truetype(os.path.join(FONTS, name), size)
def cover(p):
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), "#f7f1e7"); d = ImageDraw.Draw(im)
    top, bot = TINTS.get(p.get("category"), TINTS[None])
    for y in range(H):                                   # soft gradient, tinted by topic
        t = y / H; c = tuple(int(a + (b - a) * t) for a, b in zip(top, bot))
        d.line([(0, y), (W, y)], fill=c)
    # Mark's photo, right side, rounded with a shadow
    ph = Image.open(media_path(CFG["author"]["photo"])).convert("RGB")
    pw, phh = 360, 450
    ph = ImageOps.fit(ph, (pw, phh), centering=(0.5, 0.35))
    mask = Image.new("L", (pw, phh), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw, phh], 28, fill=255)
    px, py = W - pw - 70, (H - phh) // 2
    sh = Image.new("L", (W, H), 0); ImageDraw.Draw(sh).rounded_rectangle([px + 6, py + 18, px + pw + 6, py + phh + 18], 28, fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    im.paste(Image.new("RGB", (W, H), (120, 100, 80)), (0, 0), sh)
    im.paste(ph, (px, py), mask)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([px - 14, py - 14, px + pw + 14, py + phh + 14], 34, outline="#b8924a", width=2)
    # text
    x, maxw = 70, px - 70 - 60
    k = (CFG["categories"].get(p.get("category"), "") + "  ·  MARK TALKS HEALTH").upper()
    fk = font("inter-latin-700-normal.ttf", 19)
    cx = x
    for ch in k: d.text((cx, 78), ch, font=fk, fill="#c0623f"); cx += d.textlength(ch, font=fk) + 2.6
    title = p.get("cover_title") or p["title"]
    toks = []                                            # *word* = italic terracotta
    for part in re.split(r"(\*[^*]+\*)", title):
        if not part: continue
        it = part.startswith("*"); part = part.strip("*")
        toks += [(w, it) for w in part.split()]
    for size in (76, 70, 64, 58, 52, 48):
        fr, fi = font("cormorant-garamond-latin-600-normal.ttf", size), font("cormorant-garamond-latin-500-italic.ttf", size)
        lines, cur, cw = [], [], 0
        for w, it in toks:
            f = fi if it else fr; ww = d.textlength(w, font=f); sp = d.textlength(" ", font=fr)
            if cur and cw + sp + ww > maxw: lines.append(cur); cur, cw = [], 0
            cw += (sp if cur else 0) + ww; cur.append((w, it))
        if cur: lines.append(cur)
        lh = int(size * 1.04)
        if len(lines) * lh <= 330: break
    y = 128 + (330 - len(lines) * lh) // 2
    for ln in lines:
        cx = x
        for j, (w, it) in enumerate(ln):
            f = fi if it else fr
            if j: cx += d.textlength(" ", font=fr)
            d.text((cx, y), w, font=f, fill="#c0623f" if it else "#2b2724"); cx += d.textlength(w, font=f)
        y += lh
    d.line([(x, 490), (x + 90, 490)], fill="#b8924a", width=3)
    fs = font("inter-latin-500-normal.ttf", 21)
    n = len(p["_order"])
    d.text((x, 512), "%d studies cited  ·  %d min read" % (n, p["_mins"]), font=fs, fill="#6e6259")
    d.text((x, 545), "The problem. The study. The solution.", font=font("cormorant-garamond-latin-500-italic.ttf", 28), fill="#7a8f6e")
    path = os.path.join(OUT, "img", p["slug"] + ".jpg")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "JPEG", quality=86, optimize=True, progressive=True)
    return "/blog/img/%s.jpg" % p["slug"]

# ---------------------------------------------------------------- page shell
def fmt_date(s):
    d = datetime.date.fromisoformat(s); return d.strftime("%B %-d, %Y")

def shell(title, desc, canonical, body, image=None, jsonld=(), noindex=False, og_type="website", extra_head=""):
    image = image or "/blog/img/blog.jpg"
    ld = "".join('<script type="application/ld+json">%s</script>\n' % json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in jsonld)
    c = CFG["ctas"]["gut"]
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(SITE + canonical)}">
{'<meta name="robots" content="noindex, nofollow">' if noindex else '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="{esc(CFG["brand"])}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(SITE + canonical)}">
<meta property="og:image" content="{esc(SITE + image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f7f1e7">
<link rel="alternate" type="application/rss+xml" title="{esc(CFG["blog"]["title"])}" href="/blog/feed.xml">
<link rel="icon" href="/assets/app-icon-192.png">
<link rel="apple-touch-icon" href="/assets/app-icon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/mth.css?v={VER}">
<link rel="stylesheet" href="/assets/blog.css?v={VER}">
{extra_head}{ld}</head>
<body class="blog">
<a class="skip" href="#main">Skip to content</a>
{'<div class="mx-test"><b>Draft preview</b> · not published yet, hidden from Google</div>' if noindex else ''}
<header class="mx-h"><div class="in"><a class="mx-word" href="/">Mark Talks <em>Health</em></a>
<nav class="mx-nav" aria-label="Main"><a href="/protocols">Courses</a><a href="/app">Apps</a><a href="/community">Hub</a></nav>
<div class="mx-act"><a class="b sm ghost" href="/login">Sign in</a><a class="b sm wide" href="{esc(c["url"])}#checkout">Start · {esc(c["price"])}</a>
<button class="mx-burger" type="button" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div></div></header>
<div class="mx-sheet" role="dialog" aria-label="Menu"><div class="top"><a class="mx-word" href="/">Mark Talks <em>Health</em></a><button class="mx-burger" type="button" aria-label="Close menu" style="display:grid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
<nav><a href="/protocols">Courses<small>See the healing programs</small></a><a href="/blog/">Blog<small>Research, explained</small></a><a href="/login">Sign in<small>Access your courses</small></a></nav>
<div class="bot"><a class="b full" href="{esc(c["url"])}#checkout">Start the {esc(c["name"].replace("The ", ""))} · {esc(c["price"])}</a></div></div>
<main id="main">
{body}
</main>
<footer class="mx-f"><div class="in"><div class="brand">Mark Talks Health</div>
<nav aria-label="Footer"><a href="/blog/">Blog</a><a href="/gut">Gut Health</a><a href="/diabetes">Diabetes</a><a href="/glp1">GLP-1</a><a href="/picks">My Picks</a><a href="/partners">Work with me</a><a href="mailto:marktalkshealth@gmail.com">Help</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refunds">Refunds</a></nav>
<div class="fine">Educational, not medical advice. Results vary; talk to your healthcare provider before fasting or changing medication. &copy; {datetime.date.today().year} Mark Talks Health</div></div></footer>
<script>
(function(){{var s=document.querySelector(".mx-sheet"),b=document.querySelectorAll(".mx-burger");
b[0].addEventListener("click",function(){{s.classList.add("on");document.body.style.overflow="hidden";}});
b[1].addEventListener("click",function(){{s.classList.remove("on");document.body.style.overflow="";}});
document.querySelectorAll(".chip[data-cat]").forEach(function(c){{c.addEventListener("click",function(){{var k=c.getAttribute("data-cat");
document.querySelectorAll(".chip[data-cat]").forEach(function(x){{x.classList.toggle("on",x===c);}});
document.querySelectorAll(".pc[data-cat]").forEach(function(a){{a.hidden=!!k&&a.getAttribute("data-cat")!==k;}});}});}});
var t=document.querySelectorAll(".toc a");if(!t.length||!("IntersectionObserver" in window))return;
var m={{}};t.forEach(function(a){{m[a.getAttribute("href").slice(1)]=a;}});
var o=new IntersectionObserver(function(es){{es.forEach(function(e){{if(e.isIntersecting){{t.forEach(function(a){{a.classList.remove("on");}});var a=m[e.target.id];if(a)a.classList.add("on");}}}});}},{{rootMargin:"-20% 0px -70% 0px"}});
Object.keys(m).forEach(function(id){{var h=document.getElementById(id);if(h)o.observe(h);}});}})();
</script>
</body>
</html>
'''

PUBLISHER = {"@type": "Organization", "name": "Mark Talks Health", "url": SITE + "/",
             "logo": {"@type": "ImageObject", "url": SITE + "/assets/app-icon-512.png", "width": 512, "height": 512}}
def person():
    a = CFG["author"]
    return {"@type": "Person", "name": a["name"], "url": SITE + "/blog/author/%s/" % a["slug"],
            "image": SITE + a["photo"], "jobTitle": a["job"], "worksFor": {"@type": "Organization", "name": "Mark Talks Health", "url": SITE + "/"}}

def crumbs(items):
    return {"@type": "BreadcrumbList", "@context": "https://schema.org",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u} for i, (n, u) in enumerate(items)]}

def crumb_html(items):
    return '<nav class="crumbs" aria-label="Breadcrumb"><ol>%s</ol></nav>' % "".join(
        ('<li><a href="%s">%s</a></li>' % (esc(u), esc(n))) if i < len(items) - 1 else '<li aria-current="page">%s</li>' % esc(n)
        for i, (n, u) in enumerate(items))

def card(p, big=False):
    return ('<a class="pc%s" href="%s" data-cat="%s"><img src="%s" alt="" width="1200" height="630" loading="lazy">'
            '<div class="pc-b"><span class="pc-k">%s · %d min read</span><h3>%s</h3><p>%s</p>'
            '<span class="pc-m">%d studies cited · %s</span></div></a>'
            % (" big" if big else "", esc(p["url"]), esc(p.get("category") or ""), esc(p["_cover"]), esc(CFG["categories"].get(p.get("category"), "")),
               p["_mins"], esc(p["title"]), esc(p["description"]), len(p["_order"]), esc(fmt_date(p["updated"]))))

# ---------------------------------------------------------------- article page
def glance(p):
    st = [LIB[k] for k in p["_order"]]
    hum = sum(1 for x in st if x.get("humans")); ani = len(st) - hum
    yrs = [x["year"] for x in st]
    span = ("%d to %d" % (min(yrs), max(yrs))) if yrs and min(yrs) != max(yrs) else (str(yrs[0]) if yrs else "")
    cells = [("%d" % len(st), "studies cited"), ("%d · %d" % (hum, ani), "human · animal studies"),
             (span, "published"), ("%d min" % p["_mins"], "read")]
    return ('<div class="wrap"><div class="glance" aria-label="This article at a glance">%s'
            '<p>Every study is linked at the bottom, checked on %s. Where a result comes from animals, the article says so.</p></div></div>'
            % ("".join('<div><b>%s</b><span>%s</span></div>' % (esc(a), esc(b)) for a, b in cells), esc(fmt_date(p["updated"]))))

def article(p, posts):
    a, cat = CFG["author"], CFG["categories"].get(p.get("category"), "")
    refs = "".join(
        '<li id="ref-%d">%s <i>%s</i>. <span class="rj">%s</span>. %s;%s:%s. '
        '<a href="%s" target="_blank" rel="noopener">doi:%s</a> · <a href="%s" target="_blank" rel="noopener">PubMed</a> '
        '<a class="back" href="#cite-%d" aria-label="Back to text">↩</a></li>'
        % (i + 1, esc(s["authors"]), esc(s["title"]), esc(s["journal"]), s["year"], esc(s.get("volume", "")), esc(s.get("pages", "")),
           esc(doi_url(s)), esc(s["doi"]), esc(pubmed_url(s)), i + 1)
        for i, s in enumerate(LIB[k] for k in p["_order"]))
    rel_slugs = p.get("related") or []
    rel = [q for s in rel_slugs for q in posts if q["slug"] == s]
    rel += [q for q in posts if q is not p and q not in rel and q.get("category") == p.get("category")]
    rel += [q for q in posts if q is not p and q not in rel]
    rel = rel[:3]
    faq = p.get("faq") or []
    faq_html = ('<section class="faq" aria-labelledby="faq"><h2 id="faq">Common questions</h2>%s</section>'
                % "".join('<details><summary>%s</summary>%s</details>' % (esc(f["q"]), markdown.markdown(f["a"], extensions=["smarty"])) for f in faq)) if faq else ""
    toc = "".join('<li><a href="#%s">%s</a></li>' % (i, esc(t)) for i, t in p["_toc"])
    if faq: toc += '<li><a href="#faq">Common questions</a></li>'
    toc += '<li><a href="#sources">Sources</a></li>'
    items = [("Home", "/"), ("Blog", "/blog/"), (p["title"], p["url"])]
    body = f'''
<article class="post" itemscope>
<header class="ph wrap">
{crumb_html(items)}
<span class="kick">{esc(cat)}</span>
<h1 class="pt">{esc(p["title"])}</h1>
<p class="dek">{esc(p["description"])}</p>
<div class="by"><img src="{esc(a["photo"])}" alt="{esc(a["name"])}" width="44" height="44">
<div><a href="/blog/author/{esc(a["slug"])}/" rel="author">By {esc(a["name"])}</a><span>Updated <time datetime="{p["updated"]}">{fmt_date(p["updated"])}</time> · {p["_mins"]} min read · {len(p["_order"])} studies cited</span></div></div>
</header>
{glance(p)}
<div class="pgrid wrap">
<aside class="toc" aria-label="In this article"><span class="sec-k">In this article</span><ol>{toc}</ol></aside>
<div class="prose">
{p["_html"]}
{faq_html}
{cta_html(p)}
<section class="refs" aria-labelledby="sources"><h2 id="sources">Sources</h2>
<p class="small">Every study below was checked against the journal record on {fmt_date(p["updated"])}. Where a finding comes from animals, the article says so.</p>
<ol>{refs}</ol></section>
<aside class="author"><img src="{esc(a["photo"])}" alt="{esc(a["name"])}" width="96" height="96" loading="lazy">
<div><span class="sec-k">About the author</span><p class="an">{esc(a["name"])}</p><p>{esc(a["short"])}</p><a href="/blog/author/{esc(a["slug"])}/">More about Mark →</a></div></aside>
<p class="disc">This article is for education only and isn't medical advice. Talk to your doctor before fasting, changing your diet or changing any medication, especially if you're pregnant, have diabetes, take prescription medicine or have a history of disordered eating.</p>
</div></div>
</article>
{'<section class="more wrap"><h2 class="t">Keep reading</h2><div class="pcs">' + "".join(card(q) for q in rel) + '</div></section>' if rel else ''}
'''
    ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": p["title"][:110],
          "description": p["description"], "image": [SITE + p["_cover"]], "url": SITE + p["url"],
          "mainEntityOfPage": {"@type": "WebPage", "@id": SITE + p["url"]},
          "datePublished": p["date"], "dateModified": p["updated"], "author": person(), "publisher": PUBLISHER,
          "articleSection": cat, "keywords": ", ".join(p.get("tags") or []), "wordCount": p["_words"],
          "inLanguage": "en", "isAccessibleForFree": True,
          "citation": [{"@type": "ScholarlyArticle", "name": LIB[k]["title"], "url": doi_url(LIB[k]),
                        "datePublished": str(LIB[k]["year"]), "isPartOf": {"@type": "Periodical", "name": LIB[k]["journal"]}} for k in p["_order"]]}
    lds = [ld, crumbs(items)]
    if faq:
        lds.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": strip_tags(markdown.markdown(f["a"]))}} for f in faq]})
    return shell(p.get("seo_title") or p["title"], p["description"], p["url"], body, p["_cover"], lds,
                 noindex=p["status"] != "published", og_type="article",
                 extra_head='<meta property="article:published_time" content="%s">\n<meta property="article:modified_time" content="%s">\n' % (p["date"], p["updated"]))

# ---------------------------------------------------------------- index, author, feeds
def index_page(posts):
    b = CFG["blog"]
    pillar = next((q for q in posts if q.get("type") == "pillar"), posts[0] if posts else None)
    rest = [q for q in posts if q is not pillar]
    cats = sorted({q.get("category") for q in posts if q.get("category")})
    chips = '<button class="chip on" type="button" data-cat="">All</button>' + "".join(
        '<button class="chip" type="button" data-cat="%s">%s</button>' % (c, esc(CFG["categories"].get(c, c))) for c in cats)
    sections = ('<section class="cat" id="latest"><h2 class="t">Latest articles</h2><div class="pcs">%s</div></section>'
                % "".join(card(q) for q in rest)) if rest else ""
    body = f'''
<header class="bh wrap">{crumb_html([("Home", "/"), ("Blog", "/blog/")])}
<span class="kick">{esc(b["kicker"])}</span><h1 class="t">{b["headline"]}</h1><p class="lead">{esc(b["dek"])}</p>
<div class="formula"><span><b>1</b> The problem</span><span><b>2</b> The study</span><span><b>3</b> The solution</span></div>
{('<div class="chips" role="group" aria-label="Filter by topic">' + chips + '</div>') if len(cats) > 1 else ''}</header>
<div class="wrap">{('<section class="feat"><span class="sec-k">Start here</span>' + card(pillar, True) + '</section>') if pillar else '<p class="lead">The first articles are on their way.</p>'}
{sections}</div>
'''
    ld = {"@context": "https://schema.org", "@type": "Blog", "name": b["title"], "description": b["description"],
          "url": SITE + "/blog/", "publisher": PUBLISHER, "author": person(),
          "blogPost": [{"@type": "BlogPosting", "headline": q["title"][:110], "url": SITE + q["url"], "datePublished": q["date"]} for q in posts]}
    any_draft = any(q["status"] != "published" for q in posts)
    return shell(b["seo_title"] + " · Mark Talks Health", b["description"], "/blog/", body, "/blog/img/blog.jpg",
                 [ld, crumbs([("Home", "/"), ("Blog", "/blog/")])], noindex=any_draft or not posts)

def author_page(posts):
    a = CFG["author"]
    bio = markdown.markdown(a["bio"], extensions=["smarty"])
    body = f'''
<header class="bh wrap">{crumb_html([("Home", "/"), ("Blog", "/blog/"), (a["name"], "/blog/author/%s/" % a["slug"])])}</header>
<div class="wrap aut"><img src="{esc(a["photo"])}" alt="{esc(a["name"])}" width="320" height="320">
<div><span class="kick">About the author</span><h1 class="t">{esc(a["name"])}</h1><p class="small">{esc(a["job"])}</p><div class="prose">{bio}</div>
<p><a class="b" href="/healing">How my healing method works</a></p></div></div>
<section class="more wrap"><h2 class="t">Articles by {esc(a["name"])}</h2><div class="pcs">{"".join(card(q) for q in posts)}</div></section>
'''
    ld = {"@context": "https://schema.org", "@type": "ProfilePage", "mainEntity": person(), "url": SITE + "/blog/author/%s/" % a["slug"]}
    any_draft = any(q["status"] != "published" for q in posts)
    return shell("%s · %s" % (a["name"], a["job"]), a["short"], "/blog/author/%s/" % a["slug"], body, "/blog/img/blog.jpg", [ld],
                 noindex=any_draft or not posts)

def blog_cover():
    fake = {"slug": "blog", "title": "Research you can *actually use*", "category": None, "_order": [], "_mins": 0}
    W, H = 1200, 630
    path = cover(dict(fake, cover_title="Research you can *actually use*"))
    im = Image.open(os.path.join(OUT, "img", "blog.jpg")); d = ImageDraw.Draw(im)
    d.rectangle([60, 500, 700, 600], fill=im.getpixel((65, 505)))
    d.text((70, 512), "Gut health, fasting & natural healing, explained", font=font("inter-latin-500-normal.ttf", 21), fill="#6e6259")
    d.text((70, 545), "The problem. The study. The solution.", font=font("cormorant-garamond-latin-500-italic.ttf", 28), fill="#7a8f6e")
    d.rectangle([60, 70, 700, 105], fill=im.getpixel((65, 75)))
    fk = font("inter-latin-700-normal.ttf", 19); cx = 70
    for ch in "THE BLOG  ·  MARK TALKS HEALTH": d.text((cx, 78), ch, font=fk, fill="#c0623f"); cx += d.textlength(ch, font=fk) + 2.6
    im.save(os.path.join(OUT, "img", "blog.jpg"), "JPEG", quality=86, optimize=True, progressive=True)

def feeds(posts, drafts):
    today = datetime.date.today().isoformat()
    pub = [q for q in posts if q["status"] == "published"]
    urls = ['<url><loc>%s%s</loc><priority>%.1f</priority></url>' % (SITE, x["path"], x["priority"]) for x in CFG["pages"]]
    if pub:
        urls.append('<url><loc>%s/blog/</loc><lastmod>%s</lastmod><priority>0.8</priority></url>' % (SITE, max(q["updated"] for q in pub)))
        urls.append('<url><loc>%s/blog/author/%s/</loc><priority>0.4</priority></url>' % (SITE, CFG["author"]["slug"]))
    for q in pub:
        urls.append('<url><loc>%s%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>' % (SITE, q["url"], q["updated"], "0.9" if q.get("type") == "pillar" else "0.7"))
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % "\n".join(urls)
    robots = "# Mark Talks Health\nUser-agent: *\n%s\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % ("\n".join("Disallow: " + d for d in CFG["robots_disallow"]), SITE)
    items = "".join('<item><title>%s</title><link>%s%s</link><guid isPermaLink="true">%s%s</guid><pubDate>%s</pubDate><description>%s</description></item>'
                    % (esc(q["title"]), SITE, q["url"], SITE, q["url"],
                       datetime.datetime.fromisoformat(q["date"]).strftime("%a, %d %b %Y 12:00:00 +0000"), esc(q["description"])) for q in pub)
    rss = ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>%s</title><link>%s/blog/</link><description>%s</description><language>en</language>%s</channel></rss>\n'
           % (esc(CFG["blog"]["title"]), SITE, esc(CFG["blog"]["description"]), items))
    wr(os.path.join(WWW, "sitemap.xml"), sitemap); wr(os.path.join(WWW, "robots.txt"), robots); wr(os.path.join(OUT, "feed.xml"), rss)
    # the shared index other tools (documentary builder, admin, social studios) read
    idx = [{"slug": q["slug"], "url": SITE + q["url"], "title": q["title"], "description": q["description"], "status": q["status"],
            "category": q.get("category"), "type": q.get("type"), "date": q["date"], "updated": q["updated"],
            "studies": q["_order"], "sections": q.get("_sections", []), "words": q["_words"], "tags": q.get("tags") or []} for q in posts]
    wr(os.path.join(OUT, "posts.json"), json.dumps({"built": today, "drafts_included": drafts, "posts": idx}, indent=1))

def main():
    drafts = "--drafts" in sys.argv
    if os.path.isdir(OUT):
        import shutil; shutil.rmtree(OUT)
    posts = load_posts(drafts)
    for p in posts: p["_html"] = render_body(p)
    for p in posts:
        if p["status"] == "published" and p["_todo"]:
            sys.exit("%s is marked published but still has [[MARK: ...]] notes to fill in." % p["file"])
        p["_cover"] = cover(p)
    for p in posts: wr(os.path.join(OUT, p["slug"], "index.html"), article(p, posts))
    blog_cover()
    wr(os.path.join(OUT, "index.html"), index_page(posts))
    wr(os.path.join(OUT, "author", CFG["author"]["slug"], "index.html"), author_page(posts))
    feeds(posts, drafts)
    print("Built %d article(s)%s into www/blog/" % (len(posts), " incl. drafts" if drafts else ""))
    for p in posts: print("  %-9s %-48s %5d words  %2d studies  %s" % (p["status"], p["slug"], p["_words"], len(p["_order"]), ("TODO x%d" % len(p["_todo"])) if p["_todo"] else ""))

if __name__ == "__main__":
    main()
