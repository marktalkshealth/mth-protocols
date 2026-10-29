# Mark Talks Health blog

Lives at **marktalkshealth.com/blog/**. Source here; built pages go to `www/blog/`.

## The formula (every article)
1. **Hook + My story**: one real line from Mark (`::: story`).
2. **[Problem]**: what's going wrong and how common it is, with a study.
3. **[Study]**: the research, as study cards (`::: study key`) that always show the limits.
4. **[Solution]**: what to actually do, step by step, with a course box (`::: cta`).
5. **[Bottom] line**, FAQ, Sources (built automatically from the citations).

## Shared brain
`research/studies.json` is the one verified study library. Articles cite studies by key (`[^wastyk2021]`).
The documentary builder, social studios and courses should read the same file, so every channel says the
same thing about the same study. `www/blog/posts.json` lists every article, its studies and sections.

## Workflow (Claude runs this)
1. Research: verify each study (title, journal, year, DOI; PMID only when confirmed). Add it to `research/studies.json`
   with a plain-language `finding` and an honest `caveat`. Never quote; paraphrase.
2. Write `blog/posts/<slug>.md` with `status: draft`. Leave `[[MARK: ...]]` wherever Mark's own story belongs.
3. `python3 tools/build_blog.py --drafts` then `python3 tools/check_blog.py` (0 problems needed).
4. Preview: publish to the `blog-preview` branch of mth-site → Mark reviews.
5. Mark approves → set `status: published`, set `date`/`updated`, remove `[[MARK:]]` notes, build **without** `--drafts`,
   check, merge into `own-site-mvp`, run `tools/publish_site.sh`.
6. GitHub runs `.github/workflows/blog-check.yml` on every change: it checks every DOI at Crossref and every PMID at PubMed.

## Rules the checker enforces
SEO title ≤ 60 characters · description 120–160 · Problem/Study/Solution sections · at least 3 studies ·
animal studies must say so in the text · banned words (keto, ice cream) · no unfilled notes when published ·
one H1, alt text, canonical, Open Graph, valid structured data · no broken internal links · drafts hidden from Google
and the sitemap.
