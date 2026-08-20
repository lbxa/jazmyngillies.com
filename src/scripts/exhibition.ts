type Teardown = () => void;

/**
 * Drives the long-form carousel: ambient playback for the card in view, and
 * arrows for pointers that cannot scroll sideways.
 *
 * Scroll snapping and the scrolling itself are CSS. This only reacts to it.
 */
export const initExhibition = (root: HTMLElement): Teardown => {
  const track = root.querySelector<HTMLElement>("[data-exhibit-track]");
  const cards = Array.from(
    root.querySelectorAll<HTMLElement>("[data-exhibit-card]"),
  );

  if (!track || cards.length === 0) {
    return () => undefined;
  }

  const previous = root.querySelector<HTMLButtonElement>("[data-exhibit-prev]");
  const next = root.querySelector<HTMLButtonElement>("[data-exhibit-next]");

  // A clip that starts playing because the page moved is exactly the kind of
  // motion this setting exists to stop, so those cards stay on their poster.
  const stillness = window.matchMedia("(prefers-reduced-motion: reduce)");

  const syncArrows = () => {
    // scrollLeft is fractional at snap points, so compare with a pixel of slack
    // rather than exactly.
    const maxScroll = track.scrollWidth - track.clientWidth;

    previous?.toggleAttribute("disabled", track.scrollLeft <= 1);
    next?.toggleAttribute("disabled", track.scrollLeft >= maxScroll - 1);
  };

  /**
   * Publishes the vertical middle of the artwork so the arrows can sit against
   * it instead of against the track.
   *
   * A fixed percentage does not work: when the card is taller than the track it
   * anchors to the top and the still's midpoint lands around 35%, but when it
   * fits the card centres and the midpoint climbs. Splitting the difference put
   * the arrows over the caption on a phone. Only the first card is measured --
   * every card shares a width, so they all share a height.
   */
  const syncArrowOffset = () => {
    const media = cards[0].firstElementChild;

    if (!media) {
      return;
    }

    const middle =
      media.getBoundingClientRect().top +
      media.getBoundingClientRect().height / 2 -
      track.getBoundingClientRect().top;

    root.style.setProperty("--exhibit-arrow-top", `${Math.round(middle)}px`);
  };

  const resync = () => {
    syncArrows();
    syncArrowOffset();
  };

  // This panel starts life in a hidden tab, where the track measures 0x0 and
  // every arrow reads as "nothing to scroll". Watching the box re-runs both
  // checks the moment the tab is revealed, and again whenever a resize changes
  // the card width.
  const resizeObserver = new ResizeObserver(resync);

  resizeObserver.observe(track);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const card = entry.target as HTMLElement;
        const video = card.querySelector("video");

        if (entry.isIntersecting) {
          // Rejects when the browser declines to autoplay. Nothing to recover
          // from -- the poster is already showing.
          if (!stillness.matches) {
            void video?.play().catch(() => undefined);
          }
        } else {
          video?.pause();
        }
      }
    },
    { root: track, threshold: 0.6 },
  );

  cards.forEach((card) => observer.observe(card));

  const step = (direction: 1 | -1) => () => {
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;

    track.scrollBy({
      left: direction * (cards[0].getBoundingClientRect().width + gap),
      behavior: stillness.matches ? "auto" : "smooth",
    });
  };

  const goNext = step(1);
  const goPrevious = step(-1);

  next?.addEventListener("click", goNext);
  previous?.addEventListener("click", goPrevious);
  // Only the disabled state changes while scrolling; the offset is fixed until
  // something resizes.
  track.addEventListener("scroll", syncArrows, { passive: true });

  resync();

  return () => {
    observer.disconnect();
    resizeObserver.disconnect();
    next?.removeEventListener("click", goNext);
    previous?.removeEventListener("click", goPrevious);
    track.removeEventListener("scroll", syncArrows);
    cards.forEach((card) => card.querySelector("video")?.pause());
  };
};
