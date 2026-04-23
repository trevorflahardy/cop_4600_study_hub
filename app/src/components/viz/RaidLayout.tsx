import { useState } from "react";
import { Button, Chip, Eyebrow, Frame, MiniLabel } from "@/components/notebook";
import { RotateCcw } from "lucide-react";

type RAIDLevel = 0 | 1 | 4 | 5;

export function RaidLayout({ level = 5 }: { level?: RAIDLevel }) {
  const [numDisks, setNumDisks] = useState(4);
  const [blockCount, setBlockCount] = useState(8);

  let capacity = 0, readBW = 0, writeBW = 0, reliability = "fair";

  if (level === 0) {
    capacity = numDisks;
    readBW = numDisks;
    writeBW = numDisks;
    reliability = "very poor (any disk = total loss)";
  } else if (level === 1) {
    capacity = numDisks / 2;
    readBW = numDisks;
    writeBW = numDisks / 2;
    reliability = "excellent (can lose 1 disk per mirror pair)";
  } else if (level === 4) {
    capacity = numDisks - 1;
    readBW = numDisks - 1;
    writeBW = 1;
    reliability = "good (can lose parity disk or 1 data disk)";
  } else if (level === 5) {
    capacity = numDisks - 1;
    readBW = numDisks - 1;
    writeBW = (numDisks - 1) / 4;
    reliability = "good (can lose any 1 disk)";
  }

  const stripes = Math.ceil(blockCount / numDisks);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow>RAID-{level} layout</Eyebrow>
        <span className="flex-1" />
        <Chip tone="sky">{numDisks} disks, {blockCount} blocks</Chip>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
          <MiniLabel>number of disks</MiniLabel>
          <div className="mt-1 flex items-center gap-2">
            <input type="range" min={2} max={12} value={numDisks} onChange={(e) => setNumDisks(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--pop)" }} />
            <span className="display text-lg">{numDisks}</span>
          </div>
        </div>

        <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
          <MiniLabel>blocks</MiniLabel>
          <div className="mt-1 flex items-center gap-2">
            <input type="range" min={4} max={32} step={4} value={blockCount} onChange={(e) => setBlockCount(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--pop)" }} />
            <span className="display text-lg">{blockCount}</span>
          </div>
        </div>
      </div>

      <div style={{ border: "2px solid var(--ink)", borderRadius: 12, padding: "16px", background: "var(--paper-2)", overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${numDisks}, 1fr)`, gap: 8, minWidth: 400 }}>
          {Array.from({ length: stripes }).map((_, s) =>
            Array.from({ length: numDisks }).map((_, d) => {
              const blockIdx = s * numDisks + d;
              let label = "", color = "";

              if (level === 0) {
                label = `D${blockIdx}`;
                color = "var(--hl)";
              } else if (level === 1) {
                if (d < numDisks / 2) {
                  label = `D${blockIdx % (blockCount / 2)}`;
                  color = "var(--hl)";
                } else {
                  label = `M${blockIdx % (blockCount / 2)}`;
                  color = "var(--hl-2)";
                }
              } else if (level === 4) {
                if (d === numDisks - 1) {
                  label = `P${s}`;
                  color = "var(--wrong)";
                } else {
                  label = `D${blockIdx}`;
                  color = "var(--hl)";
                }
              } else if (level === 5) {
                if (d === (s % numDisks)) {
                  label = `P${s}`;
                  color = "var(--wrong)";
                } else {
                  label = `D${blockIdx % (numDisks - 1)}`;
                  color = "var(--hl)";
                }
              }

              return (
                <div
                  key={`${s}-${d}`}
                  style={{
                    border: "1.5px solid var(--ink)",
                    borderRadius: 6,
                    padding: "12px 8px",
                    background: color,
                    textAlign: "center",
                    fontSize: 11,
                    fontFamily: "var(--ff-mono)",
                    color: "var(--ink)",
                    minHeight: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {label}
                </div>
              );
            })
          )}
        </div>
      </div>

      <Frame>
        <Eyebrow>RAID-{level} characteristics</Eyebrow>
        <div className="mt-3 grid gap-2 font-mono text-sm">
          <div>Usable capacity: {capacity.toFixed(1)}x (of {numDisks})</div>
          <div>Read bandwidth: {readBW.toFixed(1)}x (parallel reads)</div>
          <div>Write bandwidth: {writeBW.toFixed(1)}x (parity overhead)</div>
          <div>Reliability: {reliability}</div>
        </div>
      </Frame>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-(--ink-2)">Colors: </span>
        <span style={{ width: 12, height: 12, background: "var(--hl)", borderRadius: 2 }} />
        <span className="text-xs">data</span>
        <span style={{ width: 12, height: 12, background: "var(--hl-2)", borderRadius: 2 }} />
        <span className="text-xs">mirror</span>
        <span style={{ width: 12, height: 12, background: "var(--wrong)", borderRadius: 2 }} />
        <span className="text-xs">parity</span>
      </div>
    </div>
  );
}
