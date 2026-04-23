import { useState, useMemo } from "react";
import { Button, Chip, Eyebrow, Frame, MiniLabel } from "@/components/notebook";
import { RotateCcw } from "lucide-react";

type LockPrimitive = "tas" | "cas" | "ticket";

interface ThreadState {
  id: number;
  state: "waiting" | "spinning" | "critical" | "done";
  step: number;
}

export function LockSimulator({ primitive = "ticket" }: { primitive?: LockPrimitive }) {
  const [step, setStep] = useState(0);

  const simulation = useMemo(() => {
    const threads: ThreadState[] = [
      { id: 0, state: "waiting", step: 0 },
      { id: 1, state: "waiting", step: 0 },
      { id: 2, state: "waiting", step: 0 },
    ];

    const events: Array<{ time: number; message: string; lockState: any }> = [];
    let lockWord = 0;
    let ticketCounter = 0;
    let ticketQueue: number[] = [];

    if (primitive === "tas") {
      events.push({ time: 0, message: "Lock released (word=0)", lockState: { word: 0 } });

      for (let t = 0; t < 6; t++) {
        const tid = t % 3;
        const action = t < 3 ? "acquire" : "release";

        if (action === "acquire") {
          let spinning = true;
          let spins = 0;
          while (spinning && spins < 20) {
            spins++;
            const oldVal = lockWord;
            lockWord = 1;
            if (oldVal === 0) {
              spinning = false;
              events.push({ time: t + 0.5, message: `Thread ${tid}: XCHG old=0, success! Enter CS.`, lockState: { word: 1, thread: tid } });
            } else {
              events.push({ time: t + 0.1 * spins, message: `Thread ${tid}: XCHG old=1, spinning (spin ${spins})...`, lockState: { word: 1 } });
            }
          }
        } else {
          lockWord = 0;
          events.push({ time: t + 4, message: `Thread ${tid}: Release, write word=0`, lockState: { word: 0 } });
        }
      }
    } else if (primitive === "cas") {
      events.push({ time: 0, message: "Lock released (value=0)", lockState: { value: 0 } });

      for (let t = 0; t < 6; t++) {
        const tid = t % 3;
        const action = t < 3 ? "acquire" : "release";

        if (action === "acquire") {
          let spinning = true;
          let spins = 0;
          while (spinning && spins < 20) {
            spins++;
            const oldVal = lockWord;
            if (oldVal === 0 && Math.random() > 0.3) {
              lockWord = 1;
              spinning = false;
              events.push({ time: t + 0.5, message: `Thread ${tid}: CAS(old=0, new=1) succeeded. Enter CS.`, lockState: { value: 1, thread: tid } });
            } else {
              events.push({ time: t + 0.1 * spins, message: `Thread ${tid}: CAS(old=0, new=1) failed (spin ${spins})...`, lockState: { value: lockWord } });
            }
          }
        } else {
          lockWord = 0;
          events.push({ time: t + 4, message: `Thread ${tid}: Release, value=0`, lockState: { value: 0 } });
        }
      }
    } else {
      events.push({ time: 0, message: "Tickets: next=0, my=none", lockState: { next: 0, my: [] } });

      for (let t = 0; t < 6; t++) {
        const tid = t % 3;
        const action = t < 3 ? "acquire" : "release";

        if (action === "acquire") {
          const myTicket = ticketCounter++;
          ticketQueue.push(myTicket);
          events.push({ time: t, message: `Thread ${tid}: Get ticket=${myTicket}`, lockState: { next: 0, issued: ticketCounter - 1, queue: ticketQueue } });

          let spins = 0;
          while (myTicket !== 0 && spins < 10) {
            spins++;
            events.push({ time: t + 0.3 + 0.1 * spins, message: `Thread ${tid}: Spin (my=${myTicket} vs next=0)...`, lockState: { next: 0, queue: ticketQueue } });
          }

          ticketQueue.shift();
          events.push({ time: t + 0.5, message: `Thread ${tid}: Ticket ${myTicket}==next, enter CS.`, lockState: { next: myTicket, queue: ticketQueue, thread: tid } });
        } else {
          const nextTicket = (ticketQueue.length > 0 ? ticketQueue[0] : t);
          events.push({ time: t + 4, message: `Thread ${tid}: Release, next++`, lockState: { next: nextTicket + 1, queue: ticketQueue } });
        }
      }
    }

    return events;
  }, [primitive]);

  const currentEvent = simulation[Math.min(step, simulation.length - 1)] || simulation[0];

  const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow>{primitive} · step {step + 1}/{simulation.length}</Eyebrow>
        <span className="flex-1" />
        <Chip tone="sky">3 threads</Chip>
      </div>

      <Frame>
        <Eyebrow>lock state</Eyebrow>
        <div className="mt-3 rounded-lg border border-(--ink-2) bg-(--paper-2) p-4" style={{ fontFamily: "var(--ff-mono)", fontSize: 13 }}>
          {primitive === "tas" && (
            <div>
              <div>Lock word = {currentEvent.lockState.word === 0 ? "UNLOCKED (0)" : "LOCKED (1)"}</div>
              {currentEvent.lockState.thread !== undefined && <div className="text-(--pop)">Thread {currentEvent.lockState.thread} in CS</div>}
            </div>
          )}
          {primitive === "cas" && (
            <div>
              <div>Value = {currentEvent.lockState.value === 0 ? "UNLOCKED (0)" : "LOCKED (1)"}</div>
              {currentEvent.lockState.thread !== undefined && <div className="text-(--pop)">Thread {currentEvent.lockState.thread} in CS</div>}
            </div>
          )}
          {primitive === "ticket" && (
            <div>
              <div>Next ticket: {currentEvent.lockState.next}</div>
              <div>Queue: {currentEvent.lockState.queue.join(", ") || "empty"}</div>
              {currentEvent.lockState.thread !== undefined && <div className="text-(--pop)">Thread {currentEvent.lockState.thread} in CS</div>}
            </div>
          )}
        </div>
      </Frame>

      <div style={{ border: "2px solid var(--ink)", borderRadius: 12, padding: "16px", background: "var(--paper-2)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[0, 1, 2].map(tid => (
            <div key={tid} style={{ textAlign: "center" }}>
              <div style={{
                width: 80,
                height: 80,
                margin: "0 auto",
                borderRadius: 8,
                background: colors[tid],
                opacity: 0.7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: "bold",
                color: "white",
              }}>
                T{tid}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-2)" }}>
                {primitive === "tas" && `XCHG`}
                {primitive === "cas" && `CAS`}
                {primitive === "ticket" && `ticket`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Frame>
        <Eyebrow>event log</Eyebrow>
        <div className="mt-3 space-y-2">
          <div style={{ fontSize: 12, fontFamily: "var(--ff-mono)", color: "var(--pop)", fontWeight: 500 }}>
            {currentEvent.message}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-2)" }}>
            (Step {step + 1}: {primitive} {primitive === "tas" ? "atomic exchange on lock word" : primitive === "cas" ? "compare-and-swap on value" : "ticket lock acquire/release"})
          </div>
        </div>
      </Frame>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setStep(Math.max(0, step - 1))} variant="ghost">←</Button>
        <Button onClick={() => setStep(Math.min(simulation.length - 1, step + 1))} variant="pop">→</Button>
        <Button onClick={() => setStep(0)} variant="ghost"><RotateCcw size={14} /> reset</Button>
        <input type="range" min={0} max={simulation.length - 1} value={step} onChange={(e) => setStep(Number(e.target.value))} style={{ flex: 1, minWidth: 120, accentColor: "var(--pop)" }} />
      </div>
    </div>
  );
}
