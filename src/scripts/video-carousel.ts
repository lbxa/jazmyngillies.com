type CarouselVideo = {
  element: HTMLVideoElement | null;
  frame: HTMLElement;
  index: number;
  isAvailable: boolean;
  isWarmed: boolean;
  timeoutId: number | undefined;
};

type VideoCarouselOptions = {
  playbackTimeoutMs?: number;
};

type Teardown = () => void;

const teardownByRoot = new WeakMap<HTMLElement, Teardown>();
const INIT_ATTRIBUTE = "data-video-carousel-initialized";

export const initVideoCarousel = (
  root: HTMLElement,
  options: VideoCarouselOptions = {},
): Teardown => {
  const existingTeardown = teardownByRoot.get(root);
  if (existingTeardown || root.hasAttribute(INIT_ATTRIBUTE)) {
    return existingTeardown ?? (() => undefined);
  }

  root.setAttribute(INIT_ATTRIBUTE, "true");

  const frames = Array.from(
    root.querySelectorAll<HTMLElement>("[data-video-frame]"),
  );
  const intervalMs = Number(
    root.getAttribute("data-carousel-interval") ?? 10000,
  );
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const playbackTimeoutMs = options.playbackTimeoutMs ?? 3500;
  const videos: CarouselVideo[] = frames.map((frame, index) => ({
    element: frame.querySelector<HTMLVideoElement>("[data-video-player]"),
    frame,
    index,
    isAvailable: true,
    isWarmed: false,
    timeoutId: undefined,
  }));
  const listenerDisposers: Array<() => void> = [];
  let activeIndex = -1;
  let rotationIntervalId: number | undefined;
  let isTornDown = false;
  let hasStarted = false;

  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  const saveData =
    connection?.saveData === true ||
    /(^|-)2g$/.test(connection?.effectiveType ?? "");

  const clearVideoTimeout = (video: CarouselVideo) => {
    window.clearTimeout(video.timeoutId);
    video.timeoutId = undefined;
  };

  const findNextIndex = (fromIndex: number) => {
    for (let offset = 1; offset <= videos.length; offset += 1) {
      const candidateIndex =
        (fromIndex + offset + videos.length) % videos.length;

      if (videos[candidateIndex]?.isAvailable) {
        return candidateIndex;
      }
    }

    return -1;
  };

  // Clips other than the first ship with preload="none" so a cold page load
  // fetches one video instead of all of them. Each clip is warmed only once,
  // just before it is likely to be needed.
  const warmVideo = (index: number) => {
    const video = videos[index];

    if (!video || !video.element) {
      return;
    }

    // A media element can be swapped in already errored by a client-side
    // navigation, and load() is what resets it. So an errored element must not
    // be skipped just because it was warmed once before.
    if (video.isWarmed && !video.element.error) {
      return;
    }

    video.isWarmed = true;
    video.element.preload = "auto";
    video.element.load();
  };

  const setActiveFrame = (index: number) => {
    if (index < 0) {
      return;
    }

    // The first frame is marked active in the HTML so its poster paints without
    // waiting for JavaScript, which means the frame to clear is not always the
    // one this module last activated.
    for (const other of videos) {
      if (
        other.index !== index &&
        other.frame.classList.contains("is-active")
      ) {
        other.frame.classList.remove("is-active");
        // pause() keeps currentTime, so a clip resumes where it left off
        // the next time the carousel comes back around to it.
        other.element?.pause();
      }
    }

    activeIndex = index;
    videos[index]?.frame.classList.add("is-active");

    warmVideo(findNextIndex(index));
  };

  const requestPlayback = (index: number) => {
    const video = videos[index];

    if (!video?.isAvailable || !video.element) {
      return;
    }

    clearVideoTimeout(video);
    warmVideo(index);
    video.element.muted = true;
    // Autoplay can be rejected (policy, or a pause() landing mid-promise).
    // The timeout below is what actually advances the carousel, so swallow it.
    video.element.play().catch(() => undefined);
    video.timeoutId = window.setTimeout(() => {
      if (activeIndex !== index) {
        video.isAvailable = false;
        requestPlayback(findNextIndex(index));
      }
    }, playbackTimeoutMs);
  };

  const handleVideoPlaying = (index: number) => {
    const video = videos[index];

    if (!video) {
      return;
    }

    clearVideoTimeout(video);
    // A clip skipped for being slow is not broken. Playback proves otherwise,
    // so let it back into the rotation.
    video.isAvailable = true;
    setActiveFrame(index);
  };

  const handleVideoError = (index: number) => {
    const video = videos[index];

    if (!video) {
      return;
    }

    clearVideoTimeout(video);
    video.isAvailable = false;
    video.frame.classList.remove("is-active");

    if (activeIndex === index || activeIndex === -1) {
      requestPlayback(findNextIndex(index));
    }
  };

  const playVideoAtIndex = (index: number) => {
    if (index < 0 || index >= videos.length) {
      return;
    }

    requestPlayback(index);
  };

  const videoTriggers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-video-trigger-index]"),
  );

  for (const trigger of videoTriggers) {
    const indexAttribute = trigger.getAttribute("data-video-trigger-index");
    const triggerIndex = Number(indexAttribute);

    if (!Number.isInteger(triggerIndex)) {
      continue;
    }

    const handleTrigger = (event: Event) => {
      if (event.type === "click") {
        event.preventDefault();
      }

      playVideoAtIndex(triggerIndex);
    };

    trigger.addEventListener("mouseenter", handleTrigger);
    trigger.addEventListener("focusin", handleTrigger);
    trigger.addEventListener("click", handleTrigger);

    listenerDisposers.push(() => {
      trigger.removeEventListener("mouseenter", handleTrigger);
      trigger.removeEventListener("focusin", handleTrigger);
      trigger.removeEventListener("click", handleTrigger);
    });
  }

  for (const video of videos) {
    if (!video.element) {
      video.isAvailable = false;
      continue;
    }

    const element = video.element;
    const onPlaying = () => {
      if (!isTornDown) {
        handleVideoPlaying(video.index);
      }
    };
    const onError = () => {
      if (!isTornDown) {
        handleVideoError(video.index);
      }
    };

    element.addEventListener("playing", onPlaying);
    element.addEventListener("error", onError);

    listenerDisposers.push(() => {
      element.removeEventListener("playing", onPlaying);
      element.removeEventListener("error", onError);
    });
  }

  // A hidden tab suspends playback, which trips the playback timeout above and
  // retires clips that are not actually broken. Returning to the tab restores
  // them and resumes, rather than leaving a frozen frame until the next tick.
  const handleVisibilityChange = () => {
    if (isTornDown || document.hidden) {
      return;
    }

    // Opened in a background tab: nothing has been fetched yet, so this is the
    // first point at which downloading video is worth doing. Data saver still
    // wins here, otherwise focusing the tab would quietly undo the opt-out.
    if (!hasStarted) {
      if (!saveData) {
        scheduleStart();
      }

      return;
    }

    for (const video of videos) {
      if (!video.element?.error) {
        video.isAvailable = true;
      }
    }

    requestPlayback(activeIndex >= 0 ? activeIndex : findNextIndex(-1));
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  listenerDisposers.push(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  const start = () => {
    if (isTornDown || hasStarted) {
      return;
    }

    hasStarted = true;
    requestPlayback(videos.findIndex((video) => video.isAvailable));

    if (frames.length > 1 && intervalMs > 0 && !reduceMotion) {
      rotationIntervalId = window.setInterval(() => {
        if (activeIndex >= 0) {
          requestPlayback(findNextIndex(activeIndex));
        }
      }, intervalMs);
    }
  };

  // Every clip is preload="none", so nothing is fetched until this runs. Waiting
  // for load and then for idle keeps multi-megabyte video off the network while
  // the browser is still settling the first paint. The poster on the first frame
  // carries the visuals until then.
  const scheduleStart = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(start, { timeout: 2000 });
      return;
    }

    window.setTimeout(start, 200);
  };

  // A hidden tab cannot play anything, and starting anyway would download every
  // clip for a page nobody is looking at. handleVisibilityChange starts it if
  // and when the tab is actually brought forward.
  const startIfVisible = () => {
    if (!document.hidden) {
      scheduleStart();
    }
  };

  if (saveData) {
    // Data saver on, or a connection too slow to justify the download: the
    // poster stays and no video is ever requested.
  } else if (document.readyState === "complete") {
    startIfVisible();
  } else {
    window.addEventListener("load", startIfVisible, { once: true });
    listenerDisposers.push(() =>
      window.removeEventListener("load", startIfVisible),
    );
  }

  const teardown = () => {
    if (isTornDown) {
      return;
    }

    isTornDown = true;
    teardownByRoot.delete(root);
    root.removeAttribute(INIT_ATTRIBUTE);

    for (const dispose of listenerDisposers) {
      dispose();
    }

    window.clearInterval(rotationIntervalId);

    for (const video of videos) {
      clearVideoTimeout(video);
      video.element?.pause();
      video.frame.classList.remove("is-active");
    }
  };

  teardownByRoot.set(root, teardown);
  return teardown;
};
