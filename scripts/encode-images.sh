#!/usr/bin/env bash
# Turns a raw photo export into the webp pair the site serves.
#
# Two widths rather than one: the headshot is displayed around 500px wide, so a
# single 1280px file wastes roughly 4x the bytes on phones while a single 640px
# file is visibly soft on retina. The <img srcset> picks between them.
#
# Source masters live in images/ and are never served, mirroring how videos/
# holds the raw exports that public/videos/ is encoded from.
#
#   ./scripts/encode-images.sh images/profile.jpg jazmyn-headshot
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="public/images"

src="${1:?usage: encode-images.sh <source-image> <output-slug>}"
slug="${2:?usage: encode-images.sh <source-image> <output-slug>}"

# Photographic content with skin tones -- q60 (what the video posters use) bands
# visibly across the out-of-focus wall, so this runs higher.
QUALITY=76

mkdir -p "$OUT"

for width in 640 1280; do
  cwebp -quiet -q "$QUALITY" -resize "$width" 0 -o "$OUT/${slug}-${width}.webp" -- "$src"
  printf "%-32s %8s\n" "${slug}-${width}.webp" "$(du -h "$OUT/${slug}-${width}.webp" | cut -f1)"
done
