#!/bin/sh
# Copies the own site (own-site-mvp branch: www/ + the three protocol apps + hub page)
# into the mth-site repo, which GitHub Pages serves at marktalkshealth.com.
# Usage: tools/publish_site.sh /path/to/mth-site
set -e
SRC=$(cd "$(dirname "$0")/.." && pwd); DST="$1"
[ -d "$DST/.git" ] || { echo "usage: $0 /path/to/mth-site"; exit 1; }
find "$DST" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$SRC/www/." "$DST/"
rm -f "$DST/README.md"
for d in gut sugar glp1 hub; do mkdir -p "$DST/$d"; cp "$SRC/$d/index.html" "$DST/$d/"; done
sed -i 's|fr.src="../"+DIR|fr.src=DIR|' "$DST/app.html"
sed -i 's|src="../hub/index.html"|src="hub/index.html"|' "$DST/community.html"
echo "marktalkshealth.com" > "$DST/CNAME"
touch "$DST/.nojekyll"
printf '# Mark Talks Health — marktalkshealth.com\n\nPublished copy of the own site. Do not edit here: edit `www/` (and gut/sugar/glp1/hub) on the `own-site-mvp` branch of marktalkshealth/mth-protocols, then run `tools/publish_site.sh`.\n' > "$DST/README.md"
