import { memo, useMemo } from "react";
import { InlineMath, BlockMath } from "react-katex";
import { CodeBlock } from "@/components/notebook";

/**
 * A forgiving markdown renderer tuned to the KB's dialect.
 * Handles paragraphs, headings, bold/italic/code, code fences, bullets,
 * tables, blockquotes, and KaTeX math. Not a full parser — covers the
 * patterns used in the KB files.
 *
 * KaTeX rendering goes through react-katex, which handles the output
 * safely; we never expose raw HTML to the DOM ourselves.
 */
interface MarkdownBlockProps {
  source: string;
  className?: string;
}

export const MarkdownBlock = memo(function MarkdownBlock({ source, className }: MarkdownBlockProps) {
  const nodes = useMemo(() => parseBlocks(source), [source]);
  return <div className={className}>{nodes.map((n, i) => <Block key={i} node={n} />)}</div>;
});

type Node =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "h4"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; language: string; content: string }
  | { kind: "math"; content: string }
  | { kind: "quote"; text: string }
  | { kind: "table"; headers: string[]; rows: string[][] };

function parseBlocks(source: string): Node[] {
  const lines = source.split("\n");
  const out: Node[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") { i++; continue; }

    const fence = trimmed.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1];
      const start = i + 1;
      let j = start;
      while (j < lines.length && !/^```\s*$/.test(lines[j])) j++;
      out.push({ kind: "code", language: lang, content: lines.slice(start, j).join("\n") });
      i = j + 1;
      continue;
    }

    if (trimmed === "$$") {
      const start = i + 1;
      let j = start;
      while (j < lines.length && lines[j].trim() !== "$$") j++;
      out.push({ kind: "math", content: lines.slice(start, j).join("\n") });
      i = j + 1;
      continue;
    }

    if (/^\|.*\|$/.test(trimmed) && i + 1 < lines.length && /^\|[:\-\s|]+\|$/.test(lines[i + 1].trim())) {
      const headers = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      let j = i + 2;
      const rows: string[][] = [];
      while (j < lines.length && /^\|.*\|$/.test(lines[j].trim())) {
        rows.push(lines[j].trim().slice(1, -1).split("|").map((c) => c.trim()));
        j++;
      }
      out.push({ kind: "table", headers, rows });
      i = j;
      continue;
    }

    if (trimmed.startsWith("### ")) { out.push({ kind: "h3", text: trimmed.slice(4) }); i++; continue; }
    if (trimmed.startsWith("#### ")) { out.push({ kind: "h4", text: trimmed.slice(5) }); i++; continue; }

    if (trimmed.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
          items[items.length - 1] += " " + lines[i].trim();
          i++;
        }
      }
      out.push({ kind: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push({ kind: "ol", items });
      continue;
    }

    const pBuf: string[] = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^\|.*\|$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">")
    ) {
      pBuf.push(lines[i].trim());
      i++;
    }
    out.push({ kind: "p", text: pBuf.join(" ") });
  }

  return out;
}

function Block({ node }: { node: Node }) {
  switch (node.kind) {
    case "h3": return <h3 className="mt-6 mb-2"><Inline text={node.text} /></h3>;
    case "h4": return <h4 className="mt-5 mb-1"><Inline text={node.text} /></h4>;
    case "p":  return <p className="my-2 leading-relaxed"><Inline text={node.text} /></p>;
    case "quote":
      return (
        <blockquote
          className="serif my-3 border-l-2 border-dashed pl-3 text-(--ink-2) italic"
          style={{ borderColor: "var(--ink-2)" }}
        >
          <Inline text={node.text} />
        </blockquote>
      );
    case "ul":
      return (
        <ul className="my-2 flex list-disc flex-col gap-1 pl-6">
          {node.items.map((it, i) => <li key={i}><Inline text={it} /></li>)}
        </ul>
      );
    case "ol":
      return (
        <ol className="my-2 flex list-decimal flex-col gap-1 pl-6">
          {node.items.map((it, i) => <li key={i}><Inline text={it} /></li>)}
        </ol>
      );
    case "code":
      return <CodeBlock>{node.content}</CodeBlock>;
    case "math":
      return (
        <div className="my-4">
          <BlockMath math={node.content} />
        </div>
      );
    case "table":
      return (
        <div className="my-3 overflow-auto">
          <table className="w-full border-collapse" style={{ border: "1.5px solid var(--ink)" }}>
            <thead>
              <tr>
                {node.headers.map((h, i) => (
                  <th
                    key={i}
                    className="mono px-3 py-2 text-left text-[11px] tracking-wider uppercase"
                    style={{ background: "var(--paper-2)", borderBottom: "1.5px solid var(--ink)" }}
                  >
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px dashed var(--rule)" }}>
                  {r.map((c, j) => (
                    <td key={j} className="serif px-3 py-2 align-top text-[13px]">
                      <Inline text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function Inline({ text }: { text: string }) {
  const parts = useMemo(() => tokenizeInline(text), [text]);
  return <>{parts.map((p, i) => <InlineTokenView key={i} part={p} />)}</>;
}

type InlineTokenNode =
  | { kind: "text"; content: string }
  | { kind: "bold"; content: string }
  | { kind: "italic"; content: string }
  | { kind: "code"; content: string }
  | { kind: "link"; content: string; href: string }
  | { kind: "math"; content: string };

function tokenizeInline(text: string): InlineTokenNode[] {
  const out: InlineTokenNode[] = [];
  let i = 0;
  const pushText = (s: string) => { if (s) out.push({ kind: "text", content: s }); };

  while (i < text.length) {
    const rest = text.slice(i);

    const math = rest.match(/^\$([^$]+?)\$/);
    if (math) { out.push({ kind: "math", content: math[1] }); i += math[0].length; continue; }

    const code = rest.match(/^`([^`]+?)`/);
    if (code) { out.push({ kind: "code", content: code[1] }); i += code[0].length; continue; }

    const bold = rest.match(/^\*\*([^*]+?)\*\*/);
    if (bold) { out.push({ kind: "bold", content: bold[1] }); i += bold[0].length; continue; }

    const ital = rest.match(/^\*([^*\s][^*]*?)\*/);
    if (ital) { out.push({ kind: "italic", content: ital[1] }); i += ital[0].length; continue; }

    const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) { out.push({ kind: "link", content: link[1], href: link[2] }); i += link[0].length; continue; }

    pushText(text[i]);
    i++;
  }

  const merged: InlineTokenNode[] = [];
  for (const t of out) {
    const last = merged[merged.length - 1];
    if (t.kind === "text" && last && last.kind === "text") last.content += t.content;
    else merged.push(t);
  }
  return merged;
}

function InlineTokenView({ part }: { part: InlineTokenNode }) {
  switch (part.kind) {
    case "text": return <>{part.content}</>;
    case "bold": return <strong><Inline text={part.content} /></strong>;
    case "italic": return <em><Inline text={part.content} /></em>;
    case "code": return <code className="code-block inline" style={{ display: "inline", padding: "1px 6px" }}>{part.content}</code>;
    case "link":
      if (part.href.startsWith("http")) {
        return <a href={part.href} target="_blank" rel="noreferrer">{part.content}</a>;
      }
      return <span className="underline decoration-dashed underline-offset-2">{part.content}</span>;
    case "math": return <InlineMath math={part.content} />;
  }
}
