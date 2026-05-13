export type YouTubePlayer = {
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  destroy?: () => void;
};

type YouTubeReadyEvent = {
  target: YouTubePlayer;
};

type YouTubeStateEvent = {
  data: number;
};

type YouTubePlayerOptions = {
  videoId: string;
  playerVars: Record<string, string | number>;
  events: {
    onError: () => void;
    onReady: (event: YouTubeReadyEvent) => void;
    onStateChange: (event: YouTubeStateEvent) => void;
  };
};

type YouTubeNamespace = {
  PlayerState: {
    PLAYING: number;
  };
  Player: new (element: Element, options: YouTubePlayerOptions) => YouTubePlayer;
};

type YouTubeWindow = Window &
  typeof globalThis & {
    onYouTubeIframeAPIReady?: () => void;
    YT?: YouTubeNamespace;
  };

export type YouTubeStateChangeEvent = {
  data: number;
};

export type CreateYouTubePlayerOptions = {
  container: Element;
  videoId: string;
  onError: () => void;
  onReady: (event: YouTubeReadyEvent) => void;
  onStateChange: (event: YouTubeStateChangeEvent) => void;
};

const API_SRC = "https://www.youtube.com/iframe_api";
let youtubeApiPromise: Promise<YouTubeNamespace> | undefined;

const getYouTubeNamespace = () => {
  const youtubeWindow = window as YouTubeWindow;
  return youtubeWindow.YT;
};

export const loadYouTubeApi = (): Promise<YouTubeNamespace> => {
  const existingYoutube = getYouTubeNamespace();

  if (existingYoutube) {
    return Promise.resolve(existingYoutube);
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const youtubeWindow = window as YouTubeWindow;
    const previousReadyHandler = youtubeWindow.onYouTubeIframeAPIReady;
    const timeoutId = window.setTimeout(() => {
      reject(new Error("YouTube iframe API did not initialize in time."));
    }, 15000);

    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      const youtube = getYouTubeNamespace();

      if (!youtube) {
        reject(new Error("YouTube iframe API ready callback fired without YT."));
        return;
      }

      window.clearTimeout(timeoutId);
      resolve(youtube);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${API_SRC}"]`,
    );

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = API_SRC;
      script.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error("Failed to load YouTube iframe API script."));
      };
      document.head.append(script);
    }
  });

  return youtubeApiPromise;
};

export const createYouTubePlayer = async ({
  container,
  videoId,
  onError,
  onReady,
  onStateChange,
}: CreateYouTubePlayerOptions): Promise<YouTubePlayer> => {
  const youtube = await loadYouTubeApi();

  return new youtube.Player(container, {
    videoId,
    playerVars: {
      autoplay: 1,
      autohide: 1,
      controls: 0,
      disablekb: 1,
      enablejsapi: 1,
      fs: 0,
      iv_load_policy: 3,
      loop: 1,
      modestbranding: 1,
      mute: 1,
      playlist: videoId,
      playsinline: 1,
      rel: 0,
    },
    events: {
      onError,
      onReady,
      onStateChange,
    },
  });
};

export const isPlayingState = (event: YouTubeStateChangeEvent) => {
  const youtube = getYouTubeNamespace();
  return event.data === youtube?.PlayerState.PLAYING;
};
