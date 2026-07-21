import Anthropic from "@anthropic-ai/sdk";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export const MAX_UPLOAD_MB = 4;
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function collectText(node: unknown, out: string[]) {
  if (node == null) return;
  if (typeof node === "string") { out.push(node); return; }
  if (Array.isArray(node)) { node.forEach((n) => collectText(n, out)); return; }
  if (typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectText(value, out);
    }
  }
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({ ignoreAttributes: true });

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  if (slideFiles.length === 0) throw new Error("NO_SLIDES");

  const slideTexts: string[] = [];
  for (const [i, name] of slideFiles.entries()) {
    const xml = await zip.files[name].async("string");
    const json = parser.parse(xml);
    const texts: string[] = [];
    collectText(json, texts);
    slideTexts.push(`--- Slide ${i + 1} ---\n${texts.join(" ").trim()}`);
  }
  return slideTexts.join("\n\n");
}

/**
 * Converts an uploaded file (PDF / PPTX / image) into Claude content blocks
 * with NO trailing prompt — the caller composes one or more of these plus a
 * final instructions block, which is what lets multiple source files be
 * combined into a single generation request.
 * Throws Error("UNSUPPORTED_FILE") / Error("NO_SLIDES") / Error("FILE_TOO_LARGE").
 */
export async function fileToRawBlocks(file: File): Promise<Anthropic.ContentBlockParam[]> {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
    ];
  }
  if (IMAGE_MIMES.has(file.type)) {
    return [
      { type: "image", source: { type: "base64", media_type: file.type as "image/jpeg" | "image/png" | "image/webp", data: buffer.toString("base64") } },
    ];
  }
  if (file.type === PPTX_MIME || name.endsWith(".pptx")) {
    const slideText = await extractPptxText(buffer);
    return [{ type: "text", text: `Slide deck "${file.name}":\n\n${slideText}` }];
  }
  throw new Error("UNSUPPORTED_FILE");
}

/** Single-file convenience wrapper: file content blocks followed by a prompt block. */
export async function fileToContentBlocks(file: File, prompt: string): Promise<Anthropic.ContentBlockParam[]> {
  const blocks = await fileToRawBlocks(file);
  return [...blocks, { type: "text", text: prompt }];
}
