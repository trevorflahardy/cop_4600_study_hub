import { useState, useMemo } from "react";
import { Button, Chip, Eyebrow, Frame, MiniLabel } from "@/components/notebook";
import { Play, Pause, RotateCcw } from "lucide-react";

type ReplacementPolicy = "fifo" | "lru";

interface TLBEntry {
  vpn: number;
  pfn: number;
  timestamp?: number;
}

const DEFAULT_STREAM = "0,1024,2048,3072,0,1024,2048,4096,0,1024,2048,3072";

export function TlbSimulator({ pageSize = 4096 }: { pageSize?: number }) {
  const [tlbSize, setTlbSize] = useState(4);
  const [policy, setPolicy] = useState<ReplacementPolicy>("lru");
  const [streamInput, setStreamInput] = useState(DEFAULT_STREAM);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);

  const pageShift = Math.log2(pageSize);
  const stream = useMemo(() => {
    return streamInput.split(",").map(s => {
      const addr = parseInt(s.trim(), 10);
      return addr >> pageShift;
    }).filter(n => !isNaN(n));
  }, [streamInput, pageShift]);

  const { tlb, hits, misses } = useMemo(() => {
    const t: TLBEntry[] = [];
    let hitCount = 0, missCount = 0;
    let timestamp = 0;

    for (let i = 0; i <= Math.min(step, stream.length - 1); i++) {
      const vpn = stream[i];
      const entry = t.find(e => e.vpn === vpn);

      if (entry) {
        hitCount++;
        entry.timestamp = timestamp++;
      } else {
        missCount++;
        if (t.length < tlbSize) {
          t.push({ vpn, pfn: 0x10 + vpn % 16, timestamp: timestamp++ });
        } else {
          if (policy === "lru") {
            const lru = t.reduce((a, b) => (a.timestamp ?? 0) < (b.timestamp ?? 0) ? a : b);
            t.splice(t.indexOf(lru), 1);
          } else {
            t.shift();
          }
          t.push({ vpn, pfn: 0x10 + vpn % 16, timestamp: timestamp++ });
        }
      }
    }

    return { tlb: t, hits: hitCount, misses: missCount };
  }, [step, stream, tlbSize, policy]);

  const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) : "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow>TLB simulator · {policy} · step {step + 1}/{stream.length}</Eyebrow>
        <span className="flex-1" />
        <Chip tone="sky">hit rate: {hitRate}%</Chip>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
          <MiniLabel>TLB size</MiniLabel>
          <div className="mt-1 flex items-center gap-2">
            <input type="range" min={1} max={16} value={tlbSize} onChange={(e) => setTlbSize(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--pop)" }} />
            <span className="display text-lg">{tlbSize}</span>
          </div>
        </div>

        <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
          <MiniLabel>replacement</MiniLabel>
          <div className="mt-2 flex gap-2">
            {(["lru", "fifo"] as const).map(p => (
              <button
                key={p}
                className={policy === p ? "chip sky" : "chip ghost"}
                onClick={() => setPolicy(p)}
                style={{ fontSize: 11 }}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
        <MiniLabel>reference stream (addresses)</MiniLabel>
        <input
          type="text"
          value={streamInput}
          onChange={(e) => setStreamInput(e.target.value)}
          style={{
            marginTop: 6,
            width: "100%",
            border: "1px solid var(--ink-2)",
            borderRadius: 6,
            padding: "6px 8px",
            fontFamily: "var(--ff-mono)",
            fontSize: 12,
            maxHeight: 60,
            overflow: "auto",
          }}
          placeholder="comma-separated virtual addresses"
        />
      </div>

      <Frame>
        <Eyebrow>TLB contents</Eyebrow>
        <div className="mt-3 overflow-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--ff-mono)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ink-2)" }}>
                <th style={{ textAlign: "left", padding: "4px" }}>VPN</th>
                <th style={{ textAlign: "left", padding: "4px" }}>PFN</th>
                <th style={{ textAlign: "left", padding: "4px" }}>age</th>
              </tr>
            </thead>
            <tbody>
              {tlb.length === 0 && <tr><td colSpan={3} style={{ padding: "8px", textAlign: "center", color: "var(--ink-2)" }}>empty</td></tr>}
              {tlb.map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--ink-3)" }}>
                  <td style={{ padding: "4px" }}>0x{e.vpn.toString(16).toUpperCase().padStart(4, "0")}</td>
                  <td style={{ padding: "4px" }}>0x{e.pfn.toString(16).toUpperCase()}</td>
                  <td style={{ padding: "4px", color: "var(--ink-2)" }}>{e.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Frame>

      <Frame>
        <Eyebrow>statistics</Eyebrow>
        <div className="mt-2 grid gap-2 font-mono text-sm">
          <div>Hits: {hits}</div>
          <div>Misses: {misses}</div>
          <div>Hit rate: {hitRate}%</div>
        </div>
      </Frame>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setStep(Math.max(0, step - 1))} variant="ghost">←</Button>
        <Button onClick={() => setPlaying(!playing)} variant="pop">
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </Button>
        <Button onClick={() => setStep(Math.min(stream.length - 1, step + 1))} variant="ghost">→</Button>
        <Button onClick={() => { setStep(0); setPlaying(false); }} variant="ghost"><RotateCcw size={14} /> reset</Button>
        <input type="range" min={0} max={stream.length - 1} value={step} onChange={(e) => setStep(Number(e.target.value))} style={{ flex: 1, minWidth: 120, accentColor: "var(--pop)" }} />
      </div>
    </div>
  );
}
