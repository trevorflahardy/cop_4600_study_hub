import type { KbComplexity } from "@/lib/kb-loader";
import { Chip, MiniLabel } from "@/components/notebook";

export function ComplexityCard({ complexity }: { complexity: KbComplexity | null | undefined }) {
  if (!complexity) {
    return null;
  }
  return (
    <div style={{ border: "2px solid var(--ink)", borderRadius: 10, padding: 16, background: "var(--paper-2)" }}>
      <MiniLabel>complexity</MiniLabel>
      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        {complexity.best && <Row label="Best" value={complexity.best} />}
        {complexity.avg && <Row label="Avg" value={complexity.avg} />}
        {complexity.worst && <Row label="Worst" value={complexity.worst} />}
        {complexity.space && <Row label="Space" value={complexity.space} />}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {complexity.stable === true && <Chip tone="mint">stable</Chip>}
        {complexity.stable === false && <Chip tone="amber">not stable</Chip>}
        {complexity.inPlace === true && <Chip tone="sky">in-place</Chip>}
        {complexity.inPlace === false && <Chip tone="soft">not in-place</Chip>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MiniLabel>{label}</MiniLabel>
      <div className="mono mt-1 text-[13px]">{value}</div>
    </div>
  );
}
