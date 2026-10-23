type WindowCounter = { count: number; resetAt: number };

const counters = new Map<string, WindowCounter>();
const MAX_COUNTERS = 2_000;

function stableFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function compactCounters(now: number) {
  for (const [key, value] of counters) {
    if (value.resetAt <= now) counters.delete(key);
  }
  while (counters.size > MAX_COUNTERS) counters.delete(counters.keys().next().value!);
}

function requestFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]
    ?? "unknown";
  return stableFingerprint(forwarded.trim().slice(0, 128));
}

export function consumeRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
  subject?: string,
): number | null {
  const now = Date.now();
  if (counters.size >= MAX_COUNTERS) compactCounters(now);
  const identity = subject
    ? stableFingerprint(subject)
    : requestFingerprint(request);
  const key = `${scope}:${identity}`;
  const current = counters.get(key);
  if (!current || current.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (current.count >= limit) return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  current.count += 1;
  return null;
}

export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const host = request.headers.get("host") ?? requestUrl.host;
    return (originUrl.protocol === "https:" || originUrl.protocol === "http:")
      && (originUrl.host === requestUrl.host || originUrl.host === host);
  } catch {
    return false;
  }
}
