import { useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button, MiniLabel } from "@/components/notebook";
import type { KbTraceTable } from "@/lib/kb-loader";

interface TracePlayerProps {
  table: KbTraceTable;
  autoplay?: boolean;
}

/**
 * Generic trace player — steps through a KB trace table one row at a time,
 * with play/pause, scrubber, and prev/next controls. Works for any
 * tabular hand-trace in the KB.
 */
export function TracePlayer({ table, autoplay = false }: TracePlayerProps) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(autoplay);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= table.rows.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 1600);
    return () => clearInterval(id);
  }, [playing, table.rows.length]);

  const current = table.rows[step];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {table.headers.map((h, i) => (
          <div
            key={i}
            style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 12px", background: i === 0 ? "var(--paper-2)" : "var(--paper)" }}
          >
            <MiniLabel>{h}</MiniLabel>
            <div className="serif mt-1 text-[14px]">{current?.[i] ?? "—"}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setStep(0)} variant="ghost"><SkipBack size={14} /></Button>
        <Button onClick={() => setStep((s) => Math.max(0, s - 1))} variant="ghost">←</Button>
        <Button onClick={() => setPlaying((p) => !p)} variant="pop">
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </Button>
        <Button onClick={() => setStep((s) => Math.min(table.rows.length - 1, s + 1))} variant="ghost">→</Button>
        <Button onClick={() => setStep(table.rows.length - 1)} variant="ghost"><SkipForward size={14} /></Button>

        <input
          type="range"
          min={0}
          max={Math.max(0, table.rows.length - 1)}
          value={step}
          onChange={(e) => { setStep(Number(e.target.value)); setPlaying(false); }}
          style={{ flex: 1, minWidth: 140, accentColor: "var(--pop)" }}
        />

        <MiniLabel>step {step + 1} / {table.rows.length}</MiniLabel>
      </div>
    </div>
  );
}
