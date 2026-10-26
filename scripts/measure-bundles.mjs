import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Measures scripts referenced by prerendered HTML, not all lazy chunks.
for (const route of ["index", "goi-y/solo", "goi-y/couple", "goi-y/friends"]) {
  let html;
  try {
    html = readFileSync(`.next/server/app/${route}.html`, "utf8");
  } catch {
    continue;
  }
  const scripts = [
    ...new Set(
      [...html.matchAll(/src="([^"\s]+\.js)"/g)]
        .map((match) => match[1])
        .filter((path) => path.startsWith("/_next/")),
    ),
  ];
  let raw = 0;
  let gzip = 0;
  for (const path of scripts) {
    const bytes = readFileSync(path.replace("/_next/", ".next/"));
    raw += bytes.length;
    gzip += gzipSync(bytes).length;
  }
  console.log(
    JSON.stringify({
      route: route === "index" ? "/" : `/${route}`,
      scripts: scripts.length,
      raw,
      gzip,
      htmlBytes: Buffer.byteLength(html),
    }),
  );
}

for (const file of ["public/lite/app.js", "public/lite/style.css"]) {
  const bytes = readFileSync(file);
  console.log(
    JSON.stringify({
      asset: file,
      raw: bytes.length,
      gzip: gzipSync(bytes).length,
    }),
  );
}
