import test from "node:test";
import assert from "node:assert/strict";
import { needsLiteVersion } from "../src/lib/legacy-browser.ts";

test("iOS browsers below 16.4 use lite, including Chrome on iOS", () => {
  for (const version of ["10_3_4", "12_5_7", "15_8", "16_3"]) {
    assert.equal(
      needsLiteVersion(
        `Mozilla/5.0 (iPhone; CPU iPhone OS ${version} like Mac OS X) AppleWebKit/605.1.15 Version/10.0 Mobile Safari/602.1`,
      ),
      true,
    );
    assert.equal(
      needsLiteVersion(
        `Mozilla/5.0 (iPhone; CPU iPhone OS ${version} like Mac OS X) AppleWebKit/605.1.15 CriOS/110.0 Mobile Safari/604.1`,
      ),
      true,
    );
  }
});

test("modern iOS and other browsers retain the full application", () => {
  for (const version of ["16_4", "17_0", "18_6", "26_0"])
    assert.equal(
      needsLiteVersion(`iPhone; CPU iPhone OS ${version} like Mac OS X`),
      false,
    );
  assert.equal(
    needsLiteVersion("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0"),
    false,
  );
  assert.equal(needsLiteVersion(""), false);
});
