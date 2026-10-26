import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

const baseline = process.argv[2] ?? "HEAD";
function load(source) {
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiled = { exports: {} };
  new Function("module", "exports", code)(compiled, compiled.exports);
  return compiled.exports.navigationProgress;
}
const before = load(
  execFileSync("git", ["show", `${baseline}:src/lib/places/navigation.ts`], {
    encoding: "utf8",
  }),
);
const after = load(readFileSync("src/lib/places/navigation.ts", "utf8"));
const coordinates = Array.from({ length: 1200 }, (_, i) => ({
  latitude: 21 + Math.sin(i / 100) * 0.002,
  longitude: 105 + i / 100000,
}));
const route = {
  coordinates,
  mode: "walking",
  distanceMeters: 1600,
  durationSeconds: 1200,
  steps: Array.from({ length: 80 }, (_, i) => ({
    location: coordinates[i * 14],
    type: "turn",
    modifier: "right",
    distanceMeters: 20,
  })),
};
const fixes = Array.from({ length: 100 }, (_, i) => coordinates[i * 10]);
function measure(fn) {
  const started = performance.now();
  const results = fixes.map((position) => fn(route, position));
  return { ms: +(performance.now() - started).toFixed(2), results };
}
const previous = measure(before),
  current = measure(after);
const equivalent = previous.results.every(
  (value, i) =>
    Math.abs(value.remainingMeters - current.results[i].remainingMeters) <
      0.000001 &&
    value.nextStep === current.results[i].nextStep &&
    value.arrived === current.results[i].arrived,
);
console.log(
  JSON.stringify({
    baseline,
    points: coordinates.length,
    steps: route.steps.length,
    fixes: fixes.length,
    beforeMs: previous.ms,
    afterMs: current.ms,
    equivalent,
  }),
);
if (!equivalent) process.exitCode = 1;
