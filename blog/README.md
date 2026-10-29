# Mark Talks Health blog

Lives at **marktalkshealth.com/blog/**. Mark writes and edits articles in **Admin -> Edit -> Blog**.

## How it works
- Articles are rows in Supabase (`mth_blog_posts`). Drafts are visible only to Mark; "Make it live" publishes.
- `www/functions/blog/[[path]].js` (a Cloudflare Pages Function) draws `/blog/` and `/blog/<slug>/` as real HTML
  straight from Supabase, so a Save shows on the site within about a minute and Google sees the full text.
- `www/functions/sitemap.xml.js` serves `/sitemap.xml` with every live article.
- `www/assets/blog-render.mjs` is the one template, used by the website and by the admin editor.

## The style (every article)
A plain title, one study (PubMed screenshot, citation, link), then 5 to 7 flowing paragraphs:
what the study did, what it found, why it matters, its limits, what to take from it.
No subheadings, no step lists, no personal story, no sales pitch: one small course link at the end.

## Research
`research/studies.json` is the verified study library (paraphrase, never quote; say when a study is in animals).
`blog/seed_posts.py` holds the first three articles as they were first loaded.
