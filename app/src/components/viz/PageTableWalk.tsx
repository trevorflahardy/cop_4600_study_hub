import { useState, useMemo } from "react";
import { Button, Chip, Eyebrow, Frame, MiniLabel } from "@/components/notebook";
import { ChevronRight } from "lucide-react";

interface PageTableWalkProps {
  mode?: "single" | "two-level";
}

function toHex(n: number, digits: number = 4): string {
  return "0x" + n.toString(16).toUpperCase().padStart(digits, "0");
}

function parseHex(s: string): number | null {
  try {
    return parseInt(s, 16);
  } catch {
    return null;
  }
}

export function PageTableWalk({ mode = "single" }: PageTableWalkProps) {
  const [vaInput, setVaInput] = useState("0x13CE");
  const [pageSize] = useState(64);
  const [vaBits] = useState(14);
  const [paBits] = useState(16);
  const [step, setStep] = useState(0);

  const pageSizeBits = Math.log2(pageSize);
  const vpnBits = vaBits - pageSizeBits;
  const offsetBits = pageSizeBits;

  const pageTableMap: Record<number, number> = {
    0x00: 0x10, 0x01: 0x11, 0x02: 0x12, 0x03: 0x13,
    0x04: 0x14, 0x13: 0x25, 0x3f: 0x3e,
  };

  const va = parseHex(vaInput);
  if (va === null) {
    return <div className="text-red-500">Invalid hex input</div>;
  }

  const offset = va & ((1 << offsetBits) - 1);
  const vpn = va >> offsetBits;
  const pfn = pageTableMap[vpn] ?? 0x00;
  const pa = (pfn << offsetBits) | offset;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow>{mode} mode · step {step + 1}/4</Eyebrow>
        <span className="flex-1" />
        <Chip tone="sky">VA bits={vaBits}, page={pageSize}B</Chip>
      </div>

      <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
        <MiniLabel>virtual address</MiniLabel>
        <input
          type="text"
          value={vaInput}
          onChange={(e) => setVaInput(e.target.value)}
          style={{
            marginTop: 6,
            width: "100%",
            border: "1px solid var(--ink-2)",
            borderRadius: 6,
            padding: "6px 8px",
            fontFamily: "var(--ff-mono)",
            fontSize: 13,
          }}
          placeholder="0x13CE"
        />
      </div>

      <div className="flex flex-col gap-3">
        <Frame className={step >= 0 ? "border-2 border-(--pop)" : ""}>
          <Eyebrow>step 1: extract VPN and offset</Eyebrow>
          <div className="mt-3 space-y-2 font-mono text-sm">
            <div>VA = {toHex(va)}</div>
            <div>offset mask = {toHex((1 << offsetBits) - 1)}</div>
            <div className="text-(--pop)">VPN = {toHex(vpn, vpnBits)}, offset = {toHex(offset, offsetBits)}</div>
          </div>
        </Frame>

        <div className="flex justify-center">
          <ChevronRight size={20} className="text-(--ink-2)" />
        </div>

        <Frame className={step >= 1 ? "border-2 border-(--pop)" : ""}>
          <Eyebrow>step 2: page table lookup</Eyebrow>
          <div className="mt-3 space-y-2 font-mono text-sm">
            <div>PT[{toHex(vpn)}] = {toHex(pfn)}</div>
            <div className="text-(--pop)">PFN = {toHex(pfn)}</div>
          </div>
        </Frame>

        <div className="flex justify-center">
          <ChevronRight size={20} className="text-(--ink-2)" />
        </div>

        <Frame className={step >= 2 ? "border-2 border-(--pop)" : ""}>
          <Eyebrow>step 3: combine PFN and offset</Eyebrow>
          <div className="mt-3 space-y-2 font-mono text-sm">
            <div>PA = (PFN {'<<'} {offsetBits}) | offset</div>
            <div>PA = ({toHex(pfn)} {'<<'} {offsetBits}) | {toHex(offset)}</div>
            <div className="text-(--pop)">PA = {toHex(pa)}</div>
          </div>
        </Frame>

        <div className="flex justify-center">
          <ChevronRight size={20} className="text-(--ink-2)" />
        </div>

        <Frame className={step >= 3 ? "border-2 border-(--pop)" : ""}>
          <Eyebrow>result</Eyebrow>
          <div className="mt-3 space-y-2 font-mono text-sm">
            <div>Virtual address: {toHex(va)}</div>
            <div>Physical address: {toHex(pa)}</div>
            <div className="text-(--ink-2)">Page offset unchanged: {toHex(offset)}</div>
          </div>
        </Frame>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setStep(Math.max(0, step - 1))} variant="ghost">
          {"<"}
        </Button>
        <Button onClick={() => setStep(Math.min(3, step + 1))} variant="pop">
          next step
        </Button>
        <Button onClick={() => setStep(0)} variant="ghost">
          reset
        </Button>
      </div>
    </div>
  );
}
