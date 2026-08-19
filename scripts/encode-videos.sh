#!/usr/bin/env bash
# Trims the raw exports in videos/ into web-ready background clips in public/videos/.
#
# These play as muted, cropped, gradient-overlaid background loops, which is why
# audio is stripped and the resolution is capped at 720p. CRF alone can't bound
# file size on high-motion music video content, so -maxrate/-bufsize caps the
# worst case while low-motion clips stay CRF-driven and small.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="videos"
OUT="public/videos"

CLIP_SECONDS=30
HEIGHT=720
CRF=28
MAXRATE=1200k
BUFSIZE=2400k
POSTER_WIDTH=1024
POSTER_QUALITY=60

mkdir -p "$OUT"

# source-filename-fragment : output-slug
map=(
  "Tate-McRae:tate-mcrae-its-ok-im-ok"
  "Childish-Gambino:childish-gambino-lithonia"
  "Megan-Thee-Stallion:megan-thee-stallion-roc-steady"
  "LISA-ALTER-EGO:lisa-alter-ego"
  "Starley-PEACE:starley-peace"
)

for entry in "${map[@]}"; do
  pattern="${entry%%:*}"
  slug="${entry##*:}"
  src=$(find "$SRC" -maxdepth 1 -name "*${pattern}*.mp4" | head -1)

  if [ -z "$src" ]; then
    echo "!! no source matched '$pattern' in $SRC/" >&2
    exit 1
  fi

  ffmpeg -nostdin -y -v error \
    -i "$src" \
    -t "$CLIP_SECONDS" \
    -vf "scale=-2:${HEIGHT}" \
    -c:v libx264 -crf "$CRF" -preset veryslow \
    -maxrate "$MAXRATE" -bufsize "$BUFSIZE" \
    -profile:v high -level 4.0 -pix_fmt yuv420p \
    -g 48 \
    -an \
    -movflags +faststart \
    "$OUT/${slug}.mp4"

  # Poster placeholder, taken from the encoded clip so it matches exactly.
  # Only the first clip's poster is ever displayed (later frames only become
  # visible once their video is already decoding), so this is kept small.
  ffmpeg -nostdin -y -v error \
    -ss 1 -i "$OUT/${slug}.mp4" \
    -frames:v 1 -f image2pipe -vcodec png - 2>/dev/null |
    cwebp -quiet -q "$POSTER_QUALITY" -resize "$POSTER_WIDTH" 0 -o "$OUT/${slug}.webp" -- - 

  printf "%-34s %8s  %s\n" "$slug" \
    "$(du -h "$OUT/${slug}.mp4" | cut -f1)" \
    "$(du -h "$OUT/${slug}.webp" | cut -f1) poster"
done

echo "---"
du -sh "$OUT"
