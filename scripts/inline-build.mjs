import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const indexPath = path.join(distDir, "index.html");

let html = fs.readFileSync(indexPath, "utf8");

html = html.replace(
  /<link rel="stylesheet" crossorigin href="(\.\/assets\/[^"]+\.css)">/,
  (_match, href) => {
    const cssPath = path.join(distDir, href.replace(/^\.\//, ""));
    const css = fs.readFileSync(cssPath, "utf8");
    return `<style>\n${css}\n</style>`;
  },
);

let inlineScript = "";

html = html.replace(
  /<script type="module" crossorigin src="(\.\/assets\/[^"]+\.js)"><\/script>/,
  (_match, src) => {
    const jsPath = path.join(distDir, src.replace(/^\.\//, ""));
    inlineScript = fs
      .readFileSync(jsPath, "utf8")
      .replaceAll("</script", "<\\/script")
      .replaceAll("<!--", "<\\!--");
    return "";
  },
);

if (inlineScript) {
  html = html.replace(
    "</body>",
    () => `    <script>\n${inlineScript}\n    </script>\n  </body>`,
  );
}

fs.writeFileSync(indexPath, html, "utf8");
