import { useState } from "react";
import clsx from "clsx";
import type { KbPseudocode } from "@/lib/kb-loader";

interface PseudocodeProps {
  blocks: KbPseudocode[];
  highlightLine?: number | null;
  onLineHover?: (line: number | null) => void;
}

/**
 * Pseudocode display with per-line hover + optional line highlight from
 * an external trace step. Styled via the notebook .code-block class.
 */
export function Pseudocode({ blocks, highlightLine, onLineHover }: PseudocodeProps) {
  const [active, setActive] = useState(0);
  if (!blocks.length) {
    return <div className="placeholder">No pseudocode in the KB entry yet.</div>;
  }
  const cur = blocks[Math.min(active, blocks.length - 1)];

  return (
    <div>
      {blocks.length > 1 && (
        <div className="mb-2 flex gap-2">
          {blocks.map((b, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={clsx("chip", i === active && "hl")}
            >
              {b.title ?? "variant " + (i + 1)}
            </button>
          ))}
        </div>
      )}
      <pre className="code-block" style={{ padding: 0 }}>
        {cur.lines.map((line, idx) => (
          <div
            key={idx}
            onMouseEnter={() => onLineHover?.(idx)}
            onMouseLeave={() => onLineHover?.(null)}
            style={{
              padding: "2px 14px",
              background: highlightLine === idx ? "var(--hl)" : "transparent",
              transition: "background 0.15s",
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 10,
              minHeight: 20,
            }}
          >
            <span className="w-6 pr-1 text-right text-[10px] select-none" style={{ color: "var(--ink-3)" }}>{idx + 1}</span>
            <span>{line || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
