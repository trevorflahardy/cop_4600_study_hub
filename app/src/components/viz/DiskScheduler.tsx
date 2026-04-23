import { useState, useMemo } from "react";
import { Button, Chip, Eyebrow, Frame, MiniLabel } from "@/components/notebook";
import { RotateCcw } from "lucide-react";

type ScheduleAlgorithm = "fcfs" | "sstf" | "scan" | "cscan";

const DEFAULT_REQUESTS = "98,183,37,122,14,124,65,67";

function scheduleFCFS(requests: number[], diskSize: number): number[] {
  return [...requests];
}

function scheduleSST(requests: number[], diskSize: number, head: number): number[] {
  const remaining = [...requests];
  const order: number[] = [];
  let current = head;

  while (remaining.length > 0) {
    let minIdx = 0, minDist = Math.abs(remaining[0] - current);
    for (let i = 1; i < remaining.length; i++) {
      const dist = Math.abs(remaining[i] - current);
      if (dist < minDist) { minIdx = i; minDist = dist; }
    }
    current = remaining[minIdx];
    order.push(current);
    remaining.splice(minIdx, 1);
  }

  return order;
}

function scheduleSCAN(requests: number[], diskSize: number, head: number): number[] {
  const sorted = [...requests].sort((a, b) => a - b);
  const order: number[] = [];
  let current = head;
  const left = sorted.filter(r => r < current).reverse();
  const right = sorted.filter(r => r >= current);

  order.push(...right);
  order.push(...left);

  return order;
}

function scheduleCSCAN(requests: number[], diskSize: number, head: number): number[] {
  const sorted = [...requests].sort((a, b) => a - b);
  const order: number[] = [];
  const right = sorted.filter(r => r >= head);
  const left = sorted.filter(r => r < head);

  order.push(...right);
  order.push(...left);

  return order;
}

export function DiskScheduler({ algorithm = "fcfs" }: { algorithm?: ScheduleAlgorithm }) {
  const [diskSize, setDiskSize] = useState(200);
  const [headPos, setHeadPos] = useState(50);
  const [requestsInput, setRequestsInput] = useState(DEFAULT_REQUESTS);
  const [step, setStep] = useState(0);

  const requests = useMemo(() => {
    return requestsInput.split(",").map(s => {
      const n = parseInt(s.trim(), 10);
      return isNaN(n) ? 0 : Math.min(n, diskSize - 1);
    });
  }, [requestsInput, diskSize]);

  const schedule = useMemo(() => {
    switch (algorithm) {
      case "fcfs": return scheduleFCFS(requests, diskSize);
      case "sstf": return scheduleSST(requests, diskSize, headPos);
      case "scan": return scheduleSCAN(requests, diskSize, headPos);
      case "cscan": return scheduleCSCAN(requests, diskSize, headPos);
      default: return [];
    }
  }, [algorithm, requests, diskSize, headPos]);

  const positions: number[] = [headPos, ...schedule.slice(0, step + 1)];
  let totalSeek = 0;
  for (let i = 1; i < positions.length; i++) {
    totalSeek += Math.abs(positions[i] - positions[i - 1]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow>{algorithm} · step {step + 1}/{schedule.length}</Eyebrow>
        <span className="flex-1" />
        <Chip tone="sky">total seek: {totalSeek}</Chip>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
          <MiniLabel>disk size</MiniLabel>
          <div className="mt-1 flex items-center gap-2">
            <input type="range" min={100} max={400} value={diskSize} onChange={(e) => setDiskSize(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--pop)" }} />
            <span className="display text-lg">{diskSize}</span>
          </div>
        </div>

        <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
          <MiniLabel>head start</MiniLabel>
          <div className="mt-1 flex items-center gap-2">
            <input type="range" min={0} max={diskSize} value={headPos} onChange={(e) => setHeadPos(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--pop)" }} />
            <span className="display text-lg">{headPos}</span>
          </div>
        </div>
      </div>

      <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
        <MiniLabel>request queue</MiniLabel>
        <input
          type="text"
          value={requestsInput}
          onChange={(e) => setRequestsInput(e.target.value)}
          style={{
            marginTop: 6,
            width: "100%",
            border: "1px solid var(--ink-2)",
            borderRadius: 6,
            padding: "6px 8px",
            fontFamily: "var(--ff-mono)",
            fontSize: 12,
          }}
          placeholder="comma-separated track numbers"
        />
      </div>

      <Frame>
        <Eyebrow>disk visualization</Eyebrow>
        <div className="mt-4" style={{ height: 160, position: "relative", border: "1px solid var(--ink-2)", borderRadius: 8, background: "var(--paper-2)", overflow: "hidden" }}>
          <svg width="100%" height="100%" style={{ display: "block" }}>
            <defs>
              <linearGradient id="diskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--hl-2)" />
                <stop offset="100%" stopColor="var(--pop)" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="var(--paper-2)" />

            <line x1="10" y1="80" x2="90%" y2="80" stroke="var(--ink-2)" strokeWidth={1} />

            {requests.map((pos, i) => {
              const x = 10 + (pos / diskSize) * (window.innerWidth * 0.8 - 20);
              const visited = i < step;
              return (
                <g key={i}>
                  <circle cx={x} cy={80} r={5} fill={visited ? "var(--pop)" : "var(--ink-2)"} />
                  <text x={x} y={110} textAnchor="middle" fontSize={10} fill="var(--ink-2)" fontFamily="var(--ff-mono)">
                    {pos}
                  </text>
                </g>
              );
            })}

            {positions.map((pos, i) => {
              const x = 10 + (pos / diskSize) * (window.innerWidth * 0.8 - 20);
              return (
                <circle key={`head-${i}`} cx={x} cy={80} r={8} fill="none" stroke={i === positions.length - 1 ? "var(--pop)" : "var(--hl)"} strokeWidth={2} />
              );
            })}
          </svg>
        </div>
      </Frame>

      <Frame>
        <Eyebrow>schedule</Eyebrow>
        <div className="mt-3 flex flex-wrap gap-2 font-mono text-sm">
          <span className="rounded-sm bg-(--pop) px-2 py-1 text-white">{headPos}</span>
          {schedule.slice(0, step + 1).map((pos, i) => (
            <span key={i} className="rounded-sm bg-(--hl) px-2 py-1">{pos}</span>
          ))}
          {schedule.slice(step + 1).map((pos, i) => (
            <span key={i} className="rounded-sm bg-(--ink-3) px-2 py-1">{pos}</span>
          ))}
        </div>
      </Frame>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setStep(Math.max(0, step - 1))} variant="ghost">←</Button>
        <Button onClick={() => setStep(Math.min(schedule.length - 1, step + 1))} variant="pop">→</Button>
        <Button onClick={() => setStep(0)} variant="ghost"><RotateCcw size={14} /> reset</Button>
        <input type="range" min={0} max={schedule.length - 1} value={step} onChange={(e) => setStep(Number(e.target.value))} style={{ flex: 1, minWidth: 120, accentColor: "var(--pop)" }} />
      </div>
    </div>
  );
}
