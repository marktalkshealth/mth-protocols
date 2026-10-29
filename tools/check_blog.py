#!/usr/bin/env python3
"""Tests the built blog. Run after tools/build_blog.py.

    python3 tools/check_blog.py            # offline checks (run anywhere)
    python3 tools/check_blog.py --online   # also checks every study against Crossref and PubMed
                                           # (runs automatically on GitHub; needs internet)
Exit code 1 = something must be fixed before publishing. Warnings don't block.
"""
import difflib, glob, html, json, os, re, sys, time, urllib.request, urllib.parse
from html.parser import HTMLParser
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WWW = os.path.join(ROOT, "www")
CFG = yaml.safe_load(open(os.path.join(ROOT, "blog", "config.yml"), encoding="utf-8"))
LIB = json.load(open(os.path.join(ROOT, "research", "studies.json"), encoding="utf-8"))["studies"]
errors, warns = [], []
def err(where, msg): errors.append("%s: %s" % (where, msg))
def warn(where, msg): warns.append("%s: %s" % (where, msg))

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.tags = []; self.ld = []; self._ld = None; self.h1 = 0; self.text = []; self._skip = 0
    def handle_starttag(self, t, a):
        a = dict(a); self.tags.append((t, a))
        if t == "h1": self.h1 += 1
        if t == "script" and a.get("type") == "application/ld+json": self._ld = ""
        if t in ("script", "style"): self._skip += 1
    def handle_endtag(self, t):
        if t == "script" and self._ld is not None: self.ld.append(self._ld); self._ld = None
        if t in ("script", "style"): self._skip -= 1
    def handle_data(self, d):
        if self._ld is not None: self._ld += d
        elif not self._skip: self.text.append(d)

def local_file(url):
    u = urllib.parse.urlparse(url).path
    if u.startswith("/media/site/"): return os.path.join(ROOT, "site", u[12:])
    if u.startswith("/media/shared/"): return os.path.join(ROOT, "shared", u[14:])
    f = os.path.join(WWW, u.lstrip("/"))
    if u.endswith("/"): return f + "index.html"
    if os.path.splitext(f)[1] == "": return f + ".html"     # Cloudflare serves /gut from gut.html
    return f

# ---------------------------------------------------------------- study library
for k, s in LIB.items():
    for f in ("authors", "title", "journal", "year", "doi", "finding", "caveat", "type", "verified"):
        if not s.get(f): err("studies.json/" + k, "missing '%s'" % f)
    if s.get("doi") and not re.match(r"^10\.\d{4,9}/\S+$", s["doi"]): err("studies.json/" + k, "DOI looks wrong: " + s["doi"])
    if "humans" not in s: err("studies.json/" + k, "say whether it's a human study (humans: true/false)")

