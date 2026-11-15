// Builds editable Word versions of the proposal from docs/proposal-{lang}.html (same content as the PDFs).
// Usage: node scripts/docs/build_docx.cjs <node_modules dir containing docx + node-html-parser>
const path = require("path");
const fs = require("fs");
const mods = process.argv[2];
const D = require(path.join(mods, "docx"));
const { parse } = require(path.join(mods, "node-html-parser"));
const {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, AlignmentType, LevelFormat, HeadingLevel, Footer, PageNumber, TabStopType,
} = D;

const DOCS = path.resolve("docs");
const sizes = JSON.parse(fs.readFileSync(path.join(DOCS, "evidence", "sizes.json"), "utf8"));
const CONTENT_W = 10206; // A4 width 11906 - 2 x 850 DXA margins
const PX_PER_DXA = 96 / 1440;
const ORANGE = "8A3D16";

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

/** inline HTML -> runs; [placeholders] are highlighted so the team can find and replace them */
function runs(node, fmt = {}) {
  const out = [];
  for (const c of node.childNodes) {
    if (c.nodeType === 3) {
      const text = decode(c.rawText).replace(/\s+/g, " ");
      if (!text) continue;
      for (const part of text.split(/(\[[^\]]+\])/)) {
        if (!part) continue;
        const ph = /^\[[^\]]+\]$/.test(part);
        out.push(new TextRun({ text: part, bold: fmt.b, italics: fmt.i, size: fmt.size, color: fmt.color, highlight: ph ? "yellow" : undefined }));
      }
    } else if (c.nodeType === 1) {
      const tag = c.tagName.toLowerCase();
      if (tag === "b" || tag === "strong") out.push(...runs(c, { ...fmt, b: true }));
      else if (tag === "i" || tag === "em") out.push(...runs(c, { ...fmt, i: true }));
      else if (tag === "br") out.push(new TextRun({ break: 1 }));
      else if (tag === "a") out.push(new ExternalHyperlink({ link: c.getAttribute("href"), children: [new TextRun({ text: decode(c.text), style: "Hyperlink", size: fmt.size })] }));
      else out.push(...runs(c, fmt));
    }
  }
  return out;
}

function image(file, maxWdxa) {
  const s = sizes[file];
  const maxPx = maxWdxa * PX_PER_DXA;
  const w = Math.min(maxPx, s.w), h = (s.h * w) / s.w;
  const maxH = 520; // keep tall crops (Gale panel) within a page
  const k = h > maxH ? maxH / h : 1;
  return new ImageRun({ type: file.endsWith(".png") ? "png" : "jpg", data: fs.readFileSync(path.join(DOCS, "evidence", file)), transformation: { width: Math.round(w * k), height: Math.round(h * k) } });
}

function figFile(fig, lang) {
  if (fig.querySelector("svg")) return `arch-${lang}.png`;
  const src = fig.querySelector("img").getAttribute("src").replace("evidence/", "");
  return src.endsWith(".svg") ? src.replace(".svg", ".png") : src;
}

function figure(fig, lang, maxW) {
  const cap = fig.querySelector("figcaption");
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, keepNext: true, children: [image(figFile(fig, lang), maxW)] }),
    new Paragraph({ style: "Caption", children: cap ? runs(cap) : [] }),
  ];
}

const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const thin = { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" };

function sideBySide(figs, lang) {
  const half = Math.floor(CONTENT_W / 2);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [half, CONTENT_W - half],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({
      cantSplit: true,
      children: figs.map((f, i) => new TableCell({
        width: { size: i ? CONTENT_W - half : half, type: WidthType.DXA },
        margins: { left: i ? 80 : 0, right: i ? 0 : 80 },
        borders: { top: none, bottom: none, left: none, right: none },
        children: figure(f, lang, half - 120),
      })),
    })],
  });
}

function table(t) {
  const isKv = t.classList.contains("kv");
  const rows = t.querySelectorAll("tr");
  const nCols = rows[0].querySelectorAll("th,td").length;
  const widths = isKv ? [2400, CONTENT_W - 2400] : Array.from({ length: nCols }, (_, i) => i === nCols - 1 ? CONTENT_W - Math.floor(CONTENT_W / nCols) * (nCols - 1) : Math.floor(CONTENT_W / nCols));
  if (!isKv && nCols === 8) { const w = [2200, 1050, 950, 950, 1000, 1050, 1500]; w.push(CONTENT_W - w.reduce((a, b) => a + b)); widths.splice(0, 8, ...w); }
  const size = t.classList.contains("small") ? 16 : 17;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r) => {
      const header = !!r.querySelector("th");
      return new TableRow({
        tableHeader: header, cantSplit: true,
        children: r.querySelectorAll("th,td").map((c, i) => new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "F6EFE8" } : undefined,
          margins: { top: 50, bottom: 50, left: 90, right: 90 },
          borders: { top: thin, bottom: thin, left: none, right: none },
          children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: runs(c, { b: header, size, color: isKv && i === 0 ? "666666" : undefined }) })],
        })),
      });
    }),
  });
}

