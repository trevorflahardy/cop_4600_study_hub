import { useState, useMemo } from "react";
import { Button, Chip, Eyebrow, Frame, MiniLabel } from "@/components/notebook";

export function InodeLayout({ fileSize = 0, blockSize = 4096 }: { fileSize?: number; blockSize?: number }) {
  const [fileSizeInput, setFileSizeInput] = useState(fileSize || 8388608);
  const [blockSizeIdx, setBlockSizeIdx] = useState(2);

  const blockSizes = [4096, 8192, 16384];
  const bs = blockSizes[blockSizeIdx];

  const DIRECT_POINTERS = 12;
  const INDIRECT_LEVELS = 3;
  const POINTER_SIZE = 4;

  const directMax = DIRECT_POINTERS * bs;
  const singleIndirectMax = (bs / POINTER_SIZE) * bs;
  const doubleIndirectMax = (bs / POINTER_SIZE) * (bs / POINTER_SIZE) * bs;
  const tripleIndirectMax = (bs / POINTER_SIZE) * (bs / POINTER_SIZE) * (bs / POINTER_SIZE) * bs;

  const totalMax = directMax + singleIndirectMax + doubleIndirectMax + tripleIndirectMax;

  const fileSize64 = Math.min(fileSizeInput, totalMax);

  const coverage = useMemo(() => {
    let used = 0;
    const result = { direct: 0, single: 0, double: 0, triple: 0 };

    if (fileSize64 <= directMax) {
      result.direct = Math.ceil(fileSize64 / bs);
    } else {
      result.direct = DIRECT_POINTERS;
      used = directMax;

      if (fileSize64 <= used + singleIndirectMax) {
        result.single = Math.ceil((fileSize64 - used) / bs);
      } else {
        result.single = bs / POINTER_SIZE;
        used += singleIndirectMax;

        if (fileSize64 <= used + doubleIndirectMax) {
          const remaining = fileSize64 - used;
          const doublePtrs = Math.ceil(remaining / (bs * bs / POINTER_SIZE));
          result.double = doublePtrs;
        } else {
          result.double = (bs / POINTER_SIZE) * (bs / POINTER_SIZE);
          used += doubleIndirectMax;

          const remaining = Math.min(fileSize64 - used, tripleIndirectMax);
          const triplePtrs = Math.ceil(remaining / (bs * bs * bs / (POINTER_SIZE * POINTER_SIZE)));
          result.triple = triplePtrs;
        }
      }
    }

    return result;
  }, [fileSize64, bs, directMax, singleIndirectMax, doubleIndirectMax]);

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Eyebrow>inode multi-level index</Eyebrow>
        <span className="flex-1" />
        <Chip tone="sky">block size: {formatBytes(bs)}</Chip>
      </div>

      <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
        <MiniLabel>file size (log scale)</MiniLabel>
        <div className="flex items-center gap-3 mt-2">
          <input
            type="range"
            min={0}
            max={32}
            step={0.5}
            value={Math.log2(fileSizeInput)}
            onChange={(e) => setFileSizeInput(Math.pow(2, Number(e.target.value)))}
            style={{ flex: 1, accentColor: "var(--pop)" }}
          />
          <span className="display text-sm" style={{ minWidth: 100, textAlign: "right" }}>{formatBytes(fileSize64)}</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {blockSizes.map((bs, i) => (
          <button
            key={i}
            className={blockSizeIdx === i ? "chip sky" : "chip ghost"}
            onClick={() => setBlockSizeIdx(i)}
            style={{ fontSize: 12 }}
          >
            {formatBytes(bs)}
          </button>
        ))}
      </div>

      <Frame>
        <Eyebrow>inode structure</Eyebrow>
        <div className="mt-4 space-y-3">
          <PointerRegion
            label="direct pointers (0-11)"
            max={DIRECT_POINTERS}
            used={coverage.direct}
            bytesPerPointer={bs}
            currentMax={directMax}
            enabled={fileSize64 > 0}
          />

          <PointerRegion
            label="single-indirect (1 level)"
            max={Math.floor(bs / POINTER_SIZE)}
            used={coverage.single}
            bytesPerPointer={bs}
            currentMax={singleIndirectMax}
            enabled={fileSize64 > directMax}
          />

          <PointerRegion
            label="double-indirect (2 levels)"
            max={Math.floor((bs / POINTER_SIZE) * (bs / POINTER_SIZE))}
            used={coverage.double}
            bytesPerPointer={bs * bs / POINTER_SIZE}
            currentMax={doubleIndirectMax}
            enabled={fileSize64 > directMax + singleIndirectMax}
          />

          <PointerRegion
            label="triple-indirect (3 levels)"
            max={Math.floor((bs / POINTER_SIZE) ** 3)}
            used={coverage.triple}
            bytesPerPointer={bs * bs * bs / (POINTER_SIZE * POINTER_SIZE)}
            currentMax={tripleIndirectMax}
            enabled={fileSize64 > directMax + singleIndirectMax + doubleIndirectMax}
          />
        </div>
      </Frame>

      <Frame>
        <Eyebrow>coverage summary</Eyebrow>
        <div className="mt-3 grid gap-2 text-sm font-mono">
          <div>File size: {formatBytes(fileSize64)} / {formatBytes(totalMax)} max</div>
          <div>Direct: {coverage.direct}/{DIRECT_POINTERS} pointers active ({formatBytes(coverage.direct * bs)})</div>
          <div>Single-indirect: {coverage.single} pointers active ({formatBytes(coverage.single * bs)})</div>
          <div>Double-indirect: {coverage.double} pointers active ({formatBytes(coverage.double * Math.pow(bs, 2) / POINTER_SIZE)})</div>
          <div>Triple-indirect: {coverage.triple} pointers active ({formatBytes(coverage.triple * Math.pow(bs, 3) / (POINTER_SIZE * POINTER_SIZE))})</div>
        </div>
      </Frame>
    </div>
  );
}

function PointerRegion({
  label,
  max,
  used,
  bytesPerPointer,
  currentMax,
  enabled,
}: {
  label: string;
  max: number;
  used: number;
  bytesPerPointer: number;
  currentMax: number;
  enabled: boolean;
}) {
  const pctUsed = used > 0 ? (used / max) * 100 : 0;
  const displayMax = Math.min(max, 16);

  return (
    <div
      style={{
        border: "1px solid var(--ink-2)",
        borderRadius: 6,
        padding: "10px 12px",
        background: enabled ? "var(--paper)" : "var(--paper-2)",
        opacity: enabled ? 1 : 0.6,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 500 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${displayMax}, 1fr)`, gap: 4, marginTop: 8 }}>
        {Array.from({ length: displayMax }).map((_, i) => (
          <div
            key={i}
            style={{
              width: "100%",
              aspectRatio: "1",
              borderRadius: 4,
              border: "1px solid var(--ink-3)",
              background: i < used ? "var(--pop)" : "var(--ink-3)",
              opacity: i < used ? 1 : 0.3,
              fontSize: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {i < used ? "P" : ""}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: "var(--ink-2)" }}>
        {used}/{max} pointers · up to {(currentMax / (1024 * 1024 * 1024)).toFixed(1)} GB
      </div>
    </div>
  );
}
