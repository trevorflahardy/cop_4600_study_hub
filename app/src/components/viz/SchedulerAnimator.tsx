import { useState, useMemo, useReducer } from "react";
import { motion } from "motion/react";
import { Button, Chip, Eyebrow, MiniLabel, Frame } from "@/components/notebook";
import { Play, Pause, RotateCcw } from "lucide-react";

type SchedulerKind = "fifo" | "sjf" | "stcf" | "rr" | "mlfq" | "cfs";

interface Process {
  id: string;
  arrival: number;
  burst: number;
  priority?: number;
  nice?: number;
}

interface ScheduleEvent {
  time: number;
  pid: string | null;
  note: string;
}

const DEFAULT_PROCESSES: Process[] = [
  { id: "A", arrival: 0, burst: 3 },
  { id: "B", arrival: 1, burst: 6 },
  { id: "C", arrival: 4, burst: 4 },
  { id: "D", arrival: 6, burst: 2 },
];

function runFIFO(processes: Process[]): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const queue = [...processes].sort((a, b) => a.arrival - b.arrival);
  let time = 0;

  for (const proc of queue) {
    if (time < proc.arrival) {
      events.push({ time, pid: null, note: `Idle until ${proc.id} arrives` });
      time = proc.arrival;
    }
    events.push({ time, pid: proc.id, note: `${proc.id} runs (burst=${proc.burst})` });
    time += proc.burst;
  }
  return events;
}

function runSJF(processes: Process[]): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const available = [...processes];
  let time = 0;

  while (available.length > 0) {
    const ready = available.filter(p => p.arrival <= time);
    if (ready.length === 0) {
      const next = available.reduce((a, b) => a.arrival < b.arrival ? a : b);
      events.push({ time, pid: null, note: `Idle until ${next.id} arrives` });
      time = next.arrival;
      continue;
    }
    const shortest = ready.reduce((a, b) => a.burst < b.burst ? a : b);
    events.push({ time, pid: shortest.id, note: `${shortest.id} runs (burst=${shortest.burst})` });
    time += shortest.burst;
    available.splice(available.indexOf(shortest), 1);
  }
  return events;
}

function runSTCF(processes: Process[]): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const remaining = new Map(processes.map(p => [p.id, p.burst]));
  const procs = new Map(processes.map(p => [p.id, p]));
  let time = 0;

  while ([...remaining.values()].some(b => b > 0)) {
    const ready = [...procs.values()].filter(p => p.arrival <= time && remaining.get(p.id)! > 0);
    if (ready.length === 0) {
      const next = [...procs.values()].filter(p => remaining.get(p.id)! > 0).reduce((a, b) => a.arrival < b.arrival ? a : b);
      time = next.arrival;
      continue;
    }
    const shortest = ready.reduce((a, b) => remaining.get(a.id)! < remaining.get(b.id)! ? a : b);
    const execTime = 1;
    events.push({ time, pid: shortest.id, note: `${shortest.id} (${remaining.get(shortest.id)!} left)` });
    remaining.set(shortest.id, remaining.get(shortest.id)! - execTime);
    time += execTime;
  }
  return events;
}

function runRR(processes: Process[], quantum: number): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const queue = [...processes].sort((a, b) => a.arrival - b.arrival);
  const remaining = new Map(queue.map(p => [p.id, p.burst]));
  const procs = new Map(queue.map(p => [p.id, p]));
  let time = 0;
  let queueOrder: string[] = [];

  while ([...remaining.values()].some(b => b > 0)) {
    const ready = [...procs.values()].filter(p => p.arrival <= time && remaining.get(p.id)! > 0);
    if (ready.length === 0) {
      const next = [...procs.values()].filter(p => remaining.get(p.id)! > 0).reduce((a, b) => a.arrival < b.arrival ? a : b);
      time = next.arrival;
      queueOrder = [];
      continue;
    }
    if (queueOrder.length === 0) queueOrder = ready.map(p => p.id);
    const pid = queueOrder.shift()!;
    const timeSlice = Math.min(quantum, remaining.get(pid)!);
    events.push({ time, pid, note: `${pid} timeslice (${remaining.get(pid)!} left)` });
    remaining.set(pid, remaining.get(pid)! - timeSlice);
    time += timeSlice;
    if (remaining.get(pid)! > 0) queueOrder.push(pid);
  }
  return events;
}

function runCFS(processes: Process[]): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const vruntime = new Map(processes.map(p => [p.id, 0]));
  const remaining = new Map(processes.map(p => [p.id, p.burst]));
  const procs = new Map(processes.map(p => [p.id, p]));
  const weights = new Map(processes.map(p => [p.id, p.nice ? Math.pow(1.25, p.nice) : 1]));
  let time = 0;

  while ([...remaining.values()].some(b => b > 0)) {
    const ready = [...procs.values()].filter(p => p.arrival <= time && remaining.get(p.id)! > 0);
    if (ready.length === 0) {
      const next = [...procs.values()].filter(p => remaining.get(p.id)! > 0).reduce((a, b) => a.arrival < b.arrival ? a : b);
      time = next.arrival;
      continue;
    }
    const minVruntime = ready.reduce((a, b) => vruntime.get(a.id)! < vruntime.get(b.id)! ? a : b);
    const execTime = 1;
    const w = weights.get(minVruntime.id)!;
    events.push({ time, pid: minVruntime.id, note: `${minVruntime.id} (vruntime=${vruntime.get(minVruntime.id)!.toFixed(1)})` });
    remaining.set(minVruntime.id, remaining.get(minVruntime.id)! - execTime);
    vruntime.set(minVruntime.id, vruntime.get(minVruntime.id)! + execTime / w);
    time += execTime;
  }
  return events;
}

