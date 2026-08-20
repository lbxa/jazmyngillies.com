type Teardown = () => void;

/**
 * Mounts embed players as their tiles approach the viewport.
 *
 * Provider-agnostic on purpose: each tile carries its own fully-built `src`
 * from `src/lib/embeds.ts`, so this only decides *when* a player loads, never
 * how it is configured.
 */
export const initLazyEmbeds = (scroller: HTMLElement): Teardown => {
  const slots = Array.from(
    scroller.querySelectorAll<HTMLElement>("[data-embed]"),
  );

  if (slots.length === 0) {
    return () => undefined;
  }

  const mount = (slot: HTMLElement) => {
    if (slot.dataset.mounted === "true") {
      return;
    }

    slot.dataset.mounted = "true";

    const frame = document.createElement("iframe");

    frame.src = slot.dataset.embedSrc ?? "";
    frame.title = slot.dataset.embedTitle ?? "Embedded video";
    frame.loading = "lazy";
    frame.allow = "encrypted-media; fullscreen; picture-in-picture";
    frame.setAttribute("allowfullscreen", "");
    frame.className = "absolute inset-0 h-full w-full border-0";

    slot.append(frame);
  };

  if (!("IntersectionObserver" in window)) {
    slots.forEach(mount);
    return () => undefined;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        mount(entry.target as HTMLElement);
        // Mount-once: unmounting on exit would tear down playback state and
        // re-pay the load cost every time a tile scrolls back into view.
        observer.unobserve(entry.target);
      }
    },
    {
      // The grid scrolls inside its own element, not the page. Leaving this as
      // the viewport would make rootMargin useless -- an ancestor's overflow
      // clip is applied *before* the margin, so nothing below the container's
      // bottom edge would ever be treated as approaching.
      root: scroller,
      rootMargin: "700px 0px",
    },
  );

  // Tiles inside a hidden tab panel have no box, so they never intersect and
  // never load. Revealing the panel gives them one and the observer fires on
  // its own -- which is the whole reason an inactive tab costs nothing.
  slots.forEach((slot) => observer.observe(slot));

  return () => observer.disconnect();
};