# ---------------------------------------------------------------- source articles
banned = [w.lower() for w in CFG.get("banned_words", [])]
posts = {}
for f in sorted(glob.glob(os.path.join(ROOT, "blog", "posts", "*.md"))):
    raw = open(f, encoding="utf-8").read(); name = os.path.basename(f)
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
    fm = yaml.safe_load(m.group(1)); body = m.group(2); slug = fm.get("slug", name[:-3]); posts[slug] = fm
    fm["_body"] = body
    if fm.get("status") not in ("draft", "published"): err(name, "status must be draft or published")
    seo = fm.get("seo_title") or fm.get("title", "")
    if len(seo) > 62: err(name, "SEO title is %d characters (keep it to 60 so Google doesn't cut it)" % len(seo))
    d = fm.get("description", "")
    if not 110 <= len(d) <= 160: err(name, "description is %d characters (aim for 120 to 160)" % len(d))
    labels = {x.lower() for x in re.findall(r"^##\s+\[(\w+)\]", body, re.M)}
    for need in ("problem", "study", "solution"):
        if need not in labels: err(name, "missing a '## [%s] ...' section (the article formula)" % need.capitalize())
    keys = set(re.findall(r"\[\^([a-z0-9_-]+)\]", body)) | set(re.findall(r"^:::\s*study\s+([a-z0-9_-]+)", body, re.M))
    for k in keys:
        if k not in LIB: err(name, "cites unknown study '%s'" % k)
    if len(keys) < 3: err(name, "only %d studies cited (minimum 3)" % len(keys))
    animal = [k for k in keys if k in LIB and not LIB[k].get("humans")]
    for k in animal:
        if not re.search(r"\b(mice|mouse|animal|rats?)\b", body, re.I): err(name, "cites animal study %s but never tells readers it was in animals" % k)
    low = body.lower()
    for w in banned:
        if re.search(r"\b%s\b" % re.escape(w), low): err(name, "uses the word '%s' (brand rule)" % w)
    todo = re.findall(r"\[\[MARK:(.*?)\]\]", body, re.S)
    if todo:
        (err if fm.get("status") == "published" else warn)(name, "%d note(s) for Mark still to fill in" % len(todo))
    if fm.get("cta") and fm["cta"] not in CFG["ctas"]: err(name, "unknown cta '%s'" % fm["cta"])
    if fm.get("category") not in CFG["categories"]: err(name, "unknown category '%s'" % fm.get("category"))
    words = len(re.findall(r"[A-Za-z']+", re.sub(r"^---.*?---", "", body, flags=re.S)))
    floor = 1800 if fm.get("type") == "pillar" else 1100
    if words < floor: warn(name, "%d words; in-depth %s articles should be %d+" % (words, fm.get("type", "supporting"), floor))
    if not re.search(r"\]\(/blog/[a-z0-9-]+/\)", body): warn(name, "no links to other blog articles (internal links help Google)")
    for link in re.findall(r"\]\((/blog/[a-z0-9-]+/)\)", body):
        if link.split("/")[2] not in [os.path.basename(x)[:-3] for x in glob.glob(os.path.join(ROOT, "blog", "posts", "*.md"))]:
            err(name, "links to an article that doesn't exist: " + link)
    if not fm.get("faq"): warn(name, "no FAQ (FAQs help people and search engines)")

# ---------------------------------------------------------------- built pages
built = glob.glob(os.path.join(WWW, "blog", "**", "index.html"), recursive=True)
if not built: err("www/blog", "nothing built yet; run tools/build_blog.py first")
for f in built:
    rel = os.path.relpath(f, WWW); src = open(f, encoding="utf-8").read()
    pg = Page(); pg.feed(src)
    if pg.h1 != 1: err(rel, "has %d <h1> headings (needs exactly 1)" % pg.h1)
    metas = {(a.get("name") or a.get("property")): a.get("content") for t, a in pg.tags if t == "meta"}
    for need in ("description", "og:title", "og:image", "og:description", "twitter:card"):
        if not metas.get(need): err(rel, "missing <meta %s>" % need)
    if not any(t == "link" and a.get("rel") == "canonical" for t, a in pg.tags): err(rel, "missing canonical link")
    if "&amp;rsquo;" in src or "&amp;amp;" in src: err(rel, "double-escaped text (shows as &rsquo; on the page)")
    for t, a in pg.tags:
        if t == "img" and "alt" not in a: err(rel, "image without alt text: " + a.get("src", "?"))
        for attr in ("href", "src"):
            u = a.get(attr)
            if not u or not u.startswith("/") or u.startswith("//"): continue
            if not os.path.exists(local_file(u)): err(rel, "broken link %s" % u)
        if t == "a" and (a.get("href") or "").startswith("#"):
            target = a["href"][1:]
            if target and ('id="%s"' % target) not in src: err(rel, "jump link to missing #%s" % target)
    for block in pg.ld:
        try:
            j = json.loads(block)
            if j.get("@type") == "BlogPosting":
                for need in ("headline", "image", "datePublished", "dateModified", "author", "publisher", "citation"):
                    if not j.get(need): err(rel, "BlogPosting data missing '%s'" % need)
                if len(j.get("headline", "")) > 110: err(rel, "headline over 110 characters")
        except Exception as e:
            err(rel, "structured data (JSON-LD) doesn't parse: %s" % e)
    if "/blog/" in rel and rel.count("/") == 2 and "author" not in rel:   # an article page
        if not any(json.loads(b).get("@type") == "BlogPosting" for b in pg.ld): err(rel, "no BlogPosting structured data")
        if 'id="sources"' not in src: err(rel, "no Sources section")
        draft = 'content="noindex' in src
        slug = rel.split("/")[1]
        if posts.get(slug, {}).get("status") == "published" and draft: err(rel, "published article is marked noindex")
        if posts.get(slug, {}).get("status") == "draft" and not draft: err(rel, "draft article is visible to Google")

