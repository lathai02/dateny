import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import ts from "typescript";

// TS module loader for unit tests with extensionless/alias imports. No network.
const modules = new Map();
export function loadTs(filename) {
  const path = resolve(filename.endsWith(".ts") ? filename : `${filename}.ts`);
  if (modules.has(path)) return modules.get(path).exports;
  const loaded = { exports: {} };
  modules.set(path, loaded);
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier.startsWith("@/"))
      return loadTs(resolve("src", specifier.slice(2)));
    if (specifier.startsWith("."))
      return loadTs(resolve(dirname(path), specifier));
    throw new Error(`Unexpected unit-test import: ${specifier}`);
  };
  new Function("require", "module", "exports", code)(
    localRequire,
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
