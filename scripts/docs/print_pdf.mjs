// Prints docs/proposal-{es,en}.html to PDF with headless Chrome (puppeteer-core).
// Usage: node scripts/docs/print_pdf.mjs <path-to-puppeteer-core> [chrome.exe]
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const [, , puppeteerPath, chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe"] = process.argv;
const puppeteer = (await import(pathToFileURL(puppeteerPath).href)).default;
const docs = resolve("docs");
const b = await puppeteer.launch({ executablePath: chrome, headless: "new" });
for (const [lang, label] of [["es", "Mars Pathfinder · Propuesta · NASA Space Apps Managua 2026"], ["en", "Mars Pathfinder · Proposal · NASA Space Apps Managua 2026"]]) {
  const p = await b.newPage();
  await p.goto(pathToFileURL(resolve(docs, `proposal-${lang}.html`)).href, { waitUntil: "networkidle0" });
  await p.pdf({
    path: resolve(docs, `Mars-Pathfinder-Propuesta-${lang.toUpperCase()}.pdf`),
    format: "A4", printBackground: true, displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `<div style="font-size:7.5pt;color:#888;width:100%;padding:0 15mm;display:flex;justify-content:space-between;font-family:Arial"><span>${label}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "14mm", bottom: "16mm", left: "15mm", right: "15mm" },
  });
  console.log("wrote", lang);
}
await b.close();