# ---------------------------------------------------------------- sitemap / robots / feed
sm = open(os.path.join(WWW, "sitemap.xml"), encoding="utf-8").read() if os.path.exists(os.path.join(WWW, "sitemap.xml")) else ""
if not sm: err("sitemap.xml", "missing")
for slug, fm in posts.items():
    inmap = ("/blog/%s/" % slug) in sm
    if fm.get("status") == "published" and not inmap: err("sitemap.xml", "published article %s isn't listed" % slug)
    if fm.get("status") != "published" and inmap: err("sitemap.xml", "draft %s is listed" % slug)
for loc in re.findall(r"<loc>https://[^/]+(/[^<]*)</loc>", sm):
    if not os.path.exists(local_file(loc)): err("sitemap.xml", "lists a page that doesn't exist: " + loc)
rb = open(os.path.join(WWW, "robots.txt"), encoding="utf-8").read() if os.path.exists(os.path.join(WWW, "robots.txt")) else ""
if "Sitemap:" not in rb: err("robots.txt", "missing or has no Sitemap line")
for line in rb.splitlines():
    if line.startswith("Disallow:") and line.split(":", 1)[1].strip() in ("/", "/blog", "/blog/"): err("robots.txt", "blocks the blog: " + line)

# ---------------------------------------------------------------- online: every study is real and matches
def get(url, accept="application/json"):
    req = urllib.request.Request(url, headers={"User-Agent": "MarkTalksHealth-citation-check/1.0 (mailto:marktalkshealth@gmail.com)", "Accept": accept})
    with urllib.request.urlopen(req, timeout=25) as r: return r.read().decode("utf-8", "replace")
def norm(s): return re.sub(r"[^a-z0-9 ]", "", html.unescape(re.sub(r"<[^>]+>", "", s)).lower())
if "--online" in sys.argv:
    used = set()
    for fm in posts.values():
        used |= set(re.findall(r"\[\^([a-z0-9_-]+)\]", fm["_body"])) | set(re.findall(r"^:::\s*study\s+([a-z0-9_-]+)", fm["_body"], re.M))
    for k in sorted(used):
        s = LIB.get(k)
        if not s: continue
        try:
            cr = json.loads(get("https://api.crossref.org/works/" + urllib.parse.quote(s["doi"])))["message"]
            title = (cr.get("title") or [""])[0]; year = (cr.get("issued", {}).get("date-parts") or [[None]])[0][0]
            ratio = difflib.SequenceMatcher(None, norm(title), norm(s["title"])).ratio()
            if ratio < 0.85: err("study " + k, "DOI %s points to '%s', not our title (match %.0f%%)" % (s["doi"], title, ratio * 100))
            if year and abs(int(year) - int(s["year"])) > 1: err("study " + k, "Crossref year %s vs ours %s" % (year, s["year"]))
            print("  ok  %-14s doi  %s" % (k, s["doi"]))
        except Exception as e:
            err("study " + k, "DOI %s didn't resolve at Crossref (%s)" % (s["doi"], e))
        if s.get("pmid"):
            try:
                j = json.loads(get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=" + s["pmid"]))
                t = j["result"][s["pmid"]]["title"]
                ratio = difflib.SequenceMatcher(None, norm(t), norm(s["title"])).ratio()
                if ratio < 0.85: err("study " + k, "PMID %s is '%s', not our title" % (s["pmid"], t))
                else: print("  ok  %-14s pmid %s" % (k, s["pmid"]))
            except Exception as e:
                err("study " + k, "PMID %s check failed (%s)" % (s["pmid"], e))
            time.sleep(0.4)                                   # PubMed allows ~3 requests a second

# ---------------------------------------------------------------- report
for w in warns: print("WARN  " + w)
for e in errors: print("FAIL  " + e)
print("\n%d problem(s), %d warning(s) across %d article(s) and %d built page(s)." % (len(errors), len(warns), len(posts), len(built)))
sys.exit(1 if errors else 0)
