import test from "node:test";
import assert from "node:assert/strict";
import { abortableDelay, getJson } from "../src/lib/http/client.ts";

test("GET honors Retry-After once, without an unbounded retry loop", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 1
      ? new Response("{}", { status: 429, headers: { "Retry-After": "1" } })
      : Response.json({ ok: true });
  });
  assert.deepEqual(await getJson("https://example.test"), { ok: true });
  assert.equal(calls, 2);
});

test("failed GET surfaces the server message without retrying a 502", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ error: "Provider unavailable" }, { status: 502 });
  });
  await assert.rejects(getJson("https://example.test"), /Provider unavailable/);
  assert.equal(calls, 1);
});

test("GET times out and aborts its network request", async (t) => {
  let aborted = false;
  t.mock.method(
    globalThis,
    "fetch",
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  );
  await assert.rejects(
    getJson("https://example.test", { timeoutMs: 20 }),
    /mất quá lâu/,
  );
  assert.equal(aborted, true);
});

test("unmount cancels a pending retry delay immediately", async () => {
  const controller = new AbortController();
  const delay = abortableDelay(60_000, controller.signal);
  controller.abort();
  await assert.rejects(delay, { name: "AbortError" });
  await assert.rejects(abortableDelay(60_000, controller.signal), {
    name: "AbortError",
  });
});
