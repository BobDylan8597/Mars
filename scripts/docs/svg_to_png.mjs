// Renders the SVG figures of docs/proposal-{lang}.html to PNG (Word does not render SVG reliably).
// Usage: node scripts/docs/svg_to_png.mjs <path-to-puppeteer-core-esm-entry>
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const puppeteer = (await import(pathToFileURL(process.argv[2]).href)).default;
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
for (const lang of ["es", "en"]) {
  const p = await b.newPage();
  await p.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2.5 });
  await p.goto(pathToFileURL(resolve("docs", `proposal-${lang}.html`)).href, { waitUntil: "networkidle0" });
  const arch = await p.$("figure > svg");
  await arch.screenshot({ path: resolve("docs/evidence", `arch-${lang}.png`) });
  const val = await p.$(`img[src$="validation-${lang}.svg"]`);
  await val.screenshot({ path: resolve("docs/evidence", `validation-${lang}.png`) });
  console.log("rendered", lang);
}
await b.close();
