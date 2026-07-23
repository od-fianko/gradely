import { Fragment } from "react";

/**
 * Minimal, dependency-free renderer for the constrained markdown subset the
 * AI assistants tend to produce in generated descriptions/problem statements:
 * paragraphs, blank-line breaks, bullet lists, **bold**, `inline code`, and
 * ```fenced code blocks```. Not a general markdown parser — just enough so
 * AI-authored text doesn't show up as raw asterisks and backticks.
 */
export function MarkdownText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const blocks = parseBlocks(text);

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <p key={i} className="mt-3 mb-1 first:mt-0 font-semibold text-foreground text-sm">
              {renderInline(block.content)}
            </p>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={i} className="my-2 rounded-lg bg-slate-950 text-emerald-400 p-3 text-xs overflow-x-auto font-mono">
              <code>{block.content}</code>
            </pre>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="my-2 list-disc pl-5 space-y-1">
              {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
            </ul>
          );
        }
        return (
          <p key={i} className="my-2 first:mt-0 last:mb-0 whitespace-pre-wrap leading-relaxed">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
}

type Block =
  | { type: "paragraph"; content: string }
  | { type: "heading"; content: string }
  | { type: "list"; items: string[] }
  | { type: "code"; content: string; lang?: string };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: "code", content: codeLines.join("\n"), lang });
      continue;
    }

    if (/^#{1,6}\s+/.test(line.trim())) {
      blocks.push({ type: "heading", content: line.trim().replace(/^#{1,6}\s+/, "") });
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length && lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^#{1,6}\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", content: paraLines.join("\n") });
  }

  return blocks;
}

/** Inline **bold** and `code` spans within a paragraph/list item. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
