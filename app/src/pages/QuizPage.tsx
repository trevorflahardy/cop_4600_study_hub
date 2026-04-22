import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { allQuizzes, allTopics, allUnits, unitLabel } from "@/lib/kb-loader";
import { Frame, Chip, Eyebrow, Button, MiniLabel } from "@/components/notebook";
import { QuizRunner } from "@/features/practice/QuizRunner";

type PickerState =
  | { mode: "picker" }
  | { mode: "running"; questions: ReturnType<typeof allQuizzes> };

export function QuizPage() {
  const [state, setState] = useState<PickerState>({ mode: "picker" });
  const [unit, setUnit] = useState<string | "any">("any");
  const [kind, setKind] = useState<"any" | "mcq" | "short">("any");
  const [limit, setLimit] = useState(8);
  const navigate = useNavigate();

  const units = allUnits();
  const totalByUnit = useMemo(() => {
    const t = allTopics();
    const out: Record<string, number> = {};
    for (const u of units) out[u] = t.filter((x) => x.unit === u).length;
    return out;
  }, [units]);

  const pool = useMemo(() => {
    let p = allQuizzes();
    if (unit !== "any") {
      const slugs = new Set(allTopics().filter((t) => t.unit === unit).map((t) => t.slug));
      p = p.filter((q) => slugs.has(q.topicSlug));
    }
    if (kind !== "any") p = p.filter((q) => q.kind === kind);
    return p;
  }, [unit, kind]);

  const start = () => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, limit);
    if (shuffled.length === 0) return;
    setState({ mode: "running", questions: shuffled });
  };

  if (state.mode === "running") {
    return (
      <QuizRunner
        questions={state.questions}
        onComplete={() => navigate({ to: "/debrief" })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Frame className="!p-8">
        <Eyebrow>self-quiz · mixed</Eyebrow>
        <h1 className="mt-2">Pick what to drill.</h1>
        <p className="serif italic text-[var(--ink-2)] mt-3 max-w-[64ch]">
          Filter by unit or question type, then start. Immediate feedback after every answer — no
          batch-grade-at-the-end anti-pattern.
        </p>
      </Frame>

      <Frame>
        <Eyebrow>unit</Eyebrow>
        <div className="mt-2 flex gap-2 flex-wrap">
          <button onClick={() => setUnit("any")} className={unit === "any" ? "btn-sk primary" : "btn-sk ghost"}>
            any unit
          </button>
          {units.map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={unit === u ? "btn-sk primary" : "btn-sk ghost"}
            >
              {unitLabel(u)} <Chip tone="soft">{totalByUnit[u]}</Chip>
            </button>
          ))}
        </div>
      </Frame>

      <Frame>
        <Eyebrow>type</Eyebrow>
        <div className="mt-2 flex gap-2 flex-wrap">
          {(["any", "mcq", "short"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={kind === k ? "btn-sk primary" : "btn-sk ghost"}
            >
              {k === "any" ? "any kind" : k.toUpperCase()}
            </button>
          ))}
        </div>
      </Frame>

      <Frame>
        <Eyebrow>how many?</Eyebrow>
        <div className="mt-2 flex gap-4 items-center">
          <input
            type="range"
            min={3}
            max={25}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ accentColor: "var(--pop)", flex: 1, maxWidth: 320 }}
          />
          <span className="display text-2xl">{limit}</span>
          <MiniLabel>from a pool of {pool.length}</MiniLabel>
        </div>
      </Frame>

      <div className="flex gap-3 items-center">
        <Button variant="pop" size="big" onClick={start} disabled={pool.length === 0}>
          Start · {Math.min(limit, pool.length)} questions
        </Button>
        <MiniLabel>shuffled each session · autosaves progress</MiniLabel>
      </div>
    </div>
  );
}
