import {
  createYouTubePlayer,
  isPlayingState,
  type YouTubePlayer,
} from "./youtube-player-adapter";

type CarouselVideo = {
  frame: HTMLElement;
  index: number;
  isAvailable: boolean;
  isReady: boolean;
  player: YouTubePlayer | null;
  playerTarget: HTMLElement | null;
  timeoutId: number | undefined;
  videoId: string | null;
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

  const frames = Array.from(root.querySelectorAll<HTMLElement>("[data-video-frame]"));
  const intervalMs = Number(root.getAttribute("data-carousel-interval") ?? 10000);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const playbackTimeoutMs = options.playbackTimeoutMs ?? 3500;
  const videos: CarouselVideo[] = frames.map((frame, index) => ({
    frame,
    index,
    isAvailable: true,
    isReady: false,
    player: null,
    playerTarget: frame.querySelector<HTMLElement>("[data-video-player]"),
    timeoutId: undefined,
    videoId: frame.getAttribute("data-video-id"),
  }));
  const listenerDisposers: Array<() => void> = [];
  let activeIndex = -1;
  let rotationIntervalId: number | undefined;
  let isTornDown = false;

  const clearVideoTimeout = (video: CarouselVideo) => {
    window.clearTimeout(video.timeoutId);
    video.timeoutId = undefined;
  };

  const findNextIndex = (fromIndex: number) => {
    for (let offset = 1; offset <= videos.length; offset += 1) {
      const candidateIndex = (fromIndex + offset + videos.length) % videos.length;
      const candidate = videos[candidateIndex];

      if (candidate?.isAvailable && candidate.isReady) {
        return candidateIndex;
      }
    }

    return -1;
  };

  const setActiveFrame = (index: number) => {
    if (index < 0) {
      return;
    }

    if (activeIndex >= 0 && activeIndex !== index) {
      const previous = videos[activeIndex];
      previous?.frame.classList.remove("is-active");
      previous?.player?.pauseVideo();
    }

    activeIndex = index;
    videos[index]?.frame.classList.add("is-active");
  };

  const requestPlayback = (index: number) => {
    const video = videos[index];

    if (!video?.isAvailable || !video.player || !video.isReady) {
      return;
    }

    clearVideoTimeout(video);
    video.player.mute();
    video.player.playVideo();
    video.timeoutId = window.setTimeout(() => {
      if (activeIndex !== index) {
        video.isAvailable = false;
        requestPlayback(findNextIndex(index));
      }
    }, playbackTimeoutMs);
  };

  const handleVideoPlaying = (index: number) => {
    const video = videos[index];

    if (!video?.isAvailable) {
      return;
    }

    clearVideoTimeout(video);
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

    const targetVideo = videos[index];

    if (!targetVideo?.isAvailable) {
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
    if (!video.videoId || !video.playerTarget) {
      video.isAvailable = false;
      continue;
    }

    createYouTubePlayer({
      container: video.playerTarget,
      videoId: video.videoId,
      onError: () => {
        if (!isTornDown) {
          handleVideoError(video.index);
        }
      },
      onReady: (event) => {
        if (isTornDown) {
          return;
        }

        video.isReady = true;
        event.target.mute();

        if (activeIndex === -1) {
          requestPlayback(video.index);
        }
      },
      onStateChange: (event) => {
        if (!isTornDown && isPlayingState(event)) {
          handleVideoPlaying(video.index);
        }
      },
    }).then((player) => {
      if (isTornDown) {
        player.destroy?.();
        return;
      }

      video.player = player;
    }).catch(() => {
      if (!isTornDown) {
        handleVideoError(video.index);
      }
    });
  }

  if (frames.length > 1 && intervalMs > 0 && !reduceMotion) {
    rotationIntervalId = window.setInterval(() => {
      if (activeIndex >= 0) {
        requestPlayback(findNextIndex(activeIndex));
      }
    }, intervalMs);
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
      video.player?.pauseVideo();
      video.player?.destroy?.();
      video.frame.classList.remove("is-active");
    }
  };

  teardownByRoot.set(root, teardown);
  return teardown;
};
