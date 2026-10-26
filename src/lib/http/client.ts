type JsonOptions = {
  signal?: AbortSignal;
  errorMessage?: string;
  timeoutMs?: number;
};

export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// Only GETs are retried, once, and only when the API explicitly asks us to wait.
// A bounded timer also covers browsers without AbortSignal.timeout().
export async function getJson<T>(
  url: string,
  {
    signal,
    errorMessage = "Chưa tải được dữ liệu.",
    timeoutMs = 30_000,
  }: JsonOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    let response = await fetch(url, { signal: controller.signal });
    if (response.status === 429) {
      const seconds = Math.min(
        5,
        Math.max(1, Number(response.headers.get("Retry-After")) || 2),
      );
      await abortableDelay(seconds * 1000, controller.signal);
      response = await fetch(url, { signal: controller.signal });
    }
    const data: unknown = await response.json();
    if (!response.ok) {
      throw new Error(
        data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
          ? data.error
          : errorMessage,
      );
    }
    return data as T;
  } catch (error) {
    if (timedOut && !signal?.aborted)
      throw new Error("Kết nối mất quá lâu. Hãy thử lại.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
