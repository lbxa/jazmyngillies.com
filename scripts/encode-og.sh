#!/usr/bin/env bash
# Builds the 1200x630 link-preview cards.
#
# These are what the site looks like when someone texts it, so they are their
# own artefact rather than a reused page image: a square headshot or a 16:9
# still cropped to 1.91:1 would either lose the face or letterbox.
#
# JPEG, not WebP -- the WebP the site serves is smaller, but several previewers
# (iMessage's older path, some Android SMS clients, LinkedIn) silently show
# nothing for it, and a blank card is worse than a few extra KB.
#
#   ./scripts/encode-og.sh
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="public/og"
mkdir -p "$OUT"

# Arial Black rather than the system UI font the site uses: SFNS.ttf is a
# variable font and freetype renders it at regular weight, which reads nothing
# like the wordmark.
FONT="/System/Library/Fonts/Supplemental/Arial Black.ttf"
CREAM="0xf4efe6"

# The photo takes the right 45%; the type sits on flat black to its left. A hard
# edge rather than a gradient -- it matches how stark the site itself is.
PHOTO_W=540
PHOTO_X=660

card() {
  local src="$1" out="$2" label="$3"

  ffmpeg -y -v error \
    -f lavfi -i "color=c=black:s=1200x630" \
    -i "$src" \
    -filter_complex "
      [1:v]scale=${PHOTO_W}:630:force_original_aspect_ratio=increase,crop=${PHOTO_W}:630,setsar=1[photo];
      [0:v][photo]overlay=${PHOTO_X}:0[bg];
      [bg]drawtext=fontfile='${FONT}':text='JAZMYN':x=76:y=214:fontsize=104:fontcolor=${CREAM},
          drawtext=fontfile='${FONT}':text='GILLIES':x=76:y=318:fontsize=104:fontcolor=${CREAM},
          drawtext=fontfile='${FONT}':text='${label}':x=80:y=452:fontsize=19:fontcolor=${CREAM}@0.45[out]
    " \
    -map "[out]" -frames:v 1 -q:v 2 "$OUT/$out"

  printf "%-22s %8s\n" "$out" "$(du -h "$OUT/$out" | cut -f1)"
}

# drawtext has no letter-spacing, so the wide tracking on the site's small caps
# is faked with literal spaces.
# All three use the portrait. The video posters were the obvious alternative for
# the portfolio card, but every one of them is a tight close-up or reads oddly
# with no context -- the Megan Thee Stallion still is a newspaper front page
# reading "MURDERS AT RSH SCHOOL", which is not what should land in someone's
# messages. Swap a source in here if a wider frame gets encoded later.
card "images/profile.jpg" "og-default.jpg" "P R O D U C T I O N   /   C R E A T I V E   A S S I S T"
card "images/profile.jpg" "og-portfolio.jpg" "P O R T F O L I O"
card "images/profile.jpg" "og-about.jpg" "A B O U T"
