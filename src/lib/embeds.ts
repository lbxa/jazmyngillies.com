/**
 * Player configuration for every embed on the site, in one place.
 *
 * Both providers draw their own chrome over the video, and at tile size that
 * chrome is most of what you see. These builders exist so the settings are
 * decided once rather than drifting between call sites.
 */

const query = (params: Record<string, string>): string =>
  new URLSearchParams(params).toString();

/**
 * TikTok's default control bar covers a meaningful share of a 9:16 tile, so
 * everything that is not the play affordance is switched off.
 *
 * `controls=0` removes the bar but NOT the timestamp -- that has its own flag
 * and keeps rendering bottom-left without it.
 *
 * The author header, wordmark and like/comment/share rail have no flags at all
 * and always draw. That suits this grid: the engagement numbers are a large
 * part of what the work is being shown for.
 */
const TIKTOK_PARAMS: Record<string, string> = {
  controls: "0",
  timestamp: "0",
  description: "0",
  music_info: "0",
  closed_caption: "0",
  native_context_menu: "0",
  rel: "0",
  loop: "1",
};

export const tiktokPlayerSrc = (videoId: string): string =>
  `https://www.tiktok.com/player/v1/${videoId}?${query(TIKTOK_PARAMS)}`;

/**
 * Long-form runs the opposite way to the TikTok tiles: a three-minute video
 * needs a scrubber, volume and fullscreen, so YouTube's controls stay.
 *
 * `rel=0` keeps end-of-video suggestions inside the same channel instead of
 * handing the viewer off to unrelated content, `color=white` drops YouTube's
 * red progress bar for something that sits with the rest of the site, and the
 * nocookie host holds off tracking cookies until the viewer actually plays.
 *
 * Deliberately no `modestbranding` -- YouTube retired it, and it never removed
 * the title bar or the "Watch on YouTube" button that people reach for it for.
 */
const YOUTUBE_PARAMS: Record<string, string> = {
  rel: "0",
  playsinline: "1",
  color: "white",
};

export const youtubeEmbedSrc = (videoId: string): string =>
  `https://www.youtube-nocookie.com/embed/${videoId}?${query(YOUTUBE_PARAMS)}`;