function computeMetrics(events: ScheduleEvent[], processes: Process[]) {
  const completion = new Map<string, number>();
  const response = new Map<string, number>();
  const firstRun = new Map<string, number>();

  for (const evt of events) {
    if (evt.pid) {
      if (!firstRun.has(evt.pid)) firstRun.set(evt.pid, evt.time);
      completion.set(evt.pid, evt.time + 1);
    }
  }

  let totalTurnaround = 0, totalResponse = 0;
  for (const p of processes) {
    const turnaround = (completion.get(p.id) ?? 0) - p.arrival;
    const resp = (firstRun.get(p.id) ?? 0) - p.arrival;
    totalTurnaround += turnaround;
    totalResponse += resp;
  }

  return {
    avgTurnaround: (totalTurnaround / processes.length).toFixed(2),
    avgResponse: (totalResponse / processes.length).toFixed(2),
  };
}

interface State {
  playing: boolean;
  step: number;
  quantum: number;
}

type Action = { type: "toggle" } | { type: "reset" } | { type: "next" } | { type: "prev" } | { type: "setQuantum"; payload: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "toggle": return { ...state, playing: !state.playing };
    case "reset": return { ...state, playing: false, step: 0 };
    case "next": return { ...state, step: state.step + 1 };
    case "prev": return { ...state, step: Math.max(0, state.step - 1) };
    case "setQuantum": return { ...state, quantum: action.payload };
    default: return state;
  }
}

export function SchedulerAnimator({ algorithm }: { algorithm: SchedulerKind }) {
  const [state, dispatch] = useReducer(reducer, { playing: false, step: 0, quantum: 2 });
  const [processes] = useState<Process[]>(DEFAULT_PROCESSES);

  const events = useMemo(() => {
    switch (algorithm) {
      case "fifo": return runFIFO(processes);
      case "sjf": return runSJF(processes);
      case "stcf": return runSTCF(processes);
      case "rr": return runRR(processes, state.quantum);
      case "cfs": return runCFS(processes);
      case "mlfq": return runRR(processes, 1);
      default: return [];
    }
  }, [algorithm, processes, state.quantum]);

  const metrics = useMemo(() => computeMetrics(events, processes), [events, processes]);
  const current = events[Math.min(state.step, events.length - 1)];
  const maxTime = events.length > 0 ? events[events.length - 1].time + 2 : 10;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow>{algorithm} · step {state.step + 1}/{events.length}</Eyebrow>
        <span className="flex-1" />
        <Chip tone="sky">n = {processes.length}</Chip>
      </div>

      {algorithm === "rr" && (
        <div style={{ border: "1.5px solid var(--ink)", borderRadius: 10, padding: "10px 14px", background: "var(--paper-2)" }}>
          <MiniLabel>quantum</MiniLabel>
          <div className="mt-1 flex items-center gap-2">
            <input type="range" min={1} max={6} value={state.quantum} onChange={(e) => dispatch({ type: "setQuantum", payload: Number(e.target.value) })} style={{ flex: 1, accentColor: "var(--pop)" }} />
            <span className="display text-lg">{state.quantum}</span>
          </div>
        </div>
      )}

      <div style={{ border: "2px solid var(--ink)", borderRadius: 12, padding: "12px", background: "var(--paper-2)", minHeight: 120, overflow: "auto" }}>
        <svg width="100%" height={80} style={{ minWidth: 300 }}>
          <defs>
            <linearGradient id="timelineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--hl)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--pop)" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <rect x={40} y={40} width="100%" height={2} fill="var(--ink)" />
          {events.map((evt, i) => {
            const x = 40 + (evt.time / maxTime) * 80;
            return (
              <g key={i}>
                {evt.pid && <rect x={x - 2} y={25} width={4} height={15} fill={evt.pid === current?.pid ? "var(--pop)" : "var(--ink-2)"} />}
              </g>
            );
          })}
        </svg>
        <div className="mt-2 text-xs text-(--ink-2)">{current?.note || "—"}</div>
      </div>

      <Frame>
        <Eyebrow>metrics</Eyebrow>
        <div className="mt-2 grid gap-2 text-sm">
          <div>Avg turnaround: {metrics.avgTurnaround}</div>
          <div>Avg response: {metrics.avgResponse}</div>
        </div>
      </Frame>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => dispatch({ type: "prev" })} variant="ghost">←</Button>
        <Button onClick={() => dispatch({ type: "toggle" })} variant="pop">
          {state.playing ? <Pause size={16} /> : <Play size={16} />}
        </Button>
        <Button onClick={() => dispatch({ type: "next" })} variant="ghost">→</Button>
        <Button onClick={() => dispatch({ type: "reset" })} variant="ghost"><RotateCcw size={14} /> reset</Button>
        <input type="range" min={0} max={events.length - 1} value={state.step} onChange={(e) => dispatch({ type: "next" })} style={{ flex: 1, minWidth: 120, accentColor: "var(--pop)" }} disabled />
      </div>
    </div>
  );
}
