import { create } from "zustand";
import { db, type SessionRow } from "@/lib/db";

export type SessionStepKind = "warmup" | "learn" | "practice" | "review" | "reflect";

export interface SessionStep {
  id: string;
  kind: SessionStepKind;
  title: string;
  targetSlug: string | null;
  estimatedMinutes: number;
  state: "pending" | "now" | "done";
}

interface SessionState {
  active: SessionRow | null;
  steps: SessionStep[];
  stepIndex: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  start: (plan: Omit<SessionRow, "id" | "startedAt" | "endedAt" | "correct" | "incorrect" | "masteryGained" | "flagged"> & { steps: SessionStep[] }) => Promise<void>;
  advance: () => Promise<void>;
  recordAnswer: (outcome: "correct" | "incorrect") => Promise<void>;
  end: () => Promise<SessionRow | null>;
}

const ACTIVE_KEY = "__active-session__";

export const useSession = create<SessionState>((set, get) => ({
  active: null,
  steps: [],
  stepIndex: 0,
  hydrated: false,

  async hydrate() {
    const active = await db.sessions.get(ACTIVE_KEY);
    set({
      active: active && !active.endedAt ? active : null,
      hydrated: true,
    });
  },

  async start({ plannedMinutes, topicsTouched, steps }) {
    const row: SessionRow = {
      id: ACTIVE_KEY,
      startedAt: Date.now(),
      endedAt: null,
      plannedMinutes,
      topicsTouched,
      correct: 0,
      incorrect: 0,
      masteryGained: 0,
      flagged: [],
    };
    await db.sessions.put(row);
    const markedSteps = steps.map((s, i) => ({ ...s, state: (i === 0 ? "now" : "pending") as SessionStep["state"] }));
    set({ active: row, steps: markedSteps, stepIndex: 0 });
  },

  async advance() {
    const { steps, stepIndex } = get();
    if (stepIndex >= steps.length - 1) return;
    const next = steps.map((s, i) => ({
      ...s,
      state:
        i < stepIndex + 1 ? "done" :
        i === stepIndex + 1 ? "now" : "pending",
    } as SessionStep));
    set({ steps: next, stepIndex: stepIndex + 1 });
  },

  async recordAnswer(outcome) {
    const { active } = get();
    if (!active) return;
    const patch: Partial<SessionRow> =
      outcome === "correct"
        ? { correct: active.correct + 1 }
        : { incorrect: active.incorrect + 1 };
    await db.sessions.update(ACTIVE_KEY, patch);
    set({ active: { ...active, ...patch } });
  },

  async end() {
    const { active, steps } = get();
    if (!active) return null;
    const finished: SessionRow = {
      ...active,
      endedAt: Date.now(),
    };
    await db.sessions.put(finished);
    set({
      active: null,
      steps: steps.map((s) => ({ ...s, state: "done" })),
    });
    return finished;
  },
}));
