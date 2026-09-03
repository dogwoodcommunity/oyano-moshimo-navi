const DEFAULT_IMAGE_WAIT_MS = 7_000;

export function withDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void
) {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      onTimeout?.();
      const error = new Error("operation_timed_out");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);

    void operation.then(
      (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function entryIdsInDateRange<T extends { id: string; date: string }>(
  entries: T[],
  startDate: string,
  endDate: string
) {
  return entries
    .filter((entry) => entry.date >= startDate && entry.date <= endDate)
    .map((entry) => entry.id);
}

function waitForImageLoad(image: HTMLImageElement, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timer = 0;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
      window.clearTimeout(timer);
      resolve(loaded);
    };
    const onLoad = () => finish(true);
    const onError = () => finish(false);

    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
    timer = window.setTimeout(() => finish(false), timeoutMs);

    // The image can finish between the caller's `complete` check and listener setup.
    if (image.complete) finish(image.naturalWidth > 0);
  });
}

function decodeWithin(image: HTMLImageElement, timeoutMs: number) {
  if (typeof image.decode !== "function") return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (decoded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(decoded);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    void image.decode().then(() => finish(true)).catch(() => finish(false));
  });
}

export async function waitForPrintableImage(
  image: HTMLImageElement,
  timeoutMs = DEFAULT_IMAGE_WAIT_MS
) {
  const startedAt = Date.now();
  if (!image.complete) {
    const loaded = await waitForImageLoad(image, timeoutMs);
    if (!loaded) return false;
  }
  if (image.naturalWidth <= 0) return false;

  const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
  const decoded = await decodeWithin(image, remainingMs);
  return decoded && image.naturalWidth > 0;
}