function build(lang) {
  const root = parse(fs.readFileSync(path.join(DOCS, `proposal-${lang}.html`), "utf8"));
  const body = root.querySelector("body");
  const out = [];
  const push = (...x) => out.push(...x);
  for (const el of body.childNodes) {
    if (el.nodeType !== 1) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === "header") {
      push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: decode(el.querySelector(".kicker").text).toUpperCase(), color: ORANGE, size: 18, characterSpacing: 20 })] }));
      push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(decode(el.querySelector("h1").text))] }));
      push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: decode(el.querySelector(".sub").text), size: 24, color: "333333" })] }));
      push(new Paragraph({
        spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: "C2561F", space: 6 } },
        children: [new TextRun({ text: decode(el.querySelector(".motto").text), italics: true, size: 18, color: "777777" })],
      }));
    } else if (tag === "h2") {
      push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(el) }));
    } else if (tag === "p") {
      const small = el.classList.contains("note") || el.classList.contains("credit");
      push(new Paragraph({ spacing: { after: 100 }, children: runs(el, small ? { size: 17, color: el.classList.contains("credit") ? "777777" : undefined } : {}) }));
    } else if (tag === "ul" || tag === "ol") {
      const ref = tag === "ul" ? "bullets" : "numbers";
      const small = el.classList.contains("refs");
      for (const li of el.querySelectorAll("li")) push(new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 40 }, children: runs(li, small ? { size: 17 } : {}) }));
    } else if (tag === "table") {
      push(table(el), new Paragraph({ spacing: { after: 60 }, children: [] }));
    } else if (tag === "figure") {
      push(...figure(el, lang, CONTENT_W));
    } else if (tag === "div" && el.classList.contains("two")) {
      const kids = el.childNodes.filter((k) => k.nodeType === 1);
      if (kids.every((k) => k.tagName.toLowerCase() === "figure")) push(sideBySide(kids, lang));
      else for (const k of kids) {
        if (k.tagName.toLowerCase() === "figure") push(...figure(k, lang, Math.floor(CONTENT_W * 0.6)));
        else for (const p of k.querySelectorAll("p")) push(new Paragraph({ spacing: { after: 100 }, children: runs(p) }));
      }
    }
  }

  const footerText = lang === "es" ? "Mars Pathfinder · Propuesta · NASA Space Apps Managua 2026" : "Mars Pathfinder · Proposal · NASA Space Apps Managua 2026";
  const doc = new Document({
    creator: "Mars Pathfinder team",
    title: lang === "es" ? "Mars Pathfinder — Propuesta" : "Mars Pathfinder — Proposal",
    styles: {
      default: { document: { run: { font: "Arial", size: 20 }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: "Arial", size: 56, bold: true, color: "1D1D1F" }, paragraph: { spacing: { before: 0, after: 60 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 27, bold: true, color: ORANGE }, paragraph: { spacing: { before: 280, after: 100 }, keepNext: true, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E6D9CC", space: 2 } } } },
        { id: "Caption", name: "Caption", basedOn: "Normal", next: "Normal", run: { font: "Arial", size: 16, color: "555555", italics: true }, paragraph: { spacing: { before: 0, after: 160 } } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 320 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, bottom: 900, left: 850, right: 850 } } },
      footers: {
        default: new Footer({ children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
          children: [new TextRun({ text: footerText, size: 15, color: "888888" }), new TextRun({ children: ["\t", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 15, color: "888888" })],
        })] }),
      },
      children: out,
    }],
  });
  return Packer.toBuffer(doc).then((buf) => {
    const f = path.join(DOCS, `Mars-Pathfinder-Propuesta-${lang.toUpperCase()}.docx`);
    fs.writeFileSync(f, buf);
    console.log("wrote", f);
  });
}

Promise.all([build("es"), build("en")]).catch((e) => { console.error(e); process.exit(1); });
